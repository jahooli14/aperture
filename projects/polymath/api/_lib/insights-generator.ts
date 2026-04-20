/**
 * Insights Generator
 *
 * Analyses ALL of a user's data to surface "so what" insights — the patterns,
 * tensions, and emergent projects they can't see themselves because they're
 * too close to the material.
 *
 * Architecture:
 * - Debounced: skips if last run was <10 minutes ago
 * - Incremental: passes previous insights to the model to evolve, not restart
 * - Tracks status per insight: new / strengthened / evolved / persistent
 * - Archives each generation to synthesis_insights_history before overwriting
 * - Shadow project: always the first insight — what they're REALLY building
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const DEBOUNCE_MS = 10 * 60 * 1000 // 10 minutes
const DAILY_CAP = 3 // max Flash regenerations per user per UTC day

interface InsightData {
  evidence?: string[]
  recommendation?: string
  how_long?: string
  project_name?: string
  timeline?: Array<{ date: string; stance: string; quote?: string }>
  [key: string]: unknown
}

export interface GeneratedInsight {
  type: 'collision' | 'pattern' | 'evolution' | 'opportunity' | 'shadow_project'
  title: string
  description: string
  data: InsightData
  actionable: boolean
  action?: string
  // Tracking fields — computed server-side, not from the model
  is_new?: boolean      // True if this title didn't exist in the previous generation
  status?: 'new' | 'strengthened' | 'evolved' | 'persistent'
  first_seen?: string   // ISO timestamp of when this insight first appeared
}

/**
 * Generate fresh insights from all user data.
 * - Debounced to max once per 10 minutes
 * - Passes previous insights so the model evolves rather than restarts
 * - Computes is_new / first_seen server-side by diffing against previous
 * - Archives previous generation before overwriting
 */
export async function generateInsights(userId: string): Promise<GeneratedInsight[]> {
  const supabase = getSupabaseClient()

  // Read current cache — used for debounce, previous insights, and history archiving
  const { data: cached } = await supabase
    .from('synthesis_insights')
    .select('insights, generated_at, feedback')
    .eq('user_id', userId)
    .single()

  // Debounce: skip if generated within the last 10 minutes
  if (cached?.generated_at) {
    const ageMs = Date.now() - new Date(cached.generated_at).getTime()
    if (ageMs < DEBOUNCE_MS) {
      console.log(`[insights-generator] Debounced — last ran ${Math.round(ageMs / 60000)}m ago`)
      return (cached.insights as GeneratedInsight[]) || []
    }
  }

  // Daily cap: the archive stores the previous snapshot's generated_at on every
  // run, so counting history rows with today's generated_at gives (runs today
  // − 1). Add 1 if the current cache is also from today to get the true count.
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const { count: archivedToday } = await supabase
    .from('synthesis_insights_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('generated_at', startOfToday.toISOString())
  const cachedIsToday = cached?.generated_at
    ? new Date(cached.generated_at).getTime() >= startOfToday.getTime()
    : false
  const runsToday = (cachedIsToday ? 1 : 0) + (archivedToday || 0)
  if (runsToday >= DAILY_CAP) {
    console.log(`[insights-generator] Daily cap reached (${runsToday}/${DAILY_CAP}) — skipping`)
    return (cached?.insights as GeneratedInsight[]) || []
  }

  const previousInsights = (cached?.insights as GeneratedInsight[]) || []
  const feedback = (cached?.feedback as Record<string, 'up' | 'down'>) || {}

  // Build a map of previous insight titles → first_seen for continuity tracking
  const previousByTitle = new Map<string, GeneratedInsight>()
  for (const insight of previousInsights) {
    previousByTitle.set(insight.title.trim().toLowerCase(), insight)
  }

  // Load everything in parallel
  const [memoriesResult, articlesResult, projectsResult, listItemsResult] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, themes, tags, emotional_tone, triage, created_at')
      .eq('user_id', userId)
      .eq('processed', true)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, themes, entities, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('projects')
      .select('id, title, description, status, metadata, created_at')
      .eq('user_id', userId),
    supabase
      .from('list_items')
      .select('id, content, metadata, created_at')
      .eq('user_id', userId)
      .limit(300),
  ])

  const memories = memoriesResult.data || []
  const articles = articlesResult.data || []
  const projects = projectsResult.data || []
  const listItems = listItemsResult.data || []

  if (memories.length + articles.length + projects.length < 3) {
    return []
  }

  // Dataset metadata — gives the model calibration on how much history exists
  const oldestMemory = memories[memories.length - 1]
  const newestMemory = memories[0]
  const datasetSpanDays = oldestMemory
    ? Math.round((Date.now() - new Date(oldestMemory.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  const avgPerWeek = datasetSpanDays > 7
    ? Math.round((memories.length / datasetSpanDays) * 7 * 10) / 10
    : memories.length

  // Format memories — date-stamped and compact
  const memoriesSummary = memories
    .map(m => {
      const date = new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `[${date}] "${m.title}": ${(m.body || '').slice(0, 180).replace(/\n/g, ' ')} | themes: ${(m.themes || []).join(', ')} | tone: ${m.emotional_tone || 'neutral'}`
    })
    .join('\n')

  const articlesSummary = articles
    .map(a => {
      const date = new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `[${date}] "${a.title}": ${(a.excerpt || '').slice(0, 120).replace(/\n/g, ' ')} | themes: ${(a.themes || []).join(', ')}`
    })
    .join('\n')

  const projectsSummary = projects
    .map(p => {
      const date = new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `[created ${date}] "${p.title}" (${p.status}): ${(p.description || '').slice(0, 120)}`
    })
    .join('\n')

  const listsSummary = listItems
    .map(i => i.content || (i.metadata as any)?.title || '')
    .filter(Boolean)
    .join(', ')
    .slice(0, 500)

  // Previous insights for evolution tracking
  const dislikedTitles = Object.entries(feedback)
    .filter(([, rating]) => rating === 'down')
    .map(([title]) => `- "${title}"`)

  const previousSection = previousInsights.length > 0
    ? `
PREVIOUS INSIGHTS — evolve these, don't restate them:
${previousInsights.map(i => `- [${i.type}] "${i.title}": ${i.description}`).join('\n')}
${dislikedTitles.length > 0 ? `\nThe user marked these as unhelpful — don't generate similar patterns:\n${dislikedTitles.join('\n')}` : ''}

For each insight, also set "status":
- "new" → title and core idea didn't exist before
- "strengthened" → same insight, more evidence now
- "evolved" → same territory, but the conclusion has shifted
- "persistent" → unchanged and still clearly true`
    : ''

  const prompt = `You have read everything this person has ever captured — every thought, article, project, and list item. You know them better than they know themselves right now.

Your job is NOT to summarise what they've been doing. It's to say what it MEANS.

DATASET:
- ${memories.length} memories over ${datasetSpanDays} days (avg ${avgPerWeek}/week)
- Oldest capture: ${oldestMemory ? new Date(oldestMemory.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown'}
- Most recent: ${newestMemory ? new Date(newestMemory.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown'}

MEMORIES (${memories.length}, newest first):
${memoriesSummary || 'None yet'}

ARTICLES SAVED (${articles.length}):
${articlesSummary || 'None yet'}

PROJECTS (${projects.length}):
${projectsSummary || 'None yet'}

TRACKED ITEMS — films, books, lists:
${listsSummary || 'None yet'}
${previousSection}

---

Generate exactly TWO types of output:

## 1. THE SHADOW PROJECT (type: "shadow_project") — ALWAYS REQUIRED, ALWAYS FIRST

This is the single most important insight. Look beneath all the stated projects and surface the real one — the thing they're building toward without having named it yet.

Not "you might want to create a project about X." Instead: "This IS what you're building. You just haven't named it."

Requirements for the shadow project:
- Give it an actual project name in data.project_name (as if they were creating it in the app right now)
- Put "since [specific month/date]" in data.how_long — use real dates from their captures
- Evidence must be 4-6 specific memory/article titles from the data above, not themes
- The description should make them say "yes, exactly — how did you see that?"
- If a shadow project already emerged in previous insights, either evolve it or replace it with something stronger

## 2. INSIGHTS (types: "collision" | "pattern" | "evolution" | "opportunity") — 4-5 only

Each insight must pass this test: would a perceptive friend who just read everything above stop the conversation to say this? If it's something they could have told you themselves, it's not an insight.

Type definitions:
- "collision" = two things they believe or do that genuinely contradict each other — name the contradiction, not just the tension
- "pattern" = a recurring theme with a conclusion attached — not "you think about X" but "the fact that you keep returning to X means Y"
- "evolution" = their thinking has demonstrably shifted — must reference specific dates from the data above
- "opportunity" = a concrete intersection where two threads could become something real — not vague potential but a specific next move

ANTI-PATTERNS — never generate these:
- "You think about X a lot" (observation, not insight)
- "There might be a tension between..." (hedge — if you see it, say it)
- "You could consider exploring..." (consultant speak)
- "It seems like you're interested in..." (search engine, not analyst)
- Vague timeframes like "recently" or "often" — use actual dates from the data

RULES:
- Use specific dates from the data: "since [date]", "in [month]", "between [date] and [date]"
- Quote or closely reference actual memory/article titles as evidence
- Descriptions: 2-3 sentences, no hedging, deliver the conclusion not the setup
- No startup speak whatsoever
- The shadow project description should be the most resonant thing in the whole response

Return ONLY valid JSON — no markdown, no explanation:
[
  {
    "type": "shadow_project",
    "title": "The name of the emergent project",
    "description": "What they're really building — 2-3 sentences that would make them say 'yes, exactly'",
    "data": {
      "evidence": ["specific memory or article title", "..."],
      "project_name": "The actual project name to create",
      "how_long": "since [specific month/date from the data]",
      "recommendation": "The one thing that would make this real"
    },
    "actionable": true,
    "action": "Create project: [project_name]",
    "status": "new|strengthened|evolved|persistent"
  },
  {
    "type": "collision|pattern|evolution|opportunity",
    "title": "Direct, declarative title — not a question",
    "description": "The insight itself — specific, concrete, dated where possible, no hedging.",
    "data": {
      "evidence": ["specific memory or article title", "..."],
      "recommendation": "one concrete thing to do with this"
    },
    "actionable": true,
    "action": "specific next step",
    "status": "new|strengthened|evolved|persistent"
  }
]`

  try {
    // Flash: corpus-wide shadow-project + collision detection. Flash handles
    // the prompt's anti-pattern rules reliably and is ~7x cheaper than Pro.
    // Cost containment here matters because this runs fire-and-forget on every
    // memory save (debounced to 10min + hard-capped to 3 runs/day below).
    const model = genAI.getGenerativeModel({ model: MODELS.FLASH_CHAT })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
    const text = result.response.text()

    let cleanedText = text.trim()
    const markdownMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (markdownMatch) cleanedText = markdownMatch[1].trim()
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
    const rawInsights: GeneratedInsight[] = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText)

    // Post-process: compute is_new and inherit first_seen from previous
    const now = new Date().toISOString()
    const insights: GeneratedInsight[] = rawInsights.map(insight => {
      const key = insight.title.trim().toLowerCase()
      const prev = previousByTitle.get(key)
      return {
        ...insight,
        is_new: !prev,
        first_seen: prev?.first_seen ?? now,
      }
    })

    // Archive previous insights before overwriting
    if (previousInsights.length > 0 && cached?.generated_at) {
      supabase
        .from('synthesis_insights_history')
        .insert({
          user_id: userId,
          insights: previousInsights,
          generated_at: cached.generated_at,
          item_count: memories.length + articles.length + projects.length + listItems.length,
        })
        .then(({ error }) => {
          if (error) console.error('[insights-generator] Failed to archive previous insights:', error)
        })
    }

    // Upsert — preserve feedback
    await supabase
      .from('synthesis_insights')
      .upsert(
        { user_id: userId, insights, generated_at: now, feedback },
        { onConflict: 'user_id' }
      )

    const newCount = insights.filter(i => i.is_new).length
    console.log(`[insights-generator] Generated ${insights.length} insights (${newCount} new) for user ${userId}`)
    return insights
  } catch (e) {
    console.error('[insights-generator] Failed to generate insights:', e)
    return []
  }
}

/**
 * Merge genesis-detected opportunity insights into the cached synthesis row.
 * Called fire-and-forget from process-memory — never blocks capture.
 * Deduplicates by title to avoid noise.
 */
export async function mergeGenesisInsights(
  userId: string,
  genesisInsights: GeneratedInsight[]
): Promise<void> {
  if (genesisInsights.length === 0) return
  const supabase = getSupabaseClient()

  const { data } = await supabase
    .from('synthesis_insights')
    .select('insights')
    .eq('user_id', userId)
    .single()

  const existing = (data?.insights as GeneratedInsight[]) || []
  const existingTitles = new Set(existing.map(i => i.title.trim().toLowerCase()))

  const toAdd = genesisInsights.filter(
    i => !existingTitles.has(i.title.trim().toLowerCase())
  )
  if (toAdd.length === 0) return

  await supabase
    .from('synthesis_insights')
    .update({ insights: [...existing, ...toAdd] })
    .eq('user_id', userId)

  console.log(`[insights-generator] Merged ${toAdd.length} genesis insight(s) for user ${userId}`)
}

/**
 * Return cached insights, splitting out the shadow_project for easy consumption.
 */
export async function getCachedInsights(userId: string): Promise<{
  insights: GeneratedInsight[]
  shadow_project: GeneratedInsight | null
  generated_at: string | null
}> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('synthesis_insights')
    .select('insights, generated_at')
    .eq('user_id', userId)
    .single()

  const all = (data?.insights as GeneratedInsight[]) || []
  const shadow_project = all.find(i => i.type === 'shadow_project') ?? null
  const insights = all.filter(i => i.type !== 'shadow_project')

  return {
    insights,
    shadow_project,
    generated_at: data?.generated_at || null,
  }
}

/**
 * Record user feedback (up/down) on a specific insight.
 * Persists across regenerations and steers future prompts.
 */
export async function recordInsightFeedback(
  userId: string,
  insightTitle: string,
  rating: 'up' | 'down'
): Promise<void> {
  const supabase = getSupabaseClient()

  const { data } = await supabase
    .from('synthesis_insights')
    .select('feedback')
    .eq('user_id', userId)
    .single()

  const existing = (data?.feedback as Record<string, 'up' | 'down'>) || {}
  await supabase
    .from('synthesis_insights')
    .update({ feedback: { ...existing, [insightTitle]: rating } })
    .eq('user_id', userId)
}

/**
 * Return the archived history of past insight generations.
 */
export async function getInsightHistory(
  userId: string,
  limit = 10
): Promise<Array<{ insights: GeneratedInsight[]; generated_at: string; item_count: number | null }>> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('synthesis_insights_history')
    .select('insights, generated_at, item_count')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(limit)

  return (data || []).map(row => ({
    insights: row.insights as GeneratedInsight[],
    generated_at: row.generated_at,
    item_count: row.item_count,
  }))
}
