import { getSupabaseClient } from './supabase.js'
import { generateEmbedding, cosineSimilarity } from './gemini-embeddings.js'
import { isCorpusEligible } from './reading-corpus.js'
import { articleEmbeddingText } from './article-text.js'
import { summarise, describeCoverage, type TableCoverage, type CoverageRow } from './embedding-coverage.js'

/** Every table whose rows are corpus and therefore need a vector. */
const CORPUS_TABLES = ['projects', 'memories', 'reading_queue', 'list_items', 'joints'] as const
type CorpusTable = typeof CORPUS_TABLES[number]

const ITEM_TYPE: Record<CorpusTable, ItemType> = {
  projects: 'project',
  memories: 'thought',
  reading_queue: 'article',
  list_items: 'list_item',
  joints: 'joint',
}

type ItemType = 'project' | 'thought' | 'article' | 'list_item' | 'joint'

interface MaintenanceStats {
  processed: number
  embeddings_created: number
  connections_created: number
  errors: number
  /** Why it failed, if it did. Without this a run that embedded nothing
   *  because every call was rejected is indistinguishable from a run that
   *  embedded nothing because there was nothing left to embed. */
  last_error?: string
}

/**
 * Update embeddings for items that don't have them or need refreshing
 */
export async function maintainEmbeddings(userId: string, limit = 50, reEmbed = false): Promise<MaintenanceStats> {
  const supabase = getSupabaseClient()
  const stats: MaintenanceStats = { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }

  console.log(`[embeddings] Starting maintenance. Re-embed: ${reEmbed}, Limit: ${limit}`)

  try {
    // Every corpus table, in one loop. Five copy-pasted blocks is how
    // `list_items` ended up with a filter none of the others had.
    for (const table of CORPUS_TABLES) {
      const items = await fetchItems(supabase, table, userId, limit, reEmbed)
      for (const item of items) {
        await processItem(supabase, ITEM_TYPE[table], item, userId, stats)
      }
    }

  } catch (error) {
    console.error('[embeddings] Maintenance failed:', error)
  }

  return stats
}

/**
 * Rebuild every eligible article's vector from the article's real text.
 *
 * Needed because the ordinary backfill only fills nulls, and these rows are
 * not null — they are wrong. They were embedded from `excerpt`, which the
 * ingest caps at 100 characters for the card UI, so a feed article's vector
 * described a teaser rather than a piece of writing (article-text.ts). The
 * rows are stale rather than missing, so nothing would ever revisit them.
 *
 * Only articles: everything else already embeds its real text, and
 * re-embedding what is already right just spends calls.
 */
export async function reembedArticles(userId: string, limit = 200): Promise<MaintenanceStats> {
  const supabase = getSupabaseClient()
  const stats: MaintenanceStats = { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }

  const articles = await fetchItems(supabase, 'reading_queue', userId, limit, true)
  console.log(`[embeddings] Re-embedding ${articles.length} articles from their real text`)
  for (const item of articles) {
    await processItem(supabase, 'article', item, userId, stats)
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
  // Only what the user voted good earns an embedding (reading-corpus.ts).
  // Filtered here AND re-checked by isCorpusEligible in processItem: this
  // path writes reading_queue.embedding directly rather than going through
  // reading.ts's gated writer, so the rule has to be applied on both.
  if (table === 'reading_queue') query = query.select('id, title, excerpt, content, tags, resonance, embedding, user_id').eq('processed', true).eq('resonance', 'good')
  // No enrichment gate. Enrichment adds a subtitle and some tags; the item
  // itself -- "Flowers for Algernon" -- is the signal, and it is there from
  // the moment it is added. Gating on enrichment meant anything that never
  // got enriched (a failed lookup, a title the lookup didn't recognise) was
  // invisible to every search forever, with nothing to retry it.
  if (table === 'list_items') query = query.select('id, content, metadata, embedding, user_id')
  // A joint is "something you keep saying" -- as much a corpus object as a
  // note. Without a stored vector joint-miner re-embedded every existing
  // joint on every run just to deduplicate against them, and nothing could
  // search for one.
  if (table === 'joints') query = query.select('id, text, embedding, user_id')

  const { data, error } = await query.limit(limit)

  if (error) {
    console.error(`[embeddings] Failed to fetch ${table}:`, error)
    return []
  }
  return data || []
}

async function processItem(supabase: any, type: ItemType, item: any, userId: string, stats: MaintenanceStats) {
  try {
    let content = ''
    if (type === 'project') content = `${item.title}\n\n${item.description || ''}`
    if (type === 'thought') content = `${item.title || ''}\n\n${item.body || ''}`
    if (type === 'article') {
      // The eligibility rule lives in one place and this writer has to obey
      // it too — it writes reading_queue.embedding itself instead of going
      // through reading.ts's gated writer.
      if (!isCorpusEligible(item)) return
      content = articleEmbeddingText(item)
    }
    if (type === 'list_item') {
      // Build rich content from item + enriched metadata
      const meta = item.metadata || {}
      content = `${item.content}. ${meta.subtitle || ''}. ${meta.description || ''}. ${(meta.tags || []).join(', ')}`
    }
    if (type === 'joint') content = item.text || ''

    if (!content.trim()) return

    // Generate embedding
    const embedding = await generateEmbedding(content)

    // Update item
    const tableMap: Record<ItemType, string> = {
      'project': 'projects',
      'thought': 'memories',
      'article': 'reading_queue',
      'list_item': 'list_items',
      'joint': 'joints',
    }
    const table = tableMap[type]

    // Stamp WHEN the vector was computed, in the same write. Without it a
    // vector built from text that has since been rewritten is invisible
    // rather than wrong — the search still returns the row and is quietly
    // answering about text that is gone (embedding-coverage.ts).
    //
    // The column arrives with a migration the deploy doesn't run, so a write
    // that names it has to survive the window where it isn't there yet.
    // Otherwise the day of the deploy is a day with no embeddings at all.
    let { error } = await supabase
      .from(table)
      .update({ embedding, embedded_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error?.code === '42703') {
      ({ error } = await supabase.from(table).update({ embedding }).eq('id', item.id))
    }

    if (error) {
      if (error.code === '42703') {
        console.warn(`[embeddings] Column 'embedding' missing on table '${table}'. Skipping.`)
        return
      }
      throw error
    }

    stats.embeddings_created++
    stats.processed++

    // Joints are derived from fragments that are already connected to
    // everything they touch, so a joint-to-note edge says nothing new — and
    // `connections.source_type` is a fixed vocabulary.
    if (type === 'joint') return

    // Find connections
    const connections = await findAndCreateConnections(supabase, type, item.id, userId, embedding)
    stats.connections_created += connections

  } catch (error) {
    console.error(`[embeddings] Error processing ${type} ${item.id}:`, error)
    stats.errors++
    stats.last_error = error instanceof Error ? error.message : String(error)
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
        await createConnection(supabase, userId, sourceType, sourceId, type, candidate.id, similarity)
        count++
      }
    }
  }

  await searchTable('projects', 'project')
  await searchTable('memories', 'thought')
  await searchTable('reading_queue', 'article')
  await searchTable('list_items', 'list_item')

  return count
}

async function createConnection(supabase: any, userId: string, sourceType: string, sourceId: string, targetType: string, targetId: string, similarity: number) {
  // Check existence
  const { data: existing } = await supabase
    .from('connections')
    .select('id')
    .eq('user_id', userId)
    .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${targetType},target_id.eq.${targetId}),and(source_type.eq.${targetType},source_id.eq.${targetId},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
    .maybeSingle()

  if (!existing) {
    await supabase.from('connections').insert({
      user_id: userId,
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


/**
 * What is actually embedded, per table, with the reason anything is out.
 *
 * "Everything is embedded" was an assumption nobody could check, and the
 * failures it hid all look the same from outside: a gatherer returns zero
 * and there is no way to tell an empty corpus from an unembedded one. Read
 * by `backfill-embeddings` and printed into the bake trace, so
 * `job=bake-explain` answers it from a phone.
 */
export async function coverageReport(userId: string): Promise<{ tables: TableCoverage[]; lines: string[] }> {
  const supabase = getSupabaseClient()
  const tables: TableCoverage[] = []
  const lines: string[] = []

  for (const table of CORPUS_TABLES) {
    const { rows, error, dropped } = await selectCoverage(supabase, table, userId)
    if (error) {
      lines.push(`!! coverage ${table} FAILED: ${error}`)
      continue
    }
    if (dropped.length > 0) {
      lines.push(`note: ${table} has no ${dropped.join('/')} column — staleness is unanswerable there`)
    }
    // An article without a "good" verdict is deliberately not corpus
    // (reading-corpus.ts), so its missing vector is the rule working.
    const excluded = table === 'reading_queue'
      ? (r: CoverageRow) => !isCorpusEligible(r as any)
      : () => false
    tables.push(summarise(table, rows, excluded))
  }

  return { tables, lines: [...lines, ...describeCoverage(tables)] }
}

/** Coverage is a whole-table read; cap it the way the gatherers are capped. */
const COVERAGE_LIMIT = 2000

/**
 * Select the coverage columns, dropping any this table doesn't have.
 *
 * PostgREST fails the WHOLE select when one named column is missing, and
 * these columns are genuinely uneven across the five tables — `updated_at`
 * exists on some, `embedded_at` only after the migration runs. Reporting
 * "coverage failed" in that window would be the same unreadable silence
 * this function exists to end, so it drops what isn't there and says so.
 */
async function selectCoverage(
  supabase: any, table: string, userId: string,
): Promise<{ rows: CoverageRow[]; error?: string; dropped: string[] }> {
  const optional = ['embedded_at', 'updated_at', 'created_at']
  // reading_queue needs its verdict to know what is deliberately excluded.
  const base = table === 'reading_queue' ? ['id', 'embedding', 'resonance', 'tags'] : ['id', 'embedding']
  let cols = [...base, ...optional]

  for (let attempt = 0; attempt < optional.length + 1; attempt++) {
    const { data, error } = await supabase
      .from(table).select(cols.join(', ')).eq('user_id', userId).limit(COVERAGE_LIMIT)
    if (!error) return { rows: (data ?? []) as CoverageRow[], dropped: optional.filter(c => !cols.includes(c)) }
    if (error.code !== '42703') return { rows: [], error: error.message, dropped: [] }

    // "column memories.updated_at does not exist" — drop the one it names,
    // or the last optional one if it names nothing we can read.
    const named = optional.find(c => (error.message ?? '').includes(c) && cols.includes(c))
    const next = named ?? [...cols].reverse().find(c => optional.includes(c))
    if (!next) return { rows: [], error: error.message, dropped: [] }
    cols = cols.filter(c => c !== next)
  }
  return { rows: [], error: 'ran out of columns to drop', dropped: [] }
}
