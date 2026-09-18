/**
 * The whole corpus, handed to one prompt, instead of a subject picked and
 * searched for a connector.
 *
 * The channel used to compute a subject, name what it never examined, strip
 * that of its own vocabulary, and search the corpus for whatever came back
 * in band. That existed to stop the model inventing a link — but measured
 * against the real corpus and the real gates, a well-built prompt handed
 * everything at once passed the same grounding checks just as cleanly, kept
 * every question on a different subject across ten sequential pulls with no
 * repeats, and never went silent. The gates were what kept it honest, not
 * the search — so the search is gone, and the gates stay exactly as strict.
 *
 * What's still true and still enforced here: an app-authored note is not a
 * capture (corpus-provenance.ts), a graveyarded project doesn't count as
 * live — on itself or on a fragment filed under it, which the old pipeline
 * only checked for the project itself — and an article only counts once
 * it's been voted `good` (reading-corpus.ts). Whole-corpus reads are capped,
 * not windowed: a cap only loses the oldest rows once there are genuinely
 * more than CORPUS_LIMIT of them, where a time window loses them every day.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { userSaid } from './corpus-provenance.js'
import { isGraveyarded } from './project-state.js'
import { isCorpusEligible, type CorpusArticle } from './reading-corpus.js'
import { articleBody } from './article-text.js'
import { quoteIsReal } from './mull.js'

const CORPUS_LIMIT = 2000
/** Below this an article's real text is too thin to be worth quoting from
 *  -- matches the floor the old article gatherer used. */
const MIN_ARTICLE_CHARS = 120

export type CorpusRowKind = 'project' | 'memory' | 'fragment' | 'list_item' | 'article'

export interface CorpusRow {
  kind: CorpusRowKind
  id: string
  /** The project it's about or filed under, for attribution -- a project
   *  row is its own id here, a fragment/memory/list_item/article is null
   *  unless it's clearly about one. */
  projectId: string | null
  title: string
  text: string
}

export interface Corpus {
  rows: CorpusRow[]
  /** Lowercased, trimmed title -> real id, so the model's own exact-title
   *  answer can be turned into a `sparks.project_id` without guessing. */
  projectIdByTitle: Map<string, string>
  /** The formatted block that goes straight into the prompt. */
  text: string
}

/** Same normalisation on both sides of a title match -- the model is asked
 *  for the exact title, but "exact" still shouldn't break on case. */
export function normaliseTitle(title: string): string {
  return title.trim().toLowerCase()
}

function noteQuery(trace: string[], label: string, res: { data: unknown[] | null; error: unknown }) {
  const err = res.error as { message?: string } | null
  if (err) trace.push(`!! ${label} query FAILED: ${err.message ?? String(err)}`)
  else trace.push(`${label}: ${res.data?.length ?? 0} rows`)
}

/** Gateway Timeout, ECONNRESET — the one query-failure class actually
 *  observed in production, worth one retry rather than reading it as an
 *  empty table. Everything else (a bad filter, a missing column) is a real
 *  rejection and retrying it would just be slower. */
export function isTransientError(message: string | undefined): boolean {
  if (!message) return false
  return /gateway timeout|timed?\s*out|upstream connect error|econnreset/i.test(message)
}

async function withRetry(
  run: () => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  trace: string[], label: string,
): Promise<{ data: unknown[] | null; error: unknown }> {
  const res = await run()
  const message = (res.error as { message?: string } | null)?.message
  if (res.error && isTransientError(message)) {
    trace.push(`${label}: retrying after transient error (${message})`)
    return await run()
  }
  return res
}

export async function loadCorpus(
  supabase: SupabaseClient, userId: string, trace: string[] = [],
): Promise<Corpus> {
  const [memoriesRes, fragmentsRes, projectsRes, listItemsRes, readingRes] = await Promise.all([
    withRetry(() => supabase.from('memories').select('id, title, body, created_at, tags')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(CORPUS_LIMIT), trace, 'corpus/memories'),
    withRetry(() => supabase.from('fragments').select('id, text, created_at, memory_id, project_id, projects(title, state, status)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(CORPUS_LIMIT), trace, 'corpus/fragments'),
    withRetry(() => supabase.from('projects').select('id, title, description, state, status, created_at, last_active')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(CORPUS_LIMIT), trace, 'corpus/projects'),
    withRetry(() => supabase.from('list_items').select('id, content, user_rating, status, created_at, lists(title, type)')
      .eq('user_id', userId).in('status', ['pending', 'active', 'completed'])
      .order('created_at', { ascending: false }).limit(CORPUS_LIMIT), trace, 'corpus/list_items'),
    withRetry(() => supabase.from('reading_queue').select('id, title, excerpt, content, resonance, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(CORPUS_LIMIT), trace, 'corpus/reading'),
  ])
  noteQuery(trace, 'corpus/memories', memoriesRes)
  noteQuery(trace, 'corpus/fragments', fragmentsRes)
  noteQuery(trace, 'corpus/projects', projectsRes)
  noteQuery(trace, 'corpus/list_items', listItemsRes)
  noteQuery(trace, 'corpus/reading', readingRes)

  const memories = userSaid((memoriesRes.data ?? []) as any[])
  const appAuthoredMemoryIds = new Set(
    ((memoriesRes.data ?? []) as any[]).filter(m => !memories.includes(m)).map(m => m.id),
  )
  const memoryDateById = new Map<string, string>()
  for (const m of memories) if (m.created_at) memoryDateById.set(m.id, m.created_at)

  const projects = ((projectsRes.data ?? []) as any[]).filter(p => !isGraveyarded(p))
  const projectIdByTitle = new Map(projects.map((p: any) => [normaliseTitle(p.title), p.id as string]))

  // A fragment under a graveyarded project doesn't count as live either --
  // the project's own description is excluded above, but a fragment filed
  // under it slips through unless it's checked too. `isGraveyarded` above
  // ran on the fetched project list, but a fragment can reference a
  // project already filtered out of `projects` -- so it's re-checked from
  // the fragment's own embedded join, not by membership in the array above.
  const fragments = ((fragmentsRes.data ?? []) as any[]).filter(f =>
    f.text?.trim() &&
    !(f.memory_id && appAuthoredMemoryIds.has(f.memory_id)) &&
    !(f.projects && isGraveyarded(f.projects)),
  )

  const articles = ((readingRes.data ?? []) as (CorpusArticle & {
    id: string; title: string | null; excerpt: string | null; content: string | null
  })[])
    .filter(isCorpusEligible)
    .map(a => ({ ...a, body: articleBody(a as any) }))
    .filter(a => a.body.length > MIN_ARTICLE_CHARS)

  const listItems = ((listItemsRes.data ?? []) as any[]).filter(l => typeof l.content === 'string' && l.content.trim())

  const rows: CorpusRow[] = [
    ...projects.map((p: any): CorpusRow => ({
      kind: 'project', id: p.id, projectId: p.id,
      title: p.title, text: p.description ?? '',
    })),
    ...memories.map((m: any): CorpusRow => ({
      kind: 'memory', id: m.id, projectId: null,
      title: m.title ?? '', text: m.body ?? '',
    })),
    ...fragments.map((f: any): CorpusRow => ({
      kind: 'fragment', id: f.id, projectId: f.project_id ?? null,
      title: f.projects?.title ?? '', text: f.text,
    })),
    ...listItems.map((l: any): CorpusRow => ({
      kind: 'list_item', id: l.id, projectId: null,
      title: l.lists?.title ?? 'a list', text: l.content,
    })),
    ...articles.map((a: any): CorpusRow => ({
      kind: 'article', id: a.id, projectId: null,
      title: a.title ?? 'an article', text: a.body,
    })),
  ]

  const dateOf = (row: { created_at?: string; memory_id?: string | null }) =>
    // When the thought was had, not when the row was written -- fragments
    // backfilled in one run all carry the same created_at otherwise, which
    // collapses every span this channel's dated facts depend on.
    (row.memory_id && memoryDateById.get(row.memory_id)) || row.created_at || ''

  const text = `
PROJECTS (${projects.length}):
${projects.map((p: any) => `- "${p.title}" (${p.status}, started ${(p.created_at ?? '').slice(0, 10)}, last active ${p.last_active?.slice(0, 10) ?? 'never'}): ${p.description ?? ''}`).join('\n')}

NOTES (${memories.length}):
${memories.map((m: any) => `- [${(dateOf(m)).slice(0, 10)}] ${m.title ?? ''}: ${m.body ?? ''}`).join('\n')}

FRAGMENTS -- short things said in passing, some filed under a project, some not (${fragments.length}):
${fragments.map((f: any) => `- [${dateOf(f).slice(0, 10)}]${f.projects?.title ? ` (${f.projects.title})` : ''} "${f.text}"`).join('\n')}

LIST ITEMS (${listItems.length}):
${listItems.map((l: any) => `- [${l.lists?.title ?? 'list'}] ${l.content}${l.user_rating ? ` (rated ${l.user_rating})` : ''}, added ${(l.created_at ?? '').slice(0, 10)}`).join('\n')}

ARTICLES THEY VOUCHED FOR (${articles.length}):
${articles.map((a: any) => `- "${a.title}": ${a.body.slice(0, 600)}`).join('\n')}
`.trim()

  return { rows, projectIdByTitle, text }
}

/** Which real row a quote actually came from, using the exact same match
 *  the grounding gate uses -- so "did this pass grounding" and "what did it
 *  ground in" can never disagree. */
export function findSource(corpus: Corpus, quote: string): CorpusRow | null {
  return corpus.rows.find(r => quoteIsReal(quote, r.text)) ?? null
}
