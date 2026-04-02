/**
 * Insights Generator
 * Uses Gemini Flash to analyse ALL of a user's data and surface "so what" insights —
 * intersections, tensions, patterns, and the meaning beneath the surface activity.
 *
 * Runs fire-and-forget after every new memory entry.
 * Debounced: skips generation if last run was <10 minutes ago.
 * Results are cached in synthesis_insights table (one row per user, upserted).
 * Each generation is archived to synthesis_insights_history before overwriting.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const DEBOUNCE_MS = 10 * 60 * 1000 // 10 minutes

interface InsightData {
  evidence?: string[]
  recommendation?: string
  timeline?: Array<{ date: string; stance: string; quote?: string }>
  [key: string]: unknown
}

export interface GeneratedInsight {
  type: 'collision' | 'pattern' | 'evolution' | 'opportunity'
  title: string
  description: string
  data: InsightData
  actionable: boolean
  action?: string
}

/**
 * Generate fresh insights from all user data using Gemini Flash.
 * - Debounced: skips if last generation was <10 minutes ago.
 * - Incremental: passes previous insights to the model to evolve, not restart.
 * - Archives: saves previous insights to history before overwriting.
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

  const previousInsights = (cached?.insights as GeneratedInsight[]) || []
  const feedback = (cached?.feedback as Record<string, 'up' | 'down'>) || {}

  // Load everything in parallel — we want the full picture
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
      .select('id, title, description, status, metadata')
      .eq('user_id', userId),
    supabase
      .from('list_items')
      .select('id, content, metadata')
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

  // Format data compactly — Gemini needs the full picture but context is finite
  const memoriesSummary = memories
    .map(m =>
      `[${new Date(m.created_at).toLocaleDateString('en-GB')}] "${m.title}": ${(m.body || '').slice(0, 200).replace(/\n/g, ' ')} | themes: ${(m.themes || []).join(', ')} | tone: ${m.emotional_tone || ''}`
    )
    .join('\n')

  const articlesSummary = articles
    .map(a =>
      `"${a.title}": ${(a.excerpt || '').slice(0, 120).replace(/\n/g, ' ')} | themes: ${(a.themes || []).join(', ')}`
    )
    .join('\n')

  const projectsSummary = projects
    .map(p => `"${p.title}" (${p.status}): ${(p.description || '').slice(0, 120)}`)
    .join('\n')

  const listsSummary = listItems
    .map(i => i.content || (i.metadata as any)?.title || '')
    .filter(Boolean)
    .join(', ')
    .slice(0, 500)

  // Build the evolution section if we have previous insights to evolve
  const dislikedTitles = Object.entries(feedback)
    .filter(([, rating]) => rating === 'down')
    .map(([title]) => title)

  const evolutionSection = previousInsights.length > 0
    ? `
PREVIOUS INSIGHTS (evolve these — don't just restate them):
${previousInsights.map(i => `- [${i.type}] "${i.title}": ${i.description}`).join('\n')}
${dislikedTitles.length > 0 ? `\nThe user found these previous insights unhelpful — avoid similar patterns:\n${dislikedTitles.map(t => `- "${t}"`).join('\n')}` : ''}

Update, sharpen, or replace the previous insights based on everything you now see. If a previous insight has grown stronger with new evidence, evolve it. If something genuinely new has emerged, surface it. Drop anything that no longer rings true.`
    : ''

  const prompt = `You have complete access to everything this person has written, saved, and created. Your job is to find the "so what" — the patterns, tensions, and intersections that this person probably can't see because they're too close to it.

Don't be a search engine. Don't just say "you think about X a lot". Say what THAT MEANS. What's the deeper truth? What's the unresolved tension? What's the thing they keep circling but haven't named yet? What would a perceptive friend say after reading all of this?

THEIR THOUGHTS & MEMORIES (${memories.length} total, most recent first):
${memoriesSummary || 'None yet'}

ARTICLES THEY SAVED (${articles.length} total):
${articlesSummary || 'None yet'}

PROJECTS (${projects.length} total):
${projectsSummary || 'None yet'}

THINGS THEY TRACK (lists, films, books, etc.):
${listsSummary || 'None yet'}
${evolutionSection}

---

Generate 5–8 insights. Each should be a genuine "aha" — the kind of thing that makes someone sit up and say "yes, exactly". No filler, no hedging, no startup speak.

Focus on:
1. Intersections between domains/interests that haven't been explicitly connected
2. Recurring tensions or contradictions — saying one thing, doing another
3. Skills or interests that keep appearing but haven't become a project yet
4. Evidence of belief evolution — where thinking has clearly shifted
5. The "shadow project" — what they're REALLY building toward beneath all the surface activity
6. Cross-domain synthesis — where their reading and their doing point at the same thing from different angles

Insight types:
- "collision" = a tension or contradiction between things they believe or do
- "pattern" = a recurring theme with a clear "so what" (not just an observation)
- "evolution" = their thinking has visibly shifted on something important
- "opportunity" = a specific intersection of skills/interests that points somewhere concrete

Rules:
- NO startup speak. "Leverage", "synergize", "unlock", "actionable insights" are banned.
- Write like a smart friend, not a consultant.
- Each description must deliver the actual insight in 2–3 sentences. Don't describe the pattern — deliver the conclusion.
- source evidence from actual titles/themes in the data above.

Return ONLY a JSON array (no markdown, no explanation):
[{
  "type": "collision|pattern|evolution|opportunity",
  "title": "Sharp, direct title — not a question",
  "description": "The insight itself. Specific, concrete, no hedging.",
  "data": {
    "evidence": ["specific memory title or article title or theme that grounds this"],
    "recommendation": "one concrete thing to do with this insight"
  },
  "actionable": true,
  "action": "specific next step"
}]`

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    let cleanedText = text.trim()
    const markdownMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (markdownMatch) cleanedText = markdownMatch[1].trim()
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
    const insights: GeneratedInsight[] = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText)

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
        .then(() => {})
        .catch(() => {}) // Non-critical
    }

    // Cache results — one row per user, upserted. Preserve existing feedback.
    await supabase
      .from('synthesis_insights')
      .upsert(
        { user_id: userId, insights, generated_at: new Date().toISOString(), feedback },
        { onConflict: 'user_id' }
      )

    console.log(`[insights-generator] Generated ${insights.length} insights for user ${userId}`)
    return insights
  } catch (e) {
    console.error('[insights-generator] Failed to generate insights:', e)
    return []
  }
}

/**
 * Return cached insights for a user. Returns empty array if none cached yet.
 */
export async function getCachedInsights(
  userId: string
): Promise<{ insights: GeneratedInsight[]; generated_at: string | null }> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('synthesis_insights')
    .select('insights, generated_at')
    .eq('user_id', userId)
    .single()

  return {
    insights: (data?.insights as GeneratedInsight[]) || [],
    generated_at: data?.generated_at || null,
  }
}

/**
 * Record user feedback (up/down) on a specific insight by title.
 * Feedback persists across regenerations and is used to steer future prompts.
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
  const updated = { ...existing, [insightTitle]: rating }

  await supabase
    .from('synthesis_insights')
    .update({ feedback: updated })
    .eq('user_id', userId)
}

/**
 * Return the archived history of past insight generations for a user.
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
