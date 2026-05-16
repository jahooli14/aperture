/**
 * Gather — pulls broad context from across the app for the project-ideas
 * generator. Where the noticing pipeline reads 3 tables, this reads ~9 so
 * the generator can ground a project idea in any signal the user has
 * captured: voice notes, list items (films/books/places/etc.), reading
 * highlights, prior project suggestions, idea-engine output,
 * dormant projects.
 *
 * All queries are user-scoped and row-capped. Older signals matter — a
 * recurring interest from 6 months ago is exactly the kind of thing a good
 * project idea should surface — so windows are wider here than in noticing.
 */

import type { getSupabaseClient } from '../supabase.js'
import type { GatherResult } from './types.js'

const RECENT_DAYS = 120
const ANCHOR_DAYS = 365
/** Cooldown window for seed pairs. A (centre × arrival) convergence can't
 *  fire again for this many weeks once it's been surfaced. 12 weeks lines
 *  up with the long-dormant reshape cadence in CLAUDE.md and is long
 *  enough that a re-fired pair feels genuinely fresh. */
const SEED_PAIR_COOLDOWN_DAYS = 12 * 7

/** Window for "you just showed this" — pending + superseded rows from the
 *  last 14 days. The model sees these titles in the do-not-repeat block so
 *  back-to-back regens don't keep re-emitting the same title. */
const RECENT_TITLE_DAYS = 14

/** Centre debounce window. Any centre used in the last 24h (pending or
 *  superseded) is deprioritised by the picker so the next regen doesn't
 *  immediately reach for the same dormant project with a different arrival. */
const RECENT_CENTRE_DAYS = 1

/** Hard block window. The centre of an idea the user explicitly REJECTED
 *  stays off the table this long — "not for me" is about the project, not
 *  just the wording, so reviving it under a fresh title within ~6 months
 *  is exactly the repeat the user is complaining about. */
const REJECTED_BLOCK_DAYS = 180

/** Soft cooldown window. The centre of an idea that was shown but not acted
 *  on (pending / superseded) is held back this long so back-to-back presses
 *  rotate to a different project. Relaxed by the generator when filtering
 *  would otherwise leave nothing to suggest. */
const SHOWN_COOLDOWN_DAYS = 30

type Supabase = ReturnType<typeof getSupabaseClient>

export async function gatherForIdeas(supabase: Supabase, userId: string): Promise<GatherResult> {
  const recentSince = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString()
  const anchorSince = new Date(Date.now() - ANCHOR_DAYS * 86_400_000).toISOString()
  const cooldownSince = new Date(Date.now() - SEED_PAIR_COOLDOWN_DAYS * 86_400_000).toISOString()
  const recentTitleSince = new Date(Date.now() - RECENT_TITLE_DAYS * 86_400_000).toISOString()
  const recentCentreSince = new Date(Date.now() - RECENT_CENTRE_DAYS * 86_400_000).toISOString()

  const [
    memoriesRes,
    listItemsRes,
    activeProjectsRes,
    dormantProjectsRes,
    readingRes,
    suggestionsRes,
    ieIdeasRes,
    priorIdeasRes,
    recentSeedPairsRes,
  ] = await Promise.all([
    supabase
      .from('memories')
      // NOTE: do NOT add `triage` here — that column is not in the
      // memories schema (no migration creates it) and selecting it makes
      // PostgREST fail the WHOLE query, returning zero notes. That bug
      // silently starved the idea generator (mem=0). triage_category is
      // set to null below instead.
      .select('id, title, body, themes, memory_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', anchorSince)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('list_items')
      .select('id, content, status, created_at, list_id, metadata, user_rating, lists(title, type)')
      .eq('user_id', userId)
      .gte('created_at', anchorSince)
      .in('status', ['pending', 'active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('projects')
      .select('id, title, description, status, metadata, updated_at')
      .eq('user_id', userId)
      .in('status', ['active', 'upcoming'])
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase
      .from('projects')
      .select('id, title, description, status, metadata, updated_at')
      .eq('user_id', userId)
      .in('status', ['dormant', 'on-hold', 'archived', 'abandoned'])
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, source, created_at, status')
      .eq('user_id', userId)
      .gte('created_at', recentSince)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('project_suggestions')
      .select('id, title, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'dismissed', 'meh'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('ie_ideas')
      .select('id, title, description, status, rejection_reason')
      .eq('user_id', userId)
      .in('status', ['approved', 'pending', 'spark'])
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('project_ideas')
      .select('title, status, user_feedback, evidence, seed_pair, generated_at')
      .eq('user_id', userId)
      .in('status', ['saved', 'rejected', 'built'])
      .order('generated_at', { ascending: false })
      .limit(60),
    // Recent batches — drives three signals at once:
    //   1. recent_seed_pairs (cooldown set for the picker)
    //   2. recent_titles (do-not-repeat block in the prompt — catches the
    //      regen-shows-same-idea case AND permissive rows, which have a
    //      null seed_pair and otherwise wouldn't be debounced anywhere)
    //   3. recent_centre_ids (centre debounce in the picker)
    // Rejected rows are still excluded — they're already represented in
    // prior_ideas.rejected with the user's reason, and a rejection means
    // the convergence is dead, not on cooldown.
    supabase
      .from('project_ideas')
      .select('title, seed_pair, status, generated_at')
      .eq('user_id', userId)
      .neq('status', 'rejected')
      .gte('generated_at', cooldownSince)
      .order('generated_at', { ascending: false })
      .limit(120),
  ])

  // Drop short cryptic voice notes ("mouses are good") before they reach
  // the prompt. The model treats anything in the prompt as load-bearing
  // and will invent project shapes to use them. The bar: ≥80 chars AND
  // ≥10 words. A real load-bearing note describes a thing; a phrase
  // doesn't. (Bed by 10, Sonically Sound etc. survive as PROJECTS via
  // the projects table — losing a 3-word voice note doesn't lose them.)
  const memories = (memoriesRes.data ?? [])
    .filter((m: any) => {
      const body = (m.body ?? '').trim()
      if (body.length < 80) return false
      const wordCount = body.split(/\s+/).filter(Boolean).length
      return wordCount >= 10
    })
    .map((m: any) => ({
      id: m.id as string,
      title: m.title as string | null,
      body: (m.body as string).trim(),
      themes: Array.isArray(m.themes) ? (m.themes as string[]) : [],
      memory_type: m.memory_type as string | null,
      triage_category: null,
      created_at: m.created_at as string,
    }))

  // Memory pipeline diagnostic. mem=0 with notes present is the failure
  // we keep chasing: this line says whether the QUERY came back empty
  // (RLS / user_id / column → err or raw=0) or the ≥80-char/≥10-word
  // filter ate everything (raw>0 kept=0 → notes are just short).
  const memRaw = memoriesRes.data?.length ?? 0
  if (memRaw === 0 || memories.length === 0) {
    const sampleLens = (memoriesRes.data ?? []).slice(0, 5).map((m: any) => (m.body ?? '').trim().length).join(',')
    console.warn(`[gather] memories raw=${memRaw} kept=${memories.length} err=${memoriesRes.error?.message ?? 'none'} firstBodyLens=[${sampleLens}]`)
  }

  const list_items = (listItemsRes.data ?? [])
    .filter((li: any) => li.content && li.content.trim().length >= 4)
    .map((li: any) => ({
      id: li.id as string,
      content: (li.content as string).trim(),
      list_type: (li.lists?.type as string) ?? 'generic',
      list_title: (li.lists?.title as string | null) ?? null,
      status: li.status as string,
      created_at: li.created_at as string,
      reaction: (li.metadata?.reaction as 'sparked' | 'off' | 'make' | undefined) ?? null,
      user_rating: typeof li.user_rating === 'number' ? li.user_rating : null,
    }))

  const pickString = (v: unknown) => (typeof v === 'string' && v.trim().length > 0) ? v.trim() : null

  const active_projects = (activeProjectsRes.data ?? []).map((p: any) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? '(untitled)',
    description: p.description as string | null,
    status: p.status as string,
    tags: Array.isArray(p.metadata?.tags) ? (p.metadata.tags as string[]) : [],
    blocker: pickString(p.metadata?.blocker),
    last_bookmark: pickString(p.metadata?.next_step),
    updated_at: (p.updated_at as string) ?? '',
  }))

  const dormant_projects = (dormantProjectsRes.data ?? []).map((p: any) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? '(untitled)',
    description: p.description as string | null,
    status: p.status as string,
    blocker: pickString(p.metadata?.blocker),
    last_bookmark: pickString(p.metadata?.next_step),
    updated_at: (p.updated_at as string) ?? '',
  }))

  const reading = (readingRes.data ?? []).map((r: any) => ({
    id: r.id as string,
    title: r.title as string | null,
    excerpt: r.excerpt as string | null,
    source: r.source as string | null,
    created_at: r.created_at as string,
  }))

  // Highlights are linked to reading_queue articles, so pull them in a
  // second step scoped to the user's articles. RLS on reading_queue keeps
  // this safe even if the highlights table itself only has article_id.
  const articleIds = reading.map(r => r.id)
  let highlights: GatherResult['highlights'] = []
  if (articleIds.length > 0) {
    const { data: highlightRows } = await supabase
      .from('article_highlights')
      .select('id, highlight_text, created_at, article_id, reading_queue!inner(title)')
      .in('article_id', articleIds)
      .order('created_at', { ascending: false })
      .limit(20)
    highlights = ((highlightRows ?? []) as any[])
      .filter(h => h.highlight_text && (h.highlight_text as string).trim().length >= 10)
      .map(h => ({
        id: h.id as string,
        quote: (h.highlight_text as string).trim(),
        article_title: (h.reading_queue?.title as string | null) ?? null,
        created_at: h.created_at as string,
      }))
  }

  const prior_suggestions = (suggestionsRes.data ?? []).map((s: any) => ({
    id: s.id as string,
    title: s.title as string,
    status: s.status as string,
  }))

  const ie_ideas = (ieIdeasRes.data ?? []).map((i: any) => ({
    id: i.id as string,
    title: i.title as string,
    description: i.description as string,
    status: i.status as string,
    rejection_reason: i.rejection_reason as string | null,
  }))

  const prior_ideas: GatherResult['prior_ideas'] = {
    saved: [],
    rejected: [],
    built: [],
  }
  // Limit each bucket to 20 so a long history of rejections doesn't crowd
  // out the saved/built signal in the prompt context.
  const PER_BUCKET = 20
  // Centres the fast path must not revive again. A rejected idea's centre
  // is read from its stored seed_pair first; older fast-path rows have a
  // null seed_pair, so fall back to the project_dormant / project rows in
  // its evidence (evidence[0] on a fast idea is the project it revived).
  const blockedCentre = new Set<string>()
  const rejectedBlockSince = Date.now() - REJECTED_BLOCK_DAYS * 86_400_000
  for (const row of (priorIdeasRes.data ?? []) as Array<{
    title: string
    status: string
    user_feedback: string | null
    evidence: Array<{ kind?: string; source_id?: string }> | null
    seed_pair: { centre_id?: string } | null
    generated_at: string
  }>) {
    const entry = { title: row.title, feedback: row.user_feedback }
    if (row.status === 'saved' && prior_ideas.saved.length < PER_BUCKET) prior_ideas.saved.push(entry)
    else if (row.status === 'rejected' && prior_ideas.rejected.length < PER_BUCKET) prior_ideas.rejected.push(entry)
    else if (row.status === 'built' && prior_ideas.built.length < PER_BUCKET) prior_ideas.built.push(entry)

    if (row.status === 'rejected' && new Date(row.generated_at).getTime() >= rejectedBlockSince) {
      if (row.seed_pair?.centre_id) blockedCentre.add(row.seed_pair.centre_id)
      for (const ev of row.evidence ?? []) {
        if ((ev.kind === 'project_dormant' || ev.kind === 'project') && ev.source_id) {
          blockedCentre.add(ev.source_id)
        }
      }
    }
  }

  const recent_seed_pairs: GatherResult['recent_seed_pairs'] = []
  const recent_titles: GatherResult['recent_titles'] = []
  const recentCentreSet = new Set<string>()
  const shownCooldownSince = new Date(Date.now() - SHOWN_COOLDOWN_DAYS * 86_400_000).toISOString()
  for (const row of (recentSeedPairsRes.data ?? []) as Array<{ title: string | null; seed_pair: { centre_id?: string; arrival_id?: string } | null; status: string; generated_at: string }>) {
    const sp = row.seed_pair
    if (sp && sp.centre_id && sp.arrival_id) {
      recent_seed_pairs.push({
        centre_id: sp.centre_id,
        arrival_id: sp.arrival_id,
        used_at: row.generated_at,
        status: row.status,
      })
      if (row.generated_at >= recentCentreSince && (row.status === 'pending' || row.status === 'superseded')) {
        recentCentreSet.add(sp.centre_id)
      }
      // Soft cooldown: a centre shown but not acted on in the last ~30
      // days is held back so the next press rotates to a different one.
      if (row.generated_at >= shownCooldownSince && (row.status === 'pending' || row.status === 'superseded')) {
        blockedCentre.add(sp.centre_id)
      }
    }
    if (
      row.title &&
      row.generated_at >= recentTitleSince &&
      (row.status === 'pending' || row.status === 'superseded')
    ) {
      recent_titles.push({ title: row.title, used_at: row.generated_at })
    }
  }
  const recent_centre_ids = Array.from(recentCentreSet)

  const total_signal_count =
    memories.length +
    list_items.length +
    active_projects.length +
    dormant_projects.length +
    reading.length +
    highlights.length

  return {
    memories,
    list_items,
    active_projects,
    dormant_projects,
    reading,
    highlights,
    prior_suggestions,
    ie_ideas,
    prior_ideas,
    recent_seed_pairs,
    recent_titles,
    recent_centre_ids,
    blocked_project_ids: Array.from(blockedCentre),
    total_signal_count,
  }
}
