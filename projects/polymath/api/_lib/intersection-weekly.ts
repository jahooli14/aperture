/**
 * Weekly Intersections Generator
 *
 * Single entry point used by the daily cron's Monday branch (and the manual
 * `?job=intersections` trigger). Replaces the inline AI work that used to
 * happen on every GET /api/projects?resource=intersections request.
 *
 * Steps:
 *   1. Pull source data (projects, memories, articles, list items).
 *   2. Pull recent feedback history (to steer the prompts) and the full
 *      title history (to enforce strict no-repeat dedup).
 *   3. Run discoverIntersections + classicIntersections in parallel.
 *   4. Filter out cards whose titles match disliked themes OR any crossover
 *      we have already shown this user in a previous week (defence in depth).
 *   5. Archive the previous week's row to weekly_intersections_history.
 *   6. Upsert the new row with expires_at = now + 7 days.
 */

import { getSupabaseClient } from './supabase.js'
import {
  discoverIntersections,
  classicIntersections,
  normalizeTitle,
  type IntersectionResult,
  type PriorFeedback,
} from './intersection-engine.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** How many past weeks of feedback to feed back into the prompt. */
const FEEDBACK_LOOKBACK_WEEKS = 6

export interface WeeklyGenerationResult {
  intersections: IntersectionResult[]
  insights: IntersectionResult[]
  generated_at: string
  expires_at: string
}

export async function generateWeeklyIntersections(
  userId: string
): Promise<WeeklyGenerationResult> {
  if (!userId) {
    throw new Error('generateWeeklyIntersections requires a userId')
  }

  const supabase = getSupabaseClient()

  // --- 1. Source data (mirrors the queries that used to live inline at
  //         api/projects.ts:1043-1089) ---

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, title, description, embedding, metadata, status')
    .eq('user_id', userId)
    .in('status', ['active', 'upcoming'])
    .not('embedding', 'is', null)

  if (projError) throw projError

  const generatedAt = new Date()
  const expiresAt = new Date(generatedAt.getTime() + WEEK_MS)

  // Not enough projects to find intersections — still write an empty row so
  // the frontend can render the countdown placeholder instead of the section
  // disappearing entirely.
  if (!projects || projects.length < 2) {
    await persistRow(userId, [], [], generatedAt, expiresAt)
    return {
      intersections: [],
      insights: [],
      generated_at: generatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }
  }

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [memoriesRes, articlesRes, listItemsRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, themes, embedding')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('reading_queue')
      .select('id, title, summary, embedding')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('list_items')
      .select('id, content, metadata, embedding')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const memories = memoriesRes.data || []
  const articles = articlesRes.data || []
  const listItems = listItemsRes.data || []

  // --- 2. Pull feedback history (recent ratings + full title history) ---
  const [priorFeedback, allPriorTitles] = await Promise.all([
    loadPriorFeedback(userId),
    loadAllPriorTitles(userId),
  ])
  priorFeedback.alreadySeen = allPriorTitles
  console.log('[intersection-weekly] prior feedback:', {
    liked: priorFeedback.liked.length,
    disliked: priorFeedback.disliked.length,
    alreadySeen: allPriorTitles.length,
  })

  // --- 3. Generate both decks in parallel ---
  const [insightsRaw, intersectionsRaw] = await Promise.all([
    discoverIntersections(projects, memories, articles, listItems, priorFeedback),
    classicIntersections(projects, memories, articles, listItems, priorFeedback),
  ])

  // --- 4. Defence-in-depth filters ---
  //   (a) drop anything whose title matches a previously-disliked theme
  //   (b) drop anything whose title matches a card we have ever shown before
  //       (the prompt asks the model to avoid this, but we enforce it here so
  //       the same idea genuinely cannot be repeated twice)
  const dislikedSet = new Set(priorFeedback.disliked.map(normalizeTitle).filter(Boolean))
  const seenSet = new Set(allPriorTitles.map(normalizeTitle).filter(Boolean))

  // Also dedupe within this generation pass: if both decks happen to surface
  // the same title in the same week, only the first one is kept.
  const thisRunSeen = new Set<string>()
  const isAllowed = (card: IntersectionResult) => {
    const norm = normalizeTitle(card.crossover?.crossover_title)
    if (!norm) return true
    if (dislikedSet.has(norm)) return false
    if (seenSet.has(norm)) return false
    if (thisRunSeen.has(norm)) return false
    thisRunSeen.add(norm)
    return true
  }
  const insights = insightsRaw.filter(isAllowed)
  const intersections = intersectionsRaw.filter(isAllowed)

  console.log('[intersection-weekly] generated', {
    projects: projects.length,
    memories: memories.length,
    articles: articles.length,
    listItems: listItems.length,
    intersections: intersections.length,
    insights: insights.length,
  })

  // --- 5 + 6. Archive previous row, upsert new row ---
  await persistRow(userId, intersections, insights, generatedAt, expiresAt)

  return {
    intersections,
    insights,
    generated_at: generatedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }
}

/**
 * Look back N weeks of past card sets and flatten the feedback into two flat
 * arrays of liked / disliked crossover titles. Used to steer the next prompt.
 */
async function loadPriorFeedback(userId: string): Promise<PriorFeedback> {
  const supabase = getSupabaseClient()
  const lookbackStart = new Date()
  lookbackStart.setDate(lookbackStart.getDate() - FEEDBACK_LOOKBACK_WEEKS * 7)

  // Read both the current row (its feedback might already have user signal
  // before the next week's archive lands) AND the history rows.
  const [currentRes, historyRes] = await Promise.all([
    supabase
      .from('weekly_intersections')
      .select('intersections, insights, feedback')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('weekly_intersections_history')
      .select('intersections, insights, feedback, generated_at')
      .eq('user_id', userId)
      .gte('generated_at', lookbackStart.toISOString())
      .order('generated_at', { ascending: false })
      .limit(FEEDBACK_LOOKBACK_WEEKS),
  ])

  const liked: string[] = []
  const disliked: string[] = []

  const ingest = (
    intersections: unknown,
    insights: unknown,
    feedback: unknown
  ) => {
    const fb = (feedback ?? {}) as Record<string, 'good' | 'bad'>
    const all: IntersectionResult[] = [
      ...((intersections ?? []) as IntersectionResult[]),
      ...((insights ?? []) as IntersectionResult[]),
    ]
    for (const card of all) {
      const title = card?.crossover?.crossover_title
      if (!title) continue
      const rating = fb[card.id]
      if (rating === 'good') liked.push(title)
      else if (rating === 'bad') disliked.push(title)
    }
  }

  if (currentRes.data) {
    ingest(currentRes.data.intersections, currentRes.data.insights, currentRes.data.feedback)
  }
  for (const row of historyRes.data || []) {
    ingest(row.intersections, row.insights, row.feedback)
  }

  return { liked, disliked }
}

/**
 * Pull every crossover title this user has ever been shown — current row plus
 * the full history archive. Used to enforce strict no-repeat dedup so the same
 * intersection idea is not generated twice (the 6-week feedback lookback is
 * not enough; users notice repeats from much further back).
 *
 * Returned in most-recent-first order so the prompt's truncated "do not
 * repeat" snippet biases toward suppressing recent ideas.
 */
async function loadAllPriorTitles(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient()

  const [currentRes, historyRes] = await Promise.all([
    supabase
      .from('weekly_intersections')
      .select('intersections, insights, generated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('weekly_intersections_history')
      .select('intersections, insights, generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false }),
  ])

  const titles: string[] = []
  const seen = new Set<string>()

  const collect = (intersections: unknown, insights: unknown) => {
    const all: IntersectionResult[] = [
      ...((intersections ?? []) as IntersectionResult[]),
      ...((insights ?? []) as IntersectionResult[]),
    ]
    for (const card of all) {
      const title = card?.crossover?.crossover_title
      if (!title) continue
      const key = normalizeTitle(title)
      if (!key || seen.has(key)) continue
      seen.add(key)
      titles.push(title)
    }
  }

  if (currentRes.data) {
    collect(currentRes.data.intersections, currentRes.data.insights)
  }
  for (const row of historyRes.data || []) {
    collect(row.intersections, row.insights)
  }

  return titles
}

/**
 * Archive the user's previous weekly_intersections row to history (if any),
 * then upsert the new row.
 */
async function persistRow(
  userId: string,
  intersections: IntersectionResult[],
  insights: IntersectionResult[],
  generatedAt: Date,
  expiresAt: Date
): Promise<void> {
  const supabase = getSupabaseClient()

  // Archive the existing row (if there is one with non-empty content).
  const { data: previous } = await supabase
    .from('weekly_intersections')
    .select('intersections, insights, feedback, generated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (previous) {
    const intArr = (previous.intersections ?? []) as unknown[]
    const insArr = (previous.insights ?? []) as unknown[]
    if (intArr.length > 0 || insArr.length > 0) {
      const { error: archiveErr } = await supabase
        .from('weekly_intersections_history')
        .insert({
          user_id: userId,
          intersections: previous.intersections,
          insights: previous.insights,
          feedback: previous.feedback,
          generated_at: previous.generated_at,
        })
      if (archiveErr) {
        console.warn('[intersection-weekly] failed to archive previous row:', archiveErr.message)
      }
    }
  }

  const { error: upsertErr } = await supabase
    .from('weekly_intersections')
    .upsert(
      {
        user_id: userId,
        intersections,
        insights,
        feedback: {},
        generated_at: generatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (upsertErr) {
    throw new Error(`Failed to persist weekly intersections: ${upsertErr.message}`)
  }
}
