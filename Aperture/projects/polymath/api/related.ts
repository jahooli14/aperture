/**
 * Related Items API
 * Finds contextually related thoughts, projects, and articles using the knowledge graph
 * Also handles explicit connections (Sparks system) - GET, POST, DELETE
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Handle DELETE - Remove a connection
    if (req.method === 'DELETE') {
      const { connection_id } = req.query

      if (!connection_id) {
        return res.status(400).json({ error: 'connection_id required' })
      }

      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', connection_id as string)

      if (error) {
        console.error('[api/related] DELETE error:', error)
        return res.status(500).json({ error: 'Failed to delete connection' })
      }

      return res.status(200).json({ success: true })
    }

    // Handle POST - Create a connection
    if (req.method === 'POST') {
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
        console.error('[api/related] POST error:', error)
        return res.status(500).json({ error: 'Failed to create connection' })
      }

      return res.status(201).json({ connection: data })
    }

    // Handle GET
    if (req.method === 'GET') {
      const { id, type, text, connections, thread, ai_suggested, limit } = req.query

      // Case 1: Get connections for an item
      if (connections === 'true' && id && type) {
        const connectionsData = await getItemConnections(id as string, type as string)
        return res.status(200).json({ connections: connectionsData })
      }

      // Case 2: Get AI-suggested sparks (homepage)
      if (connections === 'true' && ai_suggested === 'true') {
        const sparks = await getAISuggestedSparks(parseInt(limit as string) || 3)
        return res.status(200).json({ connections: sparks })
      }

      // Case 3: Get thread (recursive connections)
      if (thread === 'true' && id && type) {
        const threadData = await getItemThread(id as string, type as string)
        return res.status(200).json({ items: threadData })
      }

      // Case 4: Original semantic search (backward compatibility)
      if (id && type) {
        const related = await findRelatedItems(
          id as string,
          type as 'thought' | 'project' | 'article',
          text as string | undefined
        )
        return res.status(200).json({ related })
      }

      return res.status(400).json({ error: 'Invalid query parameters' })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[api/related] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
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
    // Get source project's capabilities
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

  // Strategy 3: Find articles with matching tags/themes (simple text match for now)
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
  // Simple keyword extraction - split on whitespace, remove common words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are'])

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10)
}

// ============================================================================
// CONNECTIONS (SPARKS) FUNCTIONS
// ============================================================================

/**
 * Get all connections for a given item using the SQL function
 */
async function getItemConnections(itemId: string, itemType: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_item_connections', {
    item_type: itemType,
    item_id: itemId
  })

  if (error) {
    console.error('[getItemConnections] Error:', error)
    return []
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

  return connections
}

/**
 * Get thread (recursive connections) for an item
 */
async function getItemThread(itemId: string, itemType: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_item_thread', {
    item_type: itemType,
    item_id: itemId,
    max_depth: 10
  })

  if (error) {
    console.error('[getItemThread] Error:', error)
    return []
  }

  return data || []
}

/**
 * Get AI-suggested sparks for the homepage
 */
async function getAISuggestedSparks(limit: number = 3): Promise<any[]> {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('created_by', 'ai')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[getAISuggestedSparks] Error:', error)
    return []
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

  return sparks
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
