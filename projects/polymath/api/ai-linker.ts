/**
 * Universal AI Linker
 *
 * Takes any item (memory, project, article, list_item, todo) and finds
 * connections across ALL entity types using embeddings + Gemini reasoning.
 *
 * Unlike the basic connection logic (X% similarity), this generates
 * real, human-readable explanations for WHY things connect.
 *
 * Thresholds:
 *  >= 0.82 → auto-create connection
 *  >= 0.52 → create suggestion
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserId } from './_lib/auth.js'
import { cosineSimilarity, generateEmbedding } from './_lib/gemini-embeddings.js'
import { MODELS } from './_lib/models.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const AUTO_LINK_THRESHOLD = 0.82
const SUGGESTION_THRESHOLD = 0.52
const MAX_CANDIDATES_FOR_REASONING = 8

type ItemType = 'thought' | 'project' | 'article' | 'list_item' | 'todo'

interface Candidate {
  id: string
  type: ItemType
  title: string
  content: string
  similarity: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' })
  }

  const userId = getUserId()
  const { itemId, itemType, content, embedding: providedEmbedding } = req.body

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType required' })
  }

  try {
    // 1. Get or generate embedding
    let embedding: number[] = providedEmbedding
    if (!embedding) {
      if (!content) {
        return res.status(400).json({ error: 'content or embedding required when embedding not provided' })
      }
      embedding = await generateEmbedding(content)
    }

    const candidates: Candidate[] = []

    // 2. Search across ALL entity types (skip source type)

    // Memories / thoughts
    if (itemType !== 'thought') {
      const { data: memories } = await supabase
        .from('memories')
        .select('id, title, body, embedding')
        .eq('user_id', userId)
        .neq('id', itemId)
        .not('embedding', 'is', null)
        .limit(100)

      for (const m of memories || []) {
        if (!m.embedding) continue
        const sim = cosineSimilarity(embedding, m.embedding)
        if (sim >= SUGGESTION_THRESHOLD) {
          candidates.push({
            id: m.id,
            type: 'thought',
            title: m.title || m.body?.slice(0, 60) || 'Untitled',
            content: m.body?.slice(0, 300) || '',
            similarity: sim
          })
        }
      }
    }

    // Projects
    if (itemType !== 'project') {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description, embedding')
        .eq('user_id', userId)
        .neq('id', itemId)
        .not('embedding', 'is', null)
        .limit(100)

      for (const p of projects || []) {
        if (!p.embedding) continue
        const sim = cosineSimilarity(embedding, p.embedding)
        if (sim >= SUGGESTION_THRESHOLD) {
          candidates.push({
            id: p.id,
            type: 'project',
            title: p.title || 'Untitled',
            content: p.description?.slice(0, 300) || '',
            similarity: sim
          })
        }
      }
    }

    // Articles
    if (itemType !== 'article') {
      const { data: articles } = await supabase
        .from('reading_queue')
        .select('id, title, excerpt, embedding')
        .eq('user_id', userId)
        .neq('id', itemId)
        .not('embedding', 'is', null)
        .limit(100)

      for (const a of articles || []) {
        if (!a.embedding) continue
        const sim = cosineSimilarity(embedding, a.embedding)
        if (sim >= SUGGESTION_THRESHOLD) {
          candidates.push({
            id: a.id,
            type: 'article',
            title: a.title || 'Untitled',
            content: a.excerpt?.slice(0, 300) || '',
            similarity: sim
          })
        }
      }
    }

    // List items (films, books, music, places...)
    if (itemType !== 'list_item') {
      const { data: listItems } = await supabase
        .from('list_items')
        .select('id, content, metadata, embedding')
        .eq('user_id', userId)
        .neq('id', itemId)
        .not('embedding', 'is', null)
        .limit(100)

      for (const li of listItems || []) {
        if (!li.embedding) continue
        const sim = cosineSimilarity(embedding, li.embedding)
        if (sim >= SUGGESTION_THRESHOLD) {
          candidates.push({
            id: li.id,
            type: 'list_item',
            title: li.content || li.metadata?.title || 'Untitled',
            content: li.metadata?.description || '',
            similarity: sim
          })
        }
      }
    }

    // Sort by similarity, take top candidates for AI reasoning
    candidates.sort((a, b) => b.similarity - a.similarity)
    const topCandidates = candidates.slice(0, MAX_CANDIDATES_FOR_REASONING)

    if (topCandidates.length === 0) {
      return res.status(200).json({
        connections: [],
        autoLinked: 0,
        suggestions: 0
      })
    }

    // 3. Use Gemini flash-lite to generate meaningful reasoning for each connection
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

    const sourceLabel = content?.slice(0, 200) || `${itemType} ${itemId}`
    const candidateList = topCandidates
      .map((c, i) => `${i + 1}. [${c.type}] "${c.title}": ${c.content}`)
      .join('\n')

    const reasoningPrompt = `You are a knowledge graph AI. Given a source item and ${topCandidates.length} candidates, explain WHY each connects to the source in one specific sentence. Also pick the best connection type.

SOURCE (${itemType}): "${sourceLabel}"

CANDIDATES:
${candidateList}

Return ONLY a JSON array with exactly ${topCandidates.length} objects in the same order:
[{"reason": "...", "type": "relates_to|inspired_by|evolves_from|reading_flow"}]

Rules:
- Be specific: mention actual shared concepts, themes, or ideas
- Do not say "both are about X" — explain the deeper link
- "evolves_from": source builds on candidate
- "inspired_by": source was sparked by candidate's theme
- "reading_flow": source deepens understanding of candidate
- "relates_to": general thematic connection`

    let reasonings: Array<{ reason: string; type: string }> = []
    try {
      const result = await model.generateContent(reasoningPrompt)
      const text = result.response.text()
      const jsonMatch = text.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        reasonings = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('[ai-linker] Reasoning generation failed, using similarity fallback')
      reasonings = topCandidates.map(c => ({
        reason: `Shares ${Math.round(c.similarity * 100)}% semantic overlap`,
        type: 'relates_to'
      }))
    }

    // 4. Create connections in the DB, avoid duplicates
    const autoLinkedIds: string[] = []
    const suggestedIds: string[] = []

    // Normalize source type (UI uses 'memory' but DB uses 'thought')
    const normSourceType = itemType === 'memory' ? 'thought' : itemType

    for (let i = 0; i < topCandidates.length; i++) {
      const candidate = topCandidates[i]
      const reasoning = reasonings[i] || { reason: 'Semantically related', type: 'relates_to' }

      // Skip if connection already exists (bidirectional check)
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .eq('user_id', userId)
        .or(
          `and(source_type.eq.${normSourceType},source_id.eq.${itemId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),` +
          `and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.${normSourceType},target_id.eq.${itemId})`
        )
        .maybeSingle()

      if (existing) continue

      // Todos go to connection_suggestions (not connections table — no type support yet)
      const isTodo = normSourceType === 'todo'

      if (!isTodo && candidate.similarity >= AUTO_LINK_THRESHOLD) {
        // Auto-create a real connection with AI reasoning
        await supabase.from('connections').insert({
          user_id: userId,
          source_type: normSourceType,
          source_id: itemId,
          target_type: candidate.type,
          target_id: candidate.id,
          connection_type: reasoning.type || 'relates_to',
          created_by: 'ai',
          ai_reasoning: reasoning.reason
        })
        autoLinkedIds.push(candidate.id)
      } else {
        // Store as a connection suggestion
        await supabase.from('connection_suggestions').insert({
          user_id: userId,
          from_item_type: normSourceType,
          from_item_id: itemId,
          to_item_type: candidate.type,
          to_item_id: candidate.id,
          reasoning: reasoning.reason,
          confidence: candidate.similarity,
          status: 'pending'
        })
        suggestedIds.push(candidate.id)
      }
    }

    // 5. Return enriched connections for real-time UI display
    return res.status(200).json({
      connections: topCandidates.map((c, i) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        similarity: c.similarity,
        reasoning: reasonings[i]?.reason || '',
        connectionType: reasonings[i]?.type || 'relates_to',
        autoLinked: autoLinkedIds.includes(c.id)
      })),
      autoLinked: autoLinkedIds.length,
      suggestions: suggestedIds.length
    })

  } catch (error) {
    console.error('[ai-linker] Error:', error)
    return res.status(500).json({
      error: 'Failed to link item',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
