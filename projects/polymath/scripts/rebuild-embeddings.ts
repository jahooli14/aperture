/**
 * Rebuild every stored vector in one go.
 *
 * A vector space is all-or-nothing. Change what goes into the embedder —
 * the model, the dimensions, or the `taskType` — and old rows stop being
 * comparable to new ones, silently: cosine still returns a number, the
 * searches still return rows, and the results are quietly worse. There is
 * no partial state worth being in, so this does the whole corpus or fails.
 *
 * Written for the taskType flag day and kept for the next one —
 * `gemini-embedding-2`, or a dimension change — which needs exactly this and
 * should not have to reinvent it at the moment it is already under pressure.
 * It embeds through the same helper the app uses, so it can never write a
 * space the app does not read (CORPUS_TASK in gemini-embeddings.ts).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
 *     npm run embeddings:rebuild
 *
 * Articles are deliberately skipped unless voted `good` — the same rule as
 * everywhere else (reading-corpus.ts). Rebuilding them would re-embed feed
 * noise the gate exists to keep out.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { batchGenerateEmbeddings } from '../api/_lib/gemini-embeddings.js'
import { articleEmbeddingText } from '../api/_lib/article-text.js'
import { isCorpusEligible } from '../api/_lib/reading-corpus.js'

/** One request per batch, well under the API's limit. */
const BATCH = 50

interface Table {
  name: string
  select: string
  /** The text that gets embedded — must match what the live writer uses. */
  text: (row: any) => string
  keep?: (row: any) => boolean
}

const TABLES: Table[] = [
  { name: 'memories', select: 'id, title, body', text: r => `${r.title ?? ''}\n\n${r.body ?? ''}` },
  { name: 'projects', select: 'id, title, description', text: r => `${r.title}\n\n${r.description ?? ''}` },
  {
    name: 'list_items',
    select: 'id, content, metadata',
    text: r => {
      const m = r.metadata ?? {}
      return `${r.content}. ${m.subtitle ?? ''}. ${m.description ?? ''}. ${(m.tags ?? []).join(', ')}`
    },
  },
  { name: 'joints', select: 'id, text', text: r => r.text ?? '' },
  {
    name: 'reading_queue',
    select: 'id, title, excerpt, content, tags, resonance',
    text: r => articleEmbeddingText(r),
    keep: r => isCorpusEligible(r),
  },
]

async function rebuild(supabase: SupabaseClient, userId: string, t: Table): Promise<string> {
  const { data, error } = await supabase.from(t.name).select(t.select).eq('user_id', userId).limit(5000)
  if (error) return `${t.name}: QUERY FAILED — ${error.message}`

  const rows = (data ?? []).filter((r: any) => (t.keep ? t.keep(r) : true))
    .map((r: any) => ({ id: r.id, text: t.text(r).trim() }))
    .filter(r => r.text.length > 0)
  if (rows.length === 0) return `${t.name}: nothing to rebuild`

  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const vectors = await batchGenerateEmbeddings(slice.map(r => r.text))
    const stamp = new Date().toISOString()
    for (let j = 0; j < slice.length; j++) {
      // One at a time: an upsert would need every column, and getting that
      // wrong on a whole-corpus write is not a mistake worth risking to
      // save a few seconds on 370 rows.
      let { error: writeErr } = await supabase
        .from(t.name).update({ embedding: vectors[j], embedded_at: stamp }).eq('id', slice[j].id)
      if (writeErr?.code === '42703') {
        ;({ error: writeErr } = await supabase
          .from(t.name).update({ embedding: vectors[j] }).eq('id', slice[j].id))
      }
      if (writeErr) return `${t.name}: WRITE FAILED after ${done} — ${writeErr.message}`
      done++
    }
    process.stdout.write(`  ${t.name}: ${done}/${rows.length}\r`)
  }
  return `${t.name}: ${done} rebuilt`
}

async function main() {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']) {
    if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1) }
  }
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  let userId = process.env.POLYMATH_USER_ID ?? ''
  if (!userId) {
    const { data } = await supabase.from('memories').select('user_id').limit(1)
    userId = data?.[0]?.user_id ?? ''
  }
  if (!userId) { console.error('No user found. Set POLYMATH_USER_ID.'); process.exit(1) }

  console.log('Rebuilding every vector in the corpus space.\n')
  for (const t of TABLES) console.log(' ', await rebuild(supabase, userId, t))
  console.log('\nDone. Every row now shares one vector space.')
}

main().catch(e => { console.error('failed:', e); process.exit(1) })
