/**
 * Everything one person has captured, as one block of text a model can
 * read and cite.
 *
 * Every row gets a short ref ("N12", "P3") and the facts the prompt shows
 * about it (date, status, the project it sits under). The model cites
 * evidence by ref, and the gates check each quote against exactly that
 * row -- so "is this real" is a lookup, not a search.
 *
 * Exclusions, all still enforced here: an app-authored note is not a
 * capture (corpus-provenance.ts), a graveyarded project is not live -- on
 * itself or on a fragment filed under it -- and an article only counts
 * once it has been voted `good` (reading-corpus.ts). Reads are capped, not
 * windowed: a cap only loses the oldest rows once there are genuinely more
 * than CORPUS_LIMIT of them, where a time window loses them every day.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { userSaid } from './corpus-provenance.js'
import { isGraveyarded } from './project-state.js'
import { isCorpusEligible, type CorpusArticle } from './reading-corpus.js'
import { articleBody } from './article-text.js'

const CORPUS_LIMIT = 2000
/** Below this an article's real text is too thin to be worth quoting from
 *  -- matches the floor the old article gatherer used. */
const MIN_ARTICLE_CHARS = 120
/** How much of an article the prompt sees. The row keeps the same cut, so a
 *  quote can only ever be checked against text the model was shown. */
const ARTICLE_CHARS = 1500

export type CorpusRowKind = 'project' | 'memory' | 'fragment' | 'list_item' | 'article'

export interface CorpusRow {
  kind: CorpusRowKind
  id: string
  /** Short handle the prompt uses to cite this row -- "N12", "P3". The
   *  model cites evidence by ref and the gates check each quote against
   *  exactly that row, never a search across all of them. */
  ref: string
  /** The capture this row came from. A fragment is cut out of a note, so
   *  the two are ONE thought -- citing both is not two pieces of evidence. */
  captureId: string
  /** The project it's about or filed under, for attribution. */
  projectId: string | null
  title: string
  text: string
  /** Everything else the prompt was told about this row -- date, status,
   *  the project a fragment sits under. A question may state these facts,
   *  so the invented-specifics check has to count them as evidence. */
  meta: string
}

export interface Corpus {
  rows: CorpusRow[]
  byRef: Map<string, CorpusRow>
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

  const dateOf = (row: { created_at?: string; memory_id?: string | null }) =>
    // When the thought was had, not when the row was written -- fragments
    // backfilled in one run all carry the same created_at otherwise, which
    // collapses every span a question might state.
    readableDate((row.memory_id && memoryDateById.get(row.memory_id)) || row.created_at || '')

  const rows: CorpusRow[] = [
    ...projects.map((p: any, i: number): CorpusRow => ({
      kind: 'project', id: p.id, captureId: p.id, ref: `P${i + 1}`, projectId: p.id,
      title: p.title ?? '', text: p.description ?? '',
      meta: `${p.status ?? ''}, started ${readableDate(p.created_at)}, last touched ${readableDate(p.last_active) || 'never'}`,
    })),
    ...memories.map((m: any, i: number): CorpusRow => ({
      kind: 'memory', id: m.id, captureId: m.id, ref: `N${i + 1}`, projectId: null,
      title: m.title ?? '', text: m.body ?? '', meta: dateOf(m),
    })),
    ...fragments.map((f: any, i: number): CorpusRow => ({
      kind: 'fragment', id: f.id, captureId: f.memory_id ?? f.id, ref: `F${i + 1}`, projectId: f.project_id ?? null,
      title: f.projects?.title ?? '', text: f.text,
      meta: `${dateOf(f)}${f.projects?.title ? `, filed under "${f.projects.title}"` : ', not filed under any project'}`,
    })),
    ...listItems.map((l: any, i: number): CorpusRow => ({
      kind: 'list_item', id: l.id, captureId: l.id, ref: `L${i + 1}`, projectId: null,
      title: l.lists?.title ?? 'a list', text: l.content,
      meta: `on their "${l.lists?.title ?? 'list'}" list, ${l.status}${l.user_rating ? `, rated ${l.user_rating}` : ''}, added ${readableDate(l.created_at)}`,
    })),
    ...articles.map((a: any, i: number): CorpusRow => ({
      kind: 'article', id: a.id, captureId: a.id, ref: `A${i + 1}`, projectId: null,
      title: a.title ?? 'an article', text: a.body.slice(0, ARTICLE_CHARS), meta: `saved ${readableDate(a.created_at)}`,
    })),
  ]

  const section = (kind: CorpusRowKind, heading: string) => {
    const of = rows.filter(r => r.kind === kind)
    return `${heading} (${of.length}):\n${of.map(formatRow).join('\n')}`
  }

  const text = [
    section('project', 'PROJECTS -- what they said they would make'),
    section('memory', 'NOTES -- voice notes, tidied, in their words'),
    section('fragment', 'FRAGMENTS -- short things said in passing'),
    section('list_item', 'LIST ITEMS -- films, books, music, places they chose. Taste, not their words'),
    section('article', 'ARTICLES THEY FINISHED AND VOUCHED FOR -- not their words'),
  ].join('\n\n')

  return { rows, byRef: new Map(rows.map(r => [r.ref, r])), projectIdByTitle, text }
}

function formatRow(r: CorpusRow): string {
  const title = r.title && r.kind !== 'fragment' && r.kind !== 'list_item' ? ` "${r.title}"` : ''
  return `[${r.ref}]${title} (${r.meta}): ${r.text}`
}

/** "14 March 2025" -- the form a person would say, and the form the
 *  question will use. An ISO date in the prompt comes back as "2025-03-14"
 *  in a question nobody talks like. */
export function readableDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Everything a question may state about a row without inventing it. */
export function evidenceText(row: CorpusRow): string {
  return `${row.title} ${row.meta} ${row.text}`
}
