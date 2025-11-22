import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (normA * normB)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sourceId, sourceType, content, embedding, userId } = req.body

    if (!sourceId || !sourceType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    console.log(`[connections] Finding connections for ${sourceType}:${sourceId}`)

    // 1. Get embedding if not provided
    let vector = embedding
    if (!vector && content) {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
      const result = await model.embedContent(content)
      vector = result.embedding.values
    }

    if (!vector) {
      return res.status(400).json({ error: 'Could not generate embedding' })
    }

    const candidates: Array<{ type: 'project' | 'thought' | 'article'; id: string; title: string; similarity: number }> = []

    // 2. Search Projects
    if (sourceType !== 'project') {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description, embedding')
        .eq('user_id', userId)
        .not('embedding', 'is', null)
        .limit(50)

      if (projects) {
        for (const p of projects) {
          if (p.embedding) {
            const similarity = cosineSimilarity(vector, p.embedding)
            if (similarity > 0.55) {
              candidates.push({ type: 'project', id: p.id, title: p.title, similarity })
            }
          }
        }
      }
    }

    // 3. Search Memories (Thoughts)
    if (sourceType !== 'thought') {
      const { data: memories } = await supabase
        .from('memories')
        .select('id, title, body, embedding')
        .eq('user_id', userId)
        .neq('id', sourceId) // Don't match self
        .not('embedding', 'is', null)
        .limit(50)

      if (memories) {
        for (const m of memories) {
          if (m.embedding) {
            const similarity = cosineSimilarity(vector, m.embedding)
            if (similarity > 0.55) {
              candidates.push({ type: 'thought', id: m.id, title: m.title || m.body?.slice(0, 50) + '...', similarity })
            }
          }
        }
      }
    }

    // 4. Search Articles
    if (sourceType !== 'article') {
      const { data: articles } = await supabase
        .from('reading_queue')
        .select('id, title, excerpt, embedding')
        .eq('user_id', userId)
        .neq('id', sourceId) // Don't match self
        .not('embedding', 'is', null)
        .limit(50)

      if (articles) {
        for (const a of articles) {
          if (a.embedding) {
            const similarity = cosineSimilarity(vector, a.embedding)
            if (similarity > 0.55) {
              candidates.push({ type: 'article', id: a.id, title: a.title, similarity })
            }
          }
        }
      }
    }

    // Sort by similarity
    candidates.sort((a, b) => b.similarity - a.similarity)

    // 5. Create Suggestions & Auto-links
    const suggestions = []
    const autoLinked = []

    for (const candidate of candidates.slice(0, 10)) {
      // Check for existing connection to avoid duplicates
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
        .maybeSingle()

      if (existing) continue

      if (candidate.similarity > 0.85) {
        // Auto-create connection
        await supabase
          .from('connections')
          .insert({
            source_type: sourceType,
            source_id: sourceId,
            target_type: candidate.type,
            target_id: candidate.id,
            connection_type: 'relates_to',
            created_by: 'ai',
            ai_reasoning: `${Math.round(candidate.similarity * 100)}% semantic match`
          })
        autoLinked.push(candidate)
      } else {
        // Create suggestion
        suggestions.push({
          from_item_type: sourceType,
          from_item_id: sourceId,
          to_item_type: candidate.type,
          to_item_id: candidate.id,
          reasoning: `${Math.round(candidate.similarity * 100)}% semantic similarity`,
          confidence: candidate.similarity,
          user_id: userId,
          status: 'pending'
        })
      }
    }

    // Batch insert suggestions
    if (suggestions.length > 0) {
      const { error } = await supabase
        .from('connection_suggestions')
        .insert(suggestions)

      if (error) console.error('Failed to insert suggestions:', error)
    }

    return res.status(200).json({
      success: true,
      autoLinked: autoLinked.length,
      suggestions: suggestions.length,
      candidates: candidates.slice(0, 5)
    })

  } catch (error) {
    console.error('[connections] Error:', error)
    return res.status(500).json({
      error: 'Connection search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
