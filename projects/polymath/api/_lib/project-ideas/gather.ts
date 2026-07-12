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
import type { GatherResult, IdeaOutcome } from './types.js'

/** A project spawned from a built idea, as we read it back for outcome
 *  classification. Loose shape — only the fields the classifier needs. */
interface SpawnedProject {
  status?: string | null
  metadata?: { progress?: unknown; tasks?: unknown; from_idea?: unknown } | null
  created_at?: string | null
}

/** A crossed-off task: the checkbox is ticked, or it carries the timestamp
 *  we stamp when it's completed. Either way the user did the thing. */
function isCrossedOff(task: any): boolean {
  return task?.done === true || task?.completed === true || task?.status === 'done' || !!task?.completed_at
}

/** Derive the REAL outcome of a built idea from the project it spawned.
 *  Pure + exported so it's unit-testable. `undefined` project means the user
 *  built the idea but no project survives — treat as a stall.
 *
 *  "worked" is the signal that matters most and the easiest to get wrong, so
 *  it's grounded in something concrete the user actually did: a task crossed
 *  off the project (or recorded progress). No activity-timestamp guessing. */
export function classifyIdeaOutcome(project: SpawnedProject | undefined): IdeaOutcome {
  if (!project) return 'stalled'
  const status = (project.status ?? '').toLowerCase()
  if (status === 'completed') return 'shipped'
  if (['dormant', 'on-hold', 'archived', 'abandoned'].includes(status)) return 'stalled'

  // Active / upcoming / maintaining: has a task been crossed off, or progress
  // recorded? That's real work on the thing the idea became.
  const progress = Number(project.metadata?.progress ?? 0)
  const tasks = Array.isArray(project.metadata?.tasks) ? (project.metadata!.tasks as any[]) : []
  const crossedOff = tasks.filter(isCrossedOff).length
  if (progress > 0 || crossedOff > 0) return 'worked'

  // Active but nothing crossed off since it was spun up from the idea.
  return 'claimed'
}

const OUTCOME_RANK: Record<IdeaOutcome, number> = { shipped: 3, worked: 2, claimed: 1, stalled: 0 }

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
    recentIdeasRes,
    spawnedProjectsRes,
  ] = await Promise.all([
    supabase
      .from('memories')
      // NOTE: do NOT add `triage` here — that column is not in the
      // memories schema (no migration creates it) and selecting it makes
      // PostgREST fail the WHOLE query, returning zero notes. That bug
      // silently starved the idea generator (mem=0). triage_category is
      // set to null below instead.
      //
      // No time-window filter on purpose: the model has a huge cheap
      // context window and we want the full arc (growth + resurfacing old
      // gems). The high row cap is only a serverless safety bound — for
      // virtually every real user it means "all of it".
      // `embedding` rides along so the seed picker can score relatedness by
      // meaning (cosine) rather than shared keywords. Safe to select — the
      // column exists (unlike `triage` above); a missing/unembedded row just
      // comes back null and the picker falls back to token overlap.
      .select('id, title, body, themes, memory_type, created_at, embedding')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('list_items')
      .select('id, content, status, created_at, list_id, metadata, user_rating, lists(title, type)')
      .eq('user_id', userId)
      .in('status', ['pending', 'active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('projects')
      .select('id, title, description, status, metadata, updated_at, embedding')
      .eq('user_id', userId)
      .in('status', ['active', 'upcoming'])
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('projects')
      .select('id, title, description, status, metadata, updated_at, embedding')
      .eq('user_id', userId)
      .in('status', ['dormant', 'on-hold', 'archived', 'abandoned'])
      .order('updated_at', { ascending: false })
      .limit(150),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, source, created_at, status, embedding')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('project_suggestions')
      .select('id, title, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'dismissed', 'meh'])
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('ie_ideas')
      .select('id, title, description, status, rejection_reason')
      .eq('user_id', userId)
      .in('status', ['approved', 'pending', 'spark'])
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('project_ideas')
      .select('id, title, status, user_feedback, evidence, seed_pair, generated_at, mode, shape')
      .eq('user_id', userId)
      .in('status', ['saved', 'rejected', 'built'])
      .order('generated_at', { ascending: false })
      .limit(200),
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
    // Source-rotation window: the last few ideas of ANY status (rejected
    // included — a rejected idea still MINED that material and showing the
    // same vein again is the exact "5 petrol-station ideas in a row"
    // complaint). Title + evidence let the model see which well each came
    // from and deliberately pick a different one.
    supabase
      .from('project_ideas')
      .select('title, evidence, status, generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(8),
    // Projects spawned from a built idea (saved → "Save = commit" stamps
    // metadata.from_idea = idea.id). Read back so we can derive what each
    // built idea ACTUALLY became — shipped, worked, claimed, or stalled —
    // and feed that real outcome into the generator instead of treating
    // every "built" tap as a win. All statuses, since a built idea can have
    // gone all the way to completed or all the way to abandoned.
    supabase
      .from('projects')
      .select('status, metadata')
      .eq('user_id', userId)
      .not('metadata->>from_idea', 'is', null)
      .limit(400),
  ])

  // Minimal floor only: drop pure fragments ("mouses are good") that the
  // model would treat as load-bearing and invent junk around. Per the
  // "give it everything, refine via the prompt" call, the old ≥80-char /
  // ≥10-word bar was far too aggressive — it silently ate real short
  // notes. Now: ≥20 chars AND ≥4 words. The prompt already tells the
  // model motifs are flavour, not the vessel, so let it judge.
  const memories = (memoriesRes.data ?? [])
    .filter((m: any) => {
      const body = (m.body ?? '').trim()
      if (body.length < 20) return false
      const wordCount = body.split(/\s+/).filter(Boolean).length
      return wordCount >= 4
    })
    .map((m: any) => ({
      id: m.id as string,
      title: m.title as string | null,
      body: (m.body as string).trim(),
      themes: Array.isArray(m.themes) ? (m.themes as string[]) : [],
      memory_type: m.memory_type as string | null,
      triage_category: null,
      created_at: m.created_at as string,
      embedding: (m.embedding ?? null) as number[] | string | null,
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
    embedding: (p.embedding ?? null) as number[] | string | null,
  }))

  const dormant_projects = (dormantProjectsRes.data ?? []).map((p: any) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? '(untitled)',
    description: p.description as string | null,
    status: p.status as string,
    blocker: pickString(p.metadata?.blocker),
    last_bookmark: pickString(p.metadata?.next_step),
    updated_at: (p.updated_at as string) ?? '',
    embedding: (p.embedding ?? null) as number[] | string | null,
  }))

  const reading = (readingRes.data ?? []).map((r: any) => ({
    id: r.id as string,
    title: r.title as string | null,
    excerpt: r.excerpt as string | null,
    source: r.source as string | null,
    created_at: r.created_at as string,
    embedding: (r.embedding ?? null) as number[] | string | null,
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
      .limit(200)
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

  // Map each built idea to the BEST outcome of any project it spawned, keyed
  // by idea id (project.metadata.from_idea). One idea usually maps to one
  // project; if it forked, keep the strongest outcome so a later revival
  // still reads as a win.
  const outcomeByIdeaId = new Map<string, IdeaOutcome>()
  for (const proj of (spawnedProjectsRes.data ?? []) as SpawnedProject[]) {
    const fromIdea = proj.metadata?.from_idea
    if (typeof fromIdea !== 'string' || !fromIdea) continue
    const outcome = classifyIdeaOutcome(proj)
    const existing = outcomeByIdeaId.get(fromIdea)
    if (!existing || OUTCOME_RANK[outcome] > OUTCOME_RANK[existing]) {
      outcomeByIdeaId.set(fromIdea, outcome)
    }
  }

  for (const row of (priorIdeasRes.data ?? []) as Array<{
    id: string
    title: string
    status: string
    user_feedback: string | null
    evidence: Array<{ kind?: string; source_id?: string }> | null
    seed_pair: { centre_id?: string } | null
    generated_at: string
    mode: string | null
    shape: GatherResult['prior_ideas']['built'][number]['shape']
  }>) {
    // Hour ideas are a separate, ephemeral surface. Their saves / rejections
    // must NOT shape the project generator's editorial decisions — a rejected
    // "cook one dish" hour thing shouldn't teach the project reader to avoid
    // cooking, and a blocked centre from an hour idea shouldn't hide a real
    // project. Skip them entirely here.
    if (row.mode === 'hour') continue
    const entry = { title: row.title, feedback: row.user_feedback }
    if (row.status === 'saved' && prior_ideas.saved.length < PER_BUCKET) prior_ideas.saved.push(entry)
    else if (row.status === 'rejected' && prior_ideas.rejected.length < PER_BUCKET) prior_ideas.rejected.push(entry)
    else if (row.status === 'built' && prior_ideas.built.length < PER_BUCKET) {
      // The idea row exists but its project may have been deleted or never
      // created — classifyIdeaOutcome(undefined) reads that as a stall.
      prior_ideas.built.push({
        ...entry,
        outcome: outcomeByIdeaId.get(row.id) ?? classifyIdeaOutcome(undefined),
        shape: row.mode === 'read' ? (row.shape ?? null) : null,
      })
    }

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

  // Source-rotation window. The last ~6 ideas (any status) with the well
  // each was mined from, so the prompt can forbid re-mining the same vein
  // and force a different region of the corpus on the next press.
  const recently_mined: GatherResult['recently_mined'] = []
  for (const row of (recentIdeasRes.data ?? []).slice(0, 6) as Array<{
    title: string | null
    evidence: Array<{ label?: string; excerpt?: string; kind?: string }> | null
    status: string
  }>) {
    if (!row.title) continue
    const lead = Array.isArray(row.evidence) ? row.evidence[0] : null
    const source = lead
      ? `${lead.label ?? lead.kind ?? 'source'}${lead.excerpt ? `: "${(lead.excerpt as string).slice(0, 140)}"` : ''}`
      : '(no cited source)'
    recently_mined.push({ title: row.title, source, status: row.status })
  }

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
    recently_mined,
    total_signal_count,
  }
}
