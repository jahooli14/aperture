/**
 * Unified Connections API
 * Handles all connection-related endpoints:
 * - Auto-suggest connections (POST /api/connections?action=auto-suggest)
 * - Update suggestion status (PATCH /api/connections?action=update-suggestion&id=...)
 * - Legacy bridge creation (POST /api/connections?action=suggest)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action, id } = req.query

  try {
    // Auto-suggest connections endpoint
    if (req.method === 'POST' && action === 'auto-suggest') {
      return await handleAutoSuggest(req, res)
    }

    // Update suggestion status endpoint
    if (req.method === 'PATCH' && action === 'update-suggestion' && id) {
      return await handleUpdateSuggestion(req, res, id as string)
    }

    // Legacy bridge suggestion endpoint
    if (req.method === 'POST' && action === 'suggest') {
      return await handleBridgeSuggest(req, res)
    }

    return res.status(400).json({ error: 'Invalid action or method' })
  } catch (error: any) {
    console.error('[api/connections] Error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

// ============================================================================
// AUTO-SUGGEST CONNECTIONS
// ============================================================================

interface AutoSuggestRequest {
  itemType: 'project' | 'thought' | 'article'
  itemId: string
  content: string
  userId: string
  existingConnectionIds?: string[]
}

interface SuggestionCandidate {
  type: 'project' | 'thought' | 'article'
  id: string
  title: string
  content: string
  similarity: number
}

async function handleAutoSuggest(req: VercelRequest, res: VercelResponse) {
  const body: AutoSuggestRequest = req.body
  const { itemType, itemId, content, userId, existingConnectionIds = [] } = body

  if (!itemType || !itemId || !content || !userId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Step 1: Generate embedding for the input content
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content
  })
  const embedding = embeddingResponse.data[0].embedding

  // Step 2: Find similar items across all content types
  const candidates: SuggestionCandidate[] = []

  // Search projects
  if (itemType !== 'project') {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description')
      .eq('user_id', userId)
      .limit(50)

    if (projects) {
      for (const project of projects) {
        if (existingConnectionIds.includes(project.id)) continue

        const projectContent = `${project.title} ${project.description || ''}`
        const projectEmbedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: projectContent
        })

        const similarity = cosineSimilarity(embedding, projectEmbedding.data[0].embedding)

        if (similarity > 0.7) {
          candidates.push({
            type: 'project',
            id: project.id,
            title: project.title,
            content: projectContent,
            similarity
          })
        }
      }
    }
  }

  // Search thoughts/memories
  if (itemType !== 'thought') {
    const { data: thoughts } = await supabase
      .from('memories')
      .select('id, title, body')
      .eq('user_id', userId)
      .limit(50)

    if (thoughts) {
      for (const thought of thoughts) {
        if (existingConnectionIds.includes(thought.id)) continue

        const thoughtContent = `${thought.title || ''} ${thought.body}`
        const thoughtEmbedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: thoughtContent
        })

        const similarity = cosineSimilarity(embedding, thoughtEmbedding.data[0].embedding)

        if (similarity > 0.7) {
          candidates.push({
            type: 'thought',
            id: thought.id,
            title: thought.title || thought.body.slice(0, 60) + '...',
            content: thoughtContent,
            similarity
          })
        }
      }
    }
  }

  // Search articles
  if (itemType !== 'article') {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, summary')
      .eq('user_id', userId)
      .limit(50)

    if (articles) {
      for (const article of articles) {
        if (existingConnectionIds.includes(article.id)) continue

        const articleContent = `${article.title} ${article.summary || ''}`
        const articleEmbedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: articleContent
        })

        const similarity = cosineSimilarity(embedding, articleEmbedding.data[0].embedding)

        if (similarity > 0.7) {
          candidates.push({
            type: 'article',
            id: article.id,
            title: article.title,
            content: articleContent,
            similarity
          })
        }
      }
    }
  }

  // Step 3: Sort by similarity and take top 5
  const topCandidates = candidates
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)

  // Step 4: Use AI to generate reasoning for each suggestion
  const suggestions = await Promise.all(
    topCandidates.map(async (candidate) => {
      const reasoningPrompt = `You are analyzing connections between content items. Explain in one concise sentence why these two items are related:

Item 1 (${itemType}): ${content.slice(0, 200)}

Item 2 (${candidate.type}): ${candidate.content.slice(0, 200)}

Focus on the key theme or concept that connects them. Be specific and insightful.`

      const reasoningResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: reasoningPrompt }],
        max_tokens: 60,
        temperature: 0.7
      })

      const reasoning = reasoningResponse.choices[0].message.content?.trim() || 'Related content'

      // Store suggestion in database
      const { data: suggestion } = await supabase
        .from('connection_suggestions')
        .insert({
          from_item_type: itemType,
          from_item_id: itemId,
          to_item_type: candidate.type,
          to_item_id: candidate.id,
          reasoning,
          confidence: candidate.similarity,
          user_id: userId,
          status: 'pending'
        })
        .select()
        .single()

      return {
        id: suggestion?.id,
        toItemType: candidate.type,
        toItemId: candidate.id,
        toItemTitle: candidate.title,
        reasoning,
        confidence: candidate.similarity
      }
    })
  )

  return res.status(200).json({ suggestions })
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

// ============================================================================
// UPDATE SUGGESTION STATUS
// ============================================================================

async function handleUpdateSuggestion(req: VercelRequest, res: VercelResponse, suggestionId: string) {
  const { status } = req.body

  if (!status || !['accepted', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const { data, error } = await supabase
    .from('connection_suggestions')
    .update({
      status,
      resolved_at: new Date().toISOString()
    })
    .eq('id', suggestionId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return res.status(200).json({ suggestion: data })
}

// ============================================================================
// LEGACY BRIDGE SUGGESTION
// ============================================================================

interface ConnectionRequest {
  contentType: 'memory' | 'project' | 'article'
  contentId: string
  contentText: string
  contentTitle: string
}

async function handleBridgeSuggest(req: VercelRequest, res: VercelResponse) {
  const { contentType, contentId, contentText, contentTitle }: ConnectionRequest = req.body

  if (!contentType || !contentId) {
    return res.status(400).json({ error: 'contentType and contentId required' })
  }

  // Only support memory-to-memory bridges for now
  if (contentType !== 'memory') {
    return res.status(200).json({
      success: true,
      message: 'Connection detection only supports memories currently',
      bridges_created: 0
    })
  }

  // Get the source memory to extract entities
  const { data: sourceMemory, error: fetchError } = await supabase
    .from('memories')
    .select('*')
    .eq('id', contentId)
    .single()

  if (fetchError || !sourceMemory) {
    return res.status(404).json({ error: 'Memory not found' })
  }

  const bridgesCreated: any[] = []

  // Strategy 1: Entity-based matching
  const entityBridges = await detectEntityMatches(sourceMemory)
  bridgesCreated.push(...entityBridges)

  // Strategy 2: Semantic similarity (embedding-based)
  if (sourceMemory.embedding) {
    const semanticBridges = await detectSemanticSimilarity(sourceMemory)
    bridgesCreated.push(...semanticBridges)
  }

  // Strategy 3: Temporal proximity
  const temporalBridges = await detectTemporalProximity(sourceMemory)
  bridgesCreated.push(...temporalBridges)

  // Deduplicate bridges (same memory pairs)
  const uniqueBridges = deduplicateBridges(bridgesCreated)

  // Insert bridges into database
  if (uniqueBridges.length > 0) {
    const { data, error: insertError } = await supabase
      .from('bridges')
      .insert(uniqueBridges)
      .select()

    if (insertError) {
      console.error('[api/connections] Insert error:', insertError)
    }

    return res.status(200).json({
      success: true,
      bridges_created: data?.length || 0,
      bridges: data
    })
  }

  return res.status(200).json({
    success: true,
    bridges_created: 0,
    message: 'No strong connections found'
  })
}

/**
 * Strategy 1: Find memories with shared entities
 */
async function detectEntityMatches(sourceMemory: any): Promise<any[]> {
  const bridges: any[] = []
  const sourceEntities = sourceMemory.entities

  if (!sourceEntities || Object.keys(sourceEntities).length === 0) {
    return bridges
  }

  const allSourceEntities = [
    ...(sourceEntities.people || []),
    ...(sourceEntities.places || []),
    ...(sourceEntities.topics || [])
  ]

  if (allSourceEntities.length === 0) {
    return bridges
  }

  const { data: memories, error } = await supabase
    .from('memories')
    .select('id, entities, created_at')
    .neq('id', sourceMemory.id)
    .not('entities', 'is', null)
    .limit(100)

  if (error || !memories) return bridges

  for (const memory of memories) {
    const targetEntities = memory.entities
    if (!targetEntities) continue

    const allTargetEntities = [
      ...(targetEntities.people || []),
      ...(targetEntities.places || []),
      ...(targetEntities.topics || [])
    ]

    const sharedEntities = allSourceEntities.filter((e: string) =>
      allTargetEntities.includes(e)
    )

    if (sharedEntities.length >= 2) {
      const strength = Math.min(
        sharedEntities.length / Math.max(allSourceEntities.length, allTargetEntities.length),
        1.0
      )

      bridges.push({
        memory_a: sourceMemory.id,
        memory_b: memory.id,
        bridge_type: 'entity_match',
        strength: Math.round(strength * 100) / 100,
        entities_shared: sharedEntities,
        created_at: new Date().toISOString()
      })
    }
  }

  return bridges
}

/**
 * Strategy 2: Find semantically similar memories using embeddings
 */
async function detectSemanticSimilarity(sourceMemory: any): Promise<any[]> {
  const bridges: any[] = []

  const { data: matches, error } = await supabase.rpc('match_memories', {
    query_embedding: sourceMemory.embedding,
    match_threshold: 0.75,
    match_count: 5
  })

  if (error || !matches) {
    console.warn('[detectSemanticSimilarity] Error:', error)
    return bridges
  }

  for (const match of matches) {
    if (match.id === sourceMemory.id) continue

    bridges.push({
      memory_a: sourceMemory.id,
      memory_b: match.id,
      bridge_type: 'semantic_similarity',
      strength: Math.round(match.similarity * 100) / 100,
      entities_shared: null,
      created_at: new Date().toISOString()
    })
  }

  return bridges
}

/**
 * Strategy 3: Find memories created around the same time
 */
async function detectTemporalProximity(sourceMemory: any): Promise<any[]> {
  const bridges: any[] = []
  const sourceDate = new Date(sourceMemory.created_at)

  const beforeDate = new Date(sourceDate)
  beforeDate.setDate(beforeDate.getDate() - 7)

  const afterDate = new Date(sourceDate)
  afterDate.setDate(afterDate.getDate() + 7)

  const { data: memories, error } = await supabase
    .from('memories')
    .select('id, created_at')
    .neq('id', sourceMemory.id)
    .gte('created_at', beforeDate.toISOString())
    .lte('created_at', afterDate.toISOString())
    .limit(10)

  if (error || !memories) return bridges

  for (const memory of memories) {
    const memoryDate = new Date(memory.created_at)
    const daysDiff = Math.abs(
      (sourceDate.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysDiff <= 1) {
      const strength = 1.0 - (daysDiff / 7)

      bridges.push({
        memory_a: sourceMemory.id,
        memory_b: memory.id,
        bridge_type: 'temporal_proximity',
        strength: Math.round(strength * 100) / 100,
        entities_shared: null,
        created_at: new Date().toISOString()
      })
    }
  }

  return bridges
}

/**
 * Deduplicate bridges by memory pairs
 */
function deduplicateBridges(bridges: any[]): any[] {
  const seen = new Set<string>()
  const unique: any[] = []

  for (const bridge of bridges) {
    const [id1, id2] = [bridge.memory_a, bridge.memory_b].sort()
    const key = `${id1}:${id2}`

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(bridge)
    }
  }

  return unique
}
