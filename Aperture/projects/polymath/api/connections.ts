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
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'

// Lazy-load Gemini imports only when needed (they require GEMINI_API_KEY env var)
let generateEmbedding: any
let batchGenerateEmbeddings: any
let cosineSimilarity: any
let generateBatchReasoning: any

async function ensureGeminiImports() {
  if (!generateEmbedding) {
    const embeddings = await import('./lib/gemini-embeddings.js')
    generateEmbedding = embeddings.generateEmbedding
    batchGenerateEmbeddings = embeddings.batchGenerateEmbeddings
    cosineSimilarity = embeddings.cosineSimilarity
  }
  if (!generateBatchReasoning) {
    const chat = await import('./lib/gemini-chat.js')
    generateBatchReasoning = chat.generateBatchReasoning
  }
}

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

    // Get connection suggestions for an item
    // Note: This feature is not yet implemented in the database schema
    if (req.method === 'GET' && action === 'suggestions' && id && type) {
      console.log('[Connections API] Suggestions feature not implemented, returning empty array')
      return res.status(200).json({ suggestions: [] })
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
    return res.status(500).json({
      error: 'Internal server error',
      details: error?.message || error?.toString() || 'Unknown error'
    })
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
  const supabase = getSupabaseClient()
  const userId = getUserId() // Get from auth instead of body
  const body: AutoSuggestRequest = req.body
  const { itemType, itemId, content, existingConnectionIds = [] } = body

  if (!itemType || !itemId || !content) {
    return res.status(400).json({ error: 'Missing required fields: itemType, itemId, content' })
  }

  // Ensure Gemini imports are loaded
  try {
    await ensureGeminiImports()
  } catch (error) {
    console.error('[auto-suggest] Gemini initialization error:', error)
    return res.status(503).json({
      error: 'AI suggestion service not available',
      details: 'Gemini API not configured. Set GEMINI_API_KEY environment variable.',
      suggestions: [] // Return empty array for graceful degradation
    })
  }

  // Step 1: Generate embedding for the input content using Gemini (FREE!)
  let embedding
  try {
    embedding = await generateEmbedding(content)
  } catch (error) {
    console.error('[auto-suggest] Embedding generation error:', error)
    return res.status(503).json({
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestions: [] // Return empty array for graceful degradation
    })
  }

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

  // Fetch thoughts/memories (memories table has no user_id - single user app)
  if (itemType !== 'thought') {
    const { data: thoughts } = await supabase
      .from('memories')
      .select('id, title, body')
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
  let itemEmbeddings
  try {
    const itemContents = allItems.map(item => item.content)
    itemEmbeddings = await batchGenerateEmbeddings(itemContents)
  } catch (error) {
    console.error('[auto-suggest] Batch embedding error:', error)
    return res.status(503).json({
      error: 'Failed to generate item embeddings',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestions: []
    })
  }

  // Step 4: Calculate similarities and filter candidates
  const candidates: SuggestionCandidate[] = []
  allItems.forEach((item, index) => {
    const similarity = cosineSimilarity(embedding, itemEmbeddings[index])

    // Lowered threshold from 0.7 to 0.55 to find more connections
    // (e.g., two "Peter and the Wolf" notes should connect at ~60-65% similarity)
    if (similarity > 0.55) {
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
  let reasonings
  try {
    reasonings = await generateBatchReasoning(
      content,
      itemType,
      topCandidates.map(c => ({
        title: c.title,
        type: c.type,
        similarity: c.similarity
      }))
    )
  } catch (error) {
    console.error('[auto-suggest] Reasoning generation error:', error)
    // Use fallback reasoning if AI fails
    reasonings = topCandidates.map(() => ({ reasoning: 'Related content' }))
  }

  // Step 7: Store suggestions in database
  try {
    const suggestions = await Promise.all(
      topCandidates.map(async (candidate, idx) => {
        const reasoning = reasonings[idx]?.reasoning || 'Related content'

        const { data: suggestion, error: insertError } = await supabase
          .from('connection_suggestions')
          .insert({
            source_type: itemType,
            source_id: itemId,
            target_type: candidate.type,
            target_id: candidate.id,
            reasoning,
            confidence_score: candidate.similarity,
            user_id: userId,
            status: 'pending'
          })
          .select()
          .single()

        if (insertError) {
          console.error('[auto-suggest] Insert error:', insertError)
          // Return suggestion without DB id if insert fails
          return {
            id: null,
            toItemType: candidate.type,
            toItemId: candidate.id,
            toItemTitle: candidate.title,
            reasoning,
            confidence: candidate.similarity
          }
        }

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
  } catch (error) {
    console.error('[auto-suggest] Database error:', error)
    // Return suggestions even if DB storage fails
    const suggestions = topCandidates.map((candidate, idx) => ({
      id: null,
      toItemType: candidate.type,
      toItemId: candidate.id,
      toItemTitle: candidate.title,
      reasoning: reasonings[idx]?.reasoning || 'Related content',
      confidence: candidate.similarity
    }))
    return res.status(200).json({ suggestions })
  }
}

// ============================================================================
// UPDATE SUGGESTION STATUS
// ============================================================================

async function handleUpdateSuggestion(req: VercelRequest, res: VercelResponse, suggestionId: string) {
  const supabase = getSupabaseClient()
  const { status } = req.body

  if (!status || !['accepted', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const { data, error } = await supabase
    .from('connection_suggestions')
    .update({
      status
      // updated_at is automatically set by trigger
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
  const supabase = getSupabaseClient()
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
      return res.status(500).json({ error: 'Failed to insert bridges' })
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
  const supabase = getSupabaseClient()
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
  const supabase = getSupabaseClient()
  const bridges: any[] = []

  const { data: matches, error } = await supabase.rpc('match_memories', {
    query_embedding: sourceMemory.embedding,
    match_threshold: 0.75,
    match_count: 5
  })

  if (error || !matches) {
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
  const supabase = getSupabaseClient()
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
  const supabase = getSupabaseClient()
  const userId = getUserId()
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
        .eq('user_id', userId)
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
      .eq('user_id', userId)
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
  const supabase = getSupabaseClient()

  try {
    // Validate inputs
    if (!itemId || !itemType) {
      return res.status(200).json({ connections: [] })
    }

    // Test if connections table exists by doing a simple query
    const { error: tableCheckError } = await supabase
      .from('connections')
      .select('id')
      .limit(1)

    if (tableCheckError?.code === 'PGRST116' || tableCheckError?.message?.includes('does not exist')) {
      return res.status(200).json({
        connections: [],
        error: 'Connections table not initialized',
        details: 'The connections table has not been created in the database. Run migrations first.'
      })
    }

    // Query outbound connections (this item is the source)
    const { data: outbound, error: outboundError } = await supabase
      .from('connections')
      .select('id, target_type, target_id, connection_type, created_by, created_at, ai_reasoning')
      .eq('source_type', itemType)
      .eq('source_id', itemId)

    if (outboundError) {
      return res.status(200).json({
        connections: [],
        note: 'Could not fetch connections (outbound)'
      })
    }

    // Query inbound connections (this item is the target)
    const { data: inbound, error: inboundError } = await supabase
      .from('connections')
      .select('id, source_type, source_id, connection_type, created_by, created_at, ai_reasoning')
      .eq('target_type', itemType)
      .eq('target_id', itemId)

    if (inboundError) {
      return res.status(200).json({
        connections: [],
        note: 'Could not fetch connections (inbound)'
      })
    }

    // Combine results and normalize format
    const allConnections = [
      ...(outbound || []).map((conn: any) => ({
        connection_id: conn.id,
        related_type: conn.target_type,
        related_id: conn.target_id,
        connection_type: conn.connection_type,
        direction: 'outbound',
        created_by: conn.created_by,
        created_at: conn.created_at,
        ai_reasoning: conn.ai_reasoning
      })),
      ...(inbound || []).map((conn: any) => ({
        connection_id: conn.id,
        related_type: conn.source_type,
        related_id: conn.source_id,
        connection_type: conn.connection_type,
        direction: 'inbound',
        created_by: conn.created_by,
        created_at: conn.created_at,
        ai_reasoning: conn.ai_reasoning
      }))
    ]

    // Fetch the actual items for each connection
    const connections = await Promise.all(
      allConnections.map(async (conn: any) => {
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

    // Filter out connections to deleted items
    const validConnections = connections.filter(conn => !conn.related_item?._missing)

    return res.status(200).json({ connections: validConnections })
  } catch (error: any) {
    return res.status(200).json({
      connections: [],
      error: 'Could not fetch connections',
      details: error?.message || error?.toString()
    })
  }
}

/**
 * Get AI-suggested sparks for the homepage
 */
async function handleAISparks(
  req: VercelRequest,
  res: VercelResponse,
  limit: number
): Promise<VercelResponse> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('created_by', 'ai')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
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
 * Get connection suggestions for an item (from project_suggestions table)
 */
async function handleGetSuggestions(
  req: VercelRequest,
  res: VercelResponse,
  itemId: string,
  itemType: string
): Promise<VercelResponse> {
  const supabase = getSupabaseClient()
  const { target_type, limit = '10' } = req.query

  try {
    console.log('[handleGetSuggestions] Fetching suggestions for:', { itemType, itemId, target_type, limit })

    // Query project_suggestions table
    let query = supabase
      .from('project_suggestions')
      .select('*')
      .eq('from_item_type', itemType)
      .eq('from_item_id', itemId)
      .eq('status', 'pending')
      .order('similarity_score', { ascending: false })
      .limit(parseInt(limit as string))

    // Filter by target type if specified
    if (target_type) {
      query = query.eq('to_item_type', target_type)
    }

    const { data: suggestions, error } = await query

    if (error) {
      console.error('[handleGetSuggestions] Query error:', error)
      return res.status(500).json({
        error: 'Failed to fetch suggestions',
        details: error.message,
        code: error.code
      })
    }

    // Fetch the actual items for each suggestion
    const enrichedSuggestions = await Promise.all(
      (suggestions || []).map(async (sugg: any) => {
        const item = await fetchItemByTypeAndId(sugg.to_item_type, sugg.to_item_id)
        return {
          ...item,
          suggestion_id: sugg.id,
          similarity_score: sugg.similarity_score,
          ai_reasoning: sugg.ai_reasoning
        }
      })
    )

    // Filter out null items (deleted items)
    const validSuggestions = enrichedSuggestions.filter(s => s && !s._missing)

    return res.status(200).json({ suggestions: validSuggestions })
  } catch (error) {
    console.error('[handleGetSuggestions] Unexpected error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
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
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.rpc('get_item_thread', {
    item_type: itemType,
    item_id: itemId,
    max_depth: 10
  })

  if (error) {
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
  const supabase = getSupabaseClient()
  const { source_type, source_id, target_type, target_id, connection_type, created_by, ai_reasoning } = req.body

  // Validate required fields with detailed error message
  const missing = []
  if (!source_type) missing.push('source_type')
  if (!source_id) missing.push('source_id')
  if (!target_type) missing.push('target_type')
  if (!target_id) missing.push('target_id')

  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      missing,
      received: {
        source_type: source_type || null,
        source_id: source_id || null,
        target_type: target_type || null,
        target_id: target_id || null
      }
    })
  }

  try {
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
      console.error('[connections] Create error:', error)
      return res.status(500).json({
        error: 'Failed to create connection',
        details: error.message
      })
    }

    return res.status(201).json({ connection: data })
  } catch (error) {
    console.error('[connections] Unexpected error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Delete a connection
 */
async function handleDeleteSpark(
  req: VercelRequest,
  res: VercelResponse,
  connectionId: string
): Promise<VercelResponse> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('id', connectionId)

  if (error) {
    return res.status(500).json({ error: 'Failed to delete connection' })
  }

  return res.status(200).json({ success: true })
}

/**
 * Fetch a single item by type and ID
 */
async function fetchItemByTypeAndId(itemType: string, itemId: string): Promise<any> {
  const supabase = getSupabaseClient()
  let table = ''
  let selectFields = '*'

  switch (itemType) {
    case 'project':
      table = 'projects'
      selectFields = 'id, title, description, status, metadata'
      break
    case 'thought':
      table = 'memories'
      selectFields = 'id, title, body, orig_transcript'
      break
    case 'article':
      table = 'reading_queue'
      selectFields = 'id, title, url, author, excerpt'
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

  if (error || !data) {
    // Return a fallback object instead of null so UI can show something useful
    console.warn(`[fetchItemByTypeAndId] Could not fetch ${itemType} with id ${itemId}:`, error?.message)
    return {
      id: itemId,
      title: `[Deleted ${itemType}]`,
      body: 'This item has been deleted or is no longer available',
      _missing: true
    }
  }

  return data
}
