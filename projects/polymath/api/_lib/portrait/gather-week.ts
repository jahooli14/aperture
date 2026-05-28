/**
 * Portrait gather — narrow window of the user's corpus for the "this week"
 * section. Reads the same surfaces as `api/_lib/project-ideas/gather.ts`
 * but capped at the last 7 days so the model writes about *this week*,
 * not the whole arc.
 *
 * Returns a `WeeklyCorpus` for the generator, plus the `since` ISO
 * timestamp the reckoner reuses to scope its own evaluation window.
 */

import type { getSupabaseClient } from '../supabase.js'

type Supabase = ReturnType<typeof getSupabaseClient>

export interface WeeklyMemory {
  id: string
  title: string | null
  body: string
  themes: string[]
  memory_type: string | null
  triage_category: string | null
  created_at: string
}

export interface WeeklyListItem {
  id: string
  content: string
  list_type: string
  list_title: string | null
  status: string
  created_at: string
}

export interface WeeklyProjectEvent {
  /** Synthetic id: `${kind}-${project_id}` so the generator can quote the
   *  event without a separate events table. */
  id: string
  kind: 'updated' | 'status_changed' | 'capture_attached'
  project_id: string
  project_title: string
  detail: string
  occurred_at: string
}

export interface WeeklyReading {
  id: string
  title: string | null
  excerpt: string | null
  source: string | null
  status: string
  created_at: string
}

export interface WeeklyHighlight {
  id: string
  quote: string
  article_title: string | null
  created_at: string
}

export interface WeeklyCorpus {
  since: string
  memories: WeeklyMemory[]
  list_items: WeeklyListItem[]
  project_events: WeeklyProjectEvent[]
  reading: WeeklyReading[]
  highlights: WeeklyHighlight[]
  /** Active project titles the user said matter (priority + favourites).
   *  Lets the generator quietly notice the gap when they go untouched. */
  stated_priorities: Array<{ id: string; title: string; touched_this_week: boolean }>
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface GatherWindow {
  /** Inclusive lower bound (ISO timestamp). */
  since: string
  /** Exclusive upper bound (ISO timestamp). Defaults to now. */
  until?: string
}

/**
 * Pulls the user's corpus in a time window. With no window argument,
 * defaults to "the last 7 days from now" — what the generator wants on
 * a fresh refresh. The reckoner passes the prediction's actual sealed
 * window so it grades against the week that was predicted, not the
 * trailing week from when cron happened to fire.
 */
export async function gatherWeek(
  supabase: Supabase,
  userId: string,
  window?: GatherWindow,
): Promise<WeeklyCorpus> {
  const since = window?.since ?? new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const until = window?.until ?? new Date().toISOString()

  const [
    memoriesRes,
    listItemsRes,
    projectsTouchedRes,
    readingRes,
    highlightsRes,
    priorityRes,
  ] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, themes, memory_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .lt('created_at', until)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('list_items')
      .select('id, content, status, created_at, list_id, lists(title, type)')
      .eq('user_id', userId)
      .gte('created_at', since)
      .lt('created_at', until)
      .order('created_at', { ascending: false })
      .limit(80),
    // Project events: projects touched in the window. We synthesise an
    // "event" per project from updated_at + status — enough signal for the
    // generator to notice "opened twice, closed both times" patterns when
    // the underlying sessions table isn't in scope yet. Caveat:
    // `updated_at` is touched by background jobs (heat recompute, RLS
    // trigger writes) — so this over-reports "touched". Acceptable for
    // slice 1; slice 2 should swap in a `last_user_touch` column or read
    // from a sessions table.
    supabase
      .from('projects')
      .select('id, title, status, metadata, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', since)
      .lt('updated_at', until)
      .order('updated_at', { ascending: false })
      .limit(40),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, source, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .lt('created_at', until)
      .order('created_at', { ascending: false })
      .limit(40),
    // Highlights — filtered by their own created_at, NOT by article id.
    // The previous version only pulled highlights on articles also queued
    // in the same week, so a highlight made today on an article queued
    // last month was invisible to the portrait. RLS on article_highlights
    // (via reading_queue.user_id) keeps this query user-scoped.
    supabase
      .from('article_highlights')
      .select('id, highlight_text, created_at, article_id, reading_queue!inner(title, user_id)')
      .eq('reading_queue.user_id', userId)
      .gte('created_at', since)
      .lt('created_at', until)
      .order('created_at', { ascending: false })
      .limit(40),
    // Stated priorities: pinned + favourited projects. We then check which
    // of these show up in projectsTouchedRes — the gap is the signal.
    supabase
      .from('projects')
      .select('id, title, is_priority, is_favourite, updated_at')
      .eq('user_id', userId)
      .or('is_priority.eq.true,is_favourite.eq.true'),
  ])

  const memories: WeeklyMemory[] = (memoriesRes.data ?? [])
    .filter((m: any) => {
      const body = (m.body ?? '').trim()
      return body.length >= 12
    })
    .map((m: any) => ({
      id: m.id,
      title: m.title ?? null,
      body: (m.body as string).trim(),
      themes: Array.isArray(m.themes) ? m.themes : [],
      memory_type: m.memory_type ?? null,
      triage_category: null,
      created_at: m.created_at,
    }))

  const list_items: WeeklyListItem[] = (listItemsRes.data ?? [])
    .filter((li: any) => li.content && li.content.trim().length >= 3)
    .map((li: any) => ({
      id: li.id,
      content: (li.content as string).trim(),
      list_type: li.lists?.type ?? 'generic',
      list_title: li.lists?.title ?? null,
      status: li.status,
      created_at: li.created_at,
    }))

  const project_events: WeeklyProjectEvent[] = (projectsTouchedRes.data ?? []).map((p: any) => ({
    id: `updated-${p.id}`,
    kind: 'updated',
    project_id: p.id,
    project_title: p.title ?? '(untitled)',
    detail: `last touched ${new Date(p.updated_at).toISOString().slice(0, 10)} · status ${p.status}`,
    occurred_at: p.updated_at,
  }))

  const touchedIds = new Set<string>((projectsTouchedRes.data ?? []).map((p: any) => p.id))
  const stated_priorities = (priorityRes.data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title ?? '(untitled)',
    touched_this_week: touchedIds.has(p.id),
  }))

  const reading: WeeklyReading[] = (readingRes.data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title ?? null,
    excerpt: r.excerpt ?? null,
    source: r.source ?? null,
    status: r.status ?? 'pending',
    created_at: r.created_at,
  }))

  const highlights: WeeklyHighlight[] = ((highlightsRes.data ?? []) as any[])
    .filter(h => h.highlight_text && (h.highlight_text as string).trim().length >= 10)
    .map(h => ({
      id: h.id,
      quote: (h.highlight_text as string).trim(),
      article_title: h.reading_queue?.title ?? null,
      created_at: h.created_at,
    }))

  return { since, memories, list_items, project_events, reading, highlights, stated_priorities }
}

/** Total signal count — used to decide whether the corpus is rich enough
 *  to generate against. Slice 1 minimum: 3 signals across all surfaces. */
export function countSignals(c: WeeklyCorpus): number {
  return c.memories.length + c.list_items.length + c.project_events.length + c.reading.length + c.highlights.length
}
