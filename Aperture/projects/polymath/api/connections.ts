/**
 * Unified Connections API
 * Handles all connection-related endpoints:
 *
 * AI SUGGESTIONS:
 * - Auto-suggest connections (POST /api/connections?action=auto-suggest)
 * - Update suggestion status (PATCH /api/connections?action=update-suggestion&id=...)
 * - Legacy bridge creation (POST /api/connections?action=suggest)
 *
 * MANUAL CONNECTIONS (SPARKS):
 * - Find related items (GET /api/connections?action=find-related&id=X&type=Y)
 * - List connections (GET /api/connections?action=list-sparks&id=X&type=Y)
 * - AI-suggested sparks (GET /api/connections?action=ai-sparks&limit=3)
 * - Thread (recursive) (GET /api/connections?action=thread&id=X&type=Y)
 * - Create connection (POST /api/connections?action=create-spark)
 * - Delete connection (DELETE /api/connections?action=delete-spark&connection_id=X)
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
  const { action, id, type, connection_id, limit } = req.query

  try {
    // ============================================================================
    // AI SUGGESTIONS
    // ============================================================================

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

    // ============================================================================
    // MANUAL CONNECTIONS (SPARKS) - Merged from api/related.ts
    // ============================================================================

    // Find related items (semantic search)
    if (req.method === 'GET' && action === 'find-related' && id && type) {
      return await handleFindRelated(req, res, id as string, type as string)
    }

    // List connections for an item
    if (req.method === 'GET' && action === 'list-sparks' && id && type) {
      return await handleListSparks(req, res, id as string, type as string)
    }

    // Get AI-suggested sparks for homepage
    if (req.method === 'GET' && action === 'ai-sparks') {
      return await handleAISparks(req, res, parseInt(limit as string) || 3)
    }

    // Get thread (recursive connections)
    if (req.method === 'GET' && action === 'thread' && id && type) {
      return await handleThread(req, res, id as string, type as string)
    }

    // Create manual connection (Spark)
    if (req.method === 'POST' && action === 'create-spark') {
      return await handleCreateSpark(req, res)
    }

    // Delete connection
    if (req.method === 'DELETE' && action === 'delete-spark' && connection_id) {
      return await handleDeleteSpark(req, res, connection_id as string)
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

// ============================================================================
// MANUAL CONNECTIONS (SPARKS) - Merged from api/related.ts
// ============================================================================

/**
 * Find related items using semantic search and knowledge graph
 */
async function handleFindRelated(
  req: VercelRequest,
  res: VercelResponse,
  sourceId: string,
  sourceType: string
): Promise<VercelResponse> {
  const { text } = req.query
  const related = await findRelatedItems(
    sourceId,
    sourceType as 'thought' | 'project' | 'article',
    text as string | undefined
  )
  return res.status(200).json({ related })
}

async function findRelatedItems(
  sourceId: string,
  sourceType: 'thought' | 'project' | 'article',
  sourceText?: string
): Promise<any[]> {
  const related: any[] = []

  // Strategy 1: Find items linked via source_reference
  if (sourceType === 'article') {
    const { data: linkedThoughts } = await supabase
      .from('memories')
      .select('id, title, body')
      .contains('source_reference', { type: 'article', id: sourceId })
      .limit(5)

    if (linkedThoughts) {
      related.push(...linkedThoughts.map(t => ({
        id: t.id,
        type: 'thought',
        title: t.title || 'Untitled thought',
        snippet: t.body?.substring(0, 100),
        relevance: 1.0
      })))
    }
  }

  // Strategy 2: Find projects with matching capabilities
  if (sourceType === 'thought' || sourceType === 'project') {
    const { data: sourceProject } = await supabase
      .from('projects')
      .select('metadata')
      .eq('id', sourceType === 'project' ? sourceId : null)
      .single()

    const capabilities = sourceProject?.metadata?.capabilities || []

    if (capabilities.length > 0) {
      const { data: relatedProjects } = await supabase
        .from('projects')
        .select('id, title, description, metadata')
        .neq('id', sourceId)
        .limit(10)

      const scored = relatedProjects
        ?.map(p => {
          const projectCaps = p.metadata?.capabilities || []
          const overlap = capabilities.filter((c: string) => projectCaps.includes(c)).length
          const relevance = overlap / Math.max(capabilities.length, projectCaps.length, 1)

          return {
            id: p.id,
            type: 'project',
            title: p.title,
            snippet: p.description,
            relevance
          }
        })
        .filter(p => p.relevance > 0.2)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)

      if (scored) {
        related.push(...scored)
      }
    }
  }

  // Strategy 3: Find articles with matching tags/themes
  if (sourceText && sourceType !== 'article') {
    const keywords = extractKeywords(sourceText)

    if (keywords.length > 0) {
      const { data: articles } = await supabase
        .from('reading_articles')
        .select('id, title, url, summary')
        .eq('user_id', USER_ID)
        .neq('status', 'archived')
        .limit(10)

      const scored = articles
        ?.map(a => {
          const articleText = `${a.title} ${a.summary || ''}`.toLowerCase()
          const matches = keywords.filter(k => articleText.includes(k.toLowerCase())).length
          const relevance = matches / keywords.length

          return {
            id: a.id,
            type: 'article',
            title: a.title,
            snippet: a.summary?.substring(0, 100),
            url: a.url,
            relevance
          }
        })
        .filter(a => a.relevance > 0.3)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)

      if (scored) {
        related.push(...scored)
      }
    }
  }

  // Strategy 4: Recent activity (fallback)
  if (related.length < 3) {
    const { data: recentProjects } = await supabase
      .from('projects')
      .select('id, title, description')
      .eq('user_id', USER_ID)
      .eq('status', 'active')
      .neq('id', sourceId)
      .order('last_active', { ascending: false })
      .limit(3)

    if (recentProjects) {
      related.push(...recentProjects.map(p => ({
        id: p.id,
        type: 'project',
        title: p.title,
        snippet: p.description,
        relevance: 0.5
      })))
    }
  }

  // Deduplicate and limit
  const seen = new Set()
  return related
    .filter(item => {
      const key = `${item.type}:${item.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are'])

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10)
}

/**
 * List all connections (Sparks) for a given item
 */
async function handleListSparks(
  req: VercelRequest,
  res: VercelResponse,
  itemId: string,
  itemType: string
): Promise<VercelResponse> {
  const { data, error } = await supabase.rpc('get_item_connections', {
    item_type: itemType,
    item_id: itemId
  })

  if (error) {
    console.error('[handleListSparks] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch connections' })
  }

  // Fetch the actual items for each connection
  const connections = await Promise.all(
    (data || []).map(async (conn: any) => {
      const relatedItem = await fetchItemByTypeAndId(conn.related_type, conn.related_id)
      return {
        connection_id: conn.connection_id,
        related_type: conn.related_type,
        related_id: conn.related_id,
        connection_type: conn.connection_type,
        direction: conn.direction,
        created_by: conn.created_by,
        created_at: conn.created_at,
        ai_reasoning: conn.ai_reasoning,
        related_item: relatedItem
      }
    })
  )

  return res.status(200).json({ connections })
}

/**
 * Get AI-suggested sparks for the homepage
 */
async function handleAISparks(
  req: VercelRequest,
  res: VercelResponse,
  limit: number
): Promise<VercelResponse> {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('created_by', 'ai')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[handleAISparks] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch AI sparks' })
  }

  // Fetch the actual items for each connection
  const sparks = await Promise.all(
    (data || []).map(async (conn: any) => {
      const sourceItem = await fetchItemByTypeAndId(conn.source_type, conn.source_id)
      const targetItem = await fetchItemByTypeAndId(conn.target_type, conn.target_id)

      return {
        connection_id: conn.id,
        source_type: conn.source_type,
        source_id: conn.source_id,
        target_type: conn.target_type,
        target_id: conn.target_id,
        connection_type: conn.connection_type,
        ai_reasoning: conn.ai_reasoning,
        created_at: conn.created_at,
        source_item: sourceItem,
        target_item: targetItem
      }
    })
  )

  return res.status(200).json({ connections: sparks })
}

/**
 * Get thread (recursive connections) for an item
 */
async function handleThread(
  req: VercelRequest,
  res: VercelResponse,
  itemId: string,
  itemType: string
): Promise<VercelResponse> {
  const { data, error } = await supabase.rpc('get_item_thread', {
    item_type: itemType,
    item_id: itemId,
    max_depth: 10
  })

  if (error) {
    console.error('[handleThread] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch thread' })
  }

  return res.status(200).json({ items: data || [] })
}

/**
 * Create a manual connection (Spark)
 */
async function handleCreateSpark(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { source_type, source_id, target_type, target_id, connection_type, created_by, ai_reasoning } = req.body

  if (!source_type || !source_id || !target_type || !target_id) {
    return res.status(400).json({ error: 'source_type, source_id, target_type, and target_id required' })
  }

  const { data, error } = await supabase
    .from('connections')
    .insert({
      source_type,
      source_id,
      target_type,
      target_id,
      connection_type: connection_type || 'relates_to',
      created_by: created_by || 'user',
      ai_reasoning
    })
    .select()
    .single()

  if (error) {
    console.error('[handleCreateSpark] Error:', error)
    return res.status(500).json({ error: 'Failed to create connection' })
  }

  return res.status(201).json({ connection: data })
}

/**
 * Delete a connection
 */
async function handleDeleteSpark(
  req: VercelRequest,
  res: VercelResponse,
  connectionId: string
): Promise<VercelResponse> {
  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('id', connectionId)

  if (error) {
    console.error('[handleDeleteSpark] Error:', error)
    return res.status(500).json({ error: 'Failed to delete connection' })
  }

  return res.status(200).json({ success: true })
}

/**
 * Fetch a single item by type and ID
 */
async function fetchItemByTypeAndId(itemType: string, itemId: string): Promise<any> {
  let table = ''
  let selectFields = '*'

  switch (itemType) {
    case 'project':
      table = 'projects'
      selectFields = 'id, title, description, status, metadata'
      break
    case 'thought':
      table = 'memories'
      selectFields = 'id, title, body, voice_file_url'
      break
    case 'article':
      table = 'reading_articles'
      selectFields = 'id, title, url, summary, author'
      break
    case 'suggestion':
      table = 'project_suggestions'
      selectFields = 'id, title, description, reasoning'
      break
    default:
      return null
  }

  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .eq('id', itemId)
    .single()

  if (error) {
    console.error(`[fetchItemByTypeAndId] Error fetching ${itemType}:`, error)
    return null
  }

  return data
}
