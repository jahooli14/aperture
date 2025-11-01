/**
 * Unified Connections API
 * Handles all connection-related endpoints:
 * - Auto-suggest connections (POST /api/connections?action=auto-suggest)
 * - Update suggestion status (PATCH /api/connections?action=update-suggestion&id=...)
 * - Legacy bridge creation (POST /api/connections?action=suggest)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding, batchGenerateEmbeddings, cosineSimilarity } from './lib/gemini-embeddings'
import { generateBatchReasoning } from './lib/gemini-chat'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  // Step 1: Generate embedding for the input content using Gemini (FREE!)
  const embedding = await generateEmbedding(content)

  // Step 2: Collect all items to compare
  const allItems: Array<{ type: string; id: string; title: string; content: string }> = []

  // Fetch projects
  if (itemType !== 'project') {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description')
      .eq('user_id', userId)
      .limit(50)

    if (projects) {
      projects.forEach(project => {
        if (!existingConnectionIds.includes(project.id)) {
          allItems.push({
            type: 'project',
            id: project.id,
            title: project.title,
            content: `${project.title} ${project.description || ''}`
          })
        }
      })
    }
  }

  // Fetch thoughts/memories
  if (itemType !== 'thought') {
    const { data: thoughts } = await supabase
      .from('memories')
      .select('id, title, body')
      .eq('user_id', userId)
      .limit(50)

    if (thoughts) {
      thoughts.forEach(thought => {
        if (!existingConnectionIds.includes(thought.id)) {
          allItems.push({
            type: 'thought',
            id: thought.id,
            title: thought.title || thought.body.slice(0, 60) + '...',
            content: `${thought.title || ''} ${thought.body}`
          })
        }
      })
    }
  }

  // Fetch articles
  if (itemType !== 'article') {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, summary')
      .eq('user_id', userId)
      .limit(50)

    if (articles) {
      articles.forEach(article => {
        if (!existingConnectionIds.includes(article.id)) {
          allItems.push({
            type: 'article',
            id: article.id,
            title: article.title,
            content: `${article.title} ${article.summary || ''}`
          })
        }
      })
    }
  }

  // Step 3: Generate embeddings for all items in batch (MUCH faster!)
  const itemContents = allItems.map(item => item.content)
  const itemEmbeddings = await batchGenerateEmbeddings(itemContents)

  // Step 4: Calculate similarities and filter candidates
  const candidates: SuggestionCandidate[] = []
  allItems.forEach((item, index) => {
    const similarity = cosineSimilarity(embedding, itemEmbeddings[index])

    if (similarity > 0.7) {
      candidates.push({
        type: item.type as 'project' | 'thought' | 'article',
        id: item.id,
        title: item.title,
        content: item.content,
        similarity
      })
    }
  })

  // Step 5: Sort by similarity and take top 5
  const topCandidates = candidates
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)

  if (topCandidates.length === 0) {
    return res.status(200).json({ suggestions: [] })
  }

  // Step 6: Generate reasoning for all candidates in ONE batch call
  const reasonings = await generateBatchReasoning(
    content,
    itemType,
    topCandidates.map(c => ({
      title: c.title,
      type: c.type,
      similarity: c.similarity
    }))
  )

  // Step 7: Store suggestions in database
  const suggestions = await Promise.all(
    topCandidates.map(async (candidate, idx) => {
      const reasoning = reasonings[idx]?.reasoning || 'Related content'

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
          status: 'pending',
          model_version: 'gemini-2.5-flash'
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
