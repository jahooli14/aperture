import { getSupabaseClient } from './supabase.js'
import { generateEmbedding, cosineSimilarity } from './gemini-embeddings.js'

interface MaintenanceStats {
  processed: number
  embeddings_created: number
  connections_created: number
  errors: number
}

/**
 * Update embeddings for items that don't have them or need refreshing
 */
export async function maintainEmbeddings(userId: string, limit = 50, reEmbed = false): Promise<MaintenanceStats> {
  const supabase = getSupabaseClient()
  const stats: MaintenanceStats = { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }

  console.log(`[embeddings] Starting maintenance. Re-embed: ${reEmbed}, Limit: ${limit}`)

  try {
    // 1. Projects
    const projects = await fetchItems(supabase, 'projects', userId, limit, reEmbed)
    for (const item of projects) {
      await processItem(supabase, 'project', item, userId, stats)
    }

    // 2. Thoughts (Memories)
    const thoughts = await fetchItems(supabase, 'memories', userId, limit, reEmbed)
    for (const item of thoughts) {
      await processItem(supabase, 'thought', item, userId, stats)
    }

    // 3. Articles (Reading Queue)
    const articles = await fetchItems(supabase, 'reading_queue', userId, limit, reEmbed)
    for (const item of articles) {
      await processItem(supabase, 'article', item, userId, stats)
    }

  } catch (error) {
    console.error('[embeddings] Maintenance failed:', error)
  }

  return stats
}

async function fetchItems(supabase: any, table: string, userId: string, limit: number, reEmbed: boolean) {
  let query = supabase.from(table).select('id, title, embedding, user_id').eq('user_id', userId)

  // If not forcing re-embed, only fetch items without embeddings
  if (!reEmbed) {
    query = query.is('embedding', null)
  }

  // Handle specific fields based on table
  if (table === 'projects') query = query.select('id, title, description, embedding, user_id')
  if (table === 'memories') query = query.select('id, title, body, embedding, user_id')
  if (table === 'reading_queue') query = query.select('id, title, excerpt, embedding, user_id').eq('processed', true)

  const { data, error } = await query.limit(limit)

  if (error) {
    console.error(`[embeddings] Failed to fetch ${table}:`, error)
    return []
  }
  return data || []
}

async function processItem(supabase: any, type: 'project' | 'thought' | 'article', item: any, userId: string, stats: MaintenanceStats) {
  try {
    let content = ''
    if (type === 'project') content = `${item.title}\n\n${item.description || ''}`
    if (type === 'thought') content = `${item.title || ''}\n\n${item.body || ''}`
    if (type === 'article') content = `${item.title}\n\n${item.excerpt || ''}`

    if (!content.trim()) return

    // Generate embedding
    const embedding = await generateEmbedding(content)

    // Update item
    const table = type === 'project' ? 'projects' : type === 'thought' ? 'memories' : 'reading_queue'
    const { error } = await supabase.from(table).update({ embedding }).eq('id', item.id)

    if (error) throw error

    stats.embeddings_created++
    stats.processed++

    // Find connections
    const connections = await findAndCreateConnections(supabase, type, item.id, userId, embedding)
    stats.connections_created += connections

  } catch (error) {
    console.error(`[embeddings] Error processing ${type} ${item.id}:`, error)
    stats.errors++
  }
}

async function findAndCreateConnections(supabase: any, sourceType: string, sourceId: string, userId: string, embedding: number[]) {
  let count = 0
  const threshold = 0.7

  // Helper to search a table
  const searchTable = async (table: string, type: string) => {
    const { data } = await supabase
      .from(table)
      .select('id, embedding')
      .eq('user_id', userId)
      .neq('id', sourceType === type ? sourceId : '') // Don't match self
      .not('embedding', 'is', null)
      .limit(20) // Limit comparisons for performance

    if (!data) return

    for (const candidate of data) {
      const similarity = cosineSimilarity(embedding, candidate.embedding)
      if (similarity > threshold) {
        // Create connection
        await createConnection(supabase, sourceType, sourceId, type, candidate.id, similarity)
        count++
      }
    }
  }

  await searchTable('projects', 'project')
  await searchTable('memories', 'thought')
  await searchTable('reading_queue', 'article')

  return count
}

async function createConnection(supabase: any, sourceType: string, sourceId: string, targetType: string, targetId: string, similarity: number) {
  // Check existence
  const { data: existing } = await supabase
    .from('connections')
    .select('id')
    .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${targetType},target_id.eq.${targetId}),and(source_type.eq.${targetType},source_id.eq.${targetId},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
    .maybeSingle()

  if (!existing) {
    await supabase.from('connections').insert({
      source_type: sourceType,
      source_id: sourceId,
      target_type: targetType,
      target_id: targetId,
      connection_type: 'relates_to',
      created_by: 'ai',
      ai_reasoning: `${Math.round(similarity * 100)}% semantic match`
    })
  }
}
