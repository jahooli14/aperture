/**
 * Insights Generator
 * Uses Gemini Flash to analyse ALL of a user's data and surface "so what" insights —
 * intersections, tensions, patterns, and the meaning beneath the surface activity.
 *
 * Runs fire-and-forget after every new memory entry.
 * Results are cached in synthesis_insights table (one row per user, upserted).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
 * Caches results in synthesis_insights table.
 */
export async function generateInsights(userId: string): Promise<GeneratedInsight[]> {
  const supabase = getSupabaseClient()

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

    // Cache results — one row per user, upserted
    await supabase
      .from('synthesis_insights')
      .upsert(
        { user_id: userId, insights, generated_at: new Date().toISOString() },
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
