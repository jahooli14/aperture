/**
 * Cognitive Replay Generator
 *
 * Reconstructs a narrative summary of a user's mental state for a given time window.
 * Composes: memories, emotional tone arcs, active projects, themes, and breakthroughs
 * into a "chapter" of their intellectual life.
 */

declare var process: any;

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

export interface ReplayChapter {
  period: { start: string; end: string }
  title: string
  narrative: string
  emotionalArc: Array<{ date: string; tone: string; title: string }>
  dominantThemes: string[]
  activeProjects: Array<{ title: string; status: string; momentum: 'rising' | 'steady' | 'fading' }>
  breakthroughs: string[]
  memoryCount: number
  articleCount: number
}

export async function generateCognitiveReplay(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ReplayChapter> {
  // Load all data for the time window in parallel
  const [memoriesResult, articlesResult, projectsResult, todosResult] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, themes, tags, emotional_tone, triage, created_at')
      .eq('user_id', userId)
      .eq('processed', true)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true }),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, themes, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true }),
    supabase
      .from('projects')
      .select('id, title, description, status, last_active, created_at, metadata')
      .eq('user_id', userId),
    supabase
      .from('todos')
      .select('id, text, done, completed_at, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate),
  ])

  const memories = memoriesResult.data || []
  const articles = articlesResult.data || []
  const projects = projectsResult.data || []
  const todos = todosResult.data || []

  // Build emotional arc from memories
  const emotionalArc = memories
    .filter(m => m.emotional_tone)
    .map(m => ({
      date: new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      tone: m.emotional_tone,
      title: m.title,
    }))

  // Extract dominant themes across the period
  const themeCounts = new Map<string, number>()
  for (const m of memories) {
    for (const theme of m.themes || []) {
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1)
    }
  }
  const dominantThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme]) => theme)

  // Determine project momentum in this window
  const windowStart = new Date(startDate)
  const windowEnd = new Date(endDate)
  const activeProjects = projects
    .filter(p => {
      const lastActive = p.last_active ? new Date(p.last_active) : null
      const created = new Date(p.created_at)
      return (
        (lastActive && lastActive >= windowStart && lastActive <= windowEnd) ||
        (created >= windowStart && created <= windowEnd) ||
        p.status === 'active'
      )
    })
    .map(p => {
      // Count memory references to this project
      const refs = memories.filter(m =>
        m.triage?.project_id === p.id ||
        m.body?.toLowerCase().includes(p.title.toLowerCase())
      ).length

      return {
        title: p.title,
        status: p.status,
        momentum: (refs >= 3 ? 'rising' : refs >= 1 ? 'steady' : 'fading') as 'rising' | 'steady' | 'fading',
      }
    })

  // Collect breakthroughs from bedtime prompts
  let breakthroughs: string[] = []
  try {
    const { data: breakthroughData } = await supabase
      .from('bedtime_prompts')
      .select('prompts')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (breakthroughData) {
      for (const row of breakthroughData) {
        const prompts = row.prompts || []
        for (const p of prompts) {
          if (p.breakthrough) {
            breakthroughs.push(p.content || p.prompt || '')
          }
        }
      }
    }
  } catch {
    // Non-critical
  }

  // If there's not enough data, return a minimal replay
  if (memories.length === 0 && articles.length === 0) {
    return {
      period: { start: startDate, end: endDate },
      title: 'Quiet period',
      narrative: 'No captures during this window. Sometimes the mind needs space to incubate.',
      emotionalArc: [],
      dominantThemes: [],
      activeProjects,
      breakthroughs,
      memoryCount: 0,
      articleCount: 0,
    }
  }

  // Generate narrative via Gemini
  const memoriesSummary = memories
    .map(m => {
      const date = new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `[${date}] "${m.title}": ${(m.body || '').slice(0, 200).replace(/\n/g, ' ')} | tone: ${m.emotional_tone || 'neutral'} | themes: ${(m.themes || []).join(', ')}`
    })
    .join('\n')

  const articlesSummary = articles
    .map(a => {
      const date = new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `[${date}] "${a.title}": ${(a.excerpt || '').slice(0, 120)}`
    })
    .join('\n')

  const projectContext = activeProjects
    .map(p => `- "${p.title}" (${p.status}, momentum: ${p.momentum})`)
    .join('\n')

  const todoSummary = `${todos.length} tasks created, ${todos.filter(t => t.done).length} completed`

  const prompt = `You are writing one chapter of someone's intellectual autobiography. This chapter covers ${startDate} to ${endDate}.

You have their raw notes, saved articles, and project status from this exact period. Your job is to write a narrative that reconstructs what they were THINKING — not just what they did.

THEIR CAPTURES (${memories.length} notes, chronological):
${memoriesSummary || 'None'}

ARTICLES THEY SAVED (${articles.length}):
${articlesSummary || 'None'}

PROJECTS ACTIVE IN THIS PERIOD:
${projectContext || 'None tracked'}

TASK ACTIVITY: ${todoSummary}
${breakthroughs.length > 0 ? `\nBREAKTHROUGH MOMENTS:\n${breakthroughs.map(b => `- ${b}`).join('\n')}` : ''}

---

Write a narrative chapter (3-5 paragraphs) that:
1. Opens with their dominant mental state / emotional energy in this period
2. Identifies the 1-2 threads they were REALLY pulling on (even if they didn't name them)
3. Notes any shifts — when the tone changed, when a new thread emerged, when something was abandoned
4. Connects the dots between their notes and their reading — what were they searching for?
5. Ends with where their mind was pointing at the close of this window

RULES:
- Write in second person ("you were...")
- Use specific dates and titles from their notes — not vague references
- No bullet points — this is narrative prose
- No consultant speak or productivity advice
- Be honest about fallow periods — if they stopped capturing, say what that might mean
- The title should capture the essence of this period in 3-6 words

Return ONLY valid JSON:
{
  "title": "Chapter title (3-6 words)",
  "narrative": "The full narrative, 3-5 paragraphs"
}`

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    let cleanedText = text.trim()
    const markdownMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (markdownMatch) cleanedText = markdownMatch[1].trim()
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText)

    return {
      period: { start: startDate, end: endDate },
      title: parsed.title || 'Untitled chapter',
      narrative: parsed.narrative || '',
      emotionalArc,
      dominantThemes,
      activeProjects,
      breakthroughs,
      memoryCount: memories.length,
      articleCount: articles.length,
    }
  } catch (e) {
    console.error('[cognitive-replay] Generation failed:', e)
    return {
      period: { start: startDate, end: endDate },
      title: 'Replay unavailable',
      narrative: 'Failed to generate narrative for this period. Try again later.',
      emotionalArc,
      dominantThemes,
      activeProjects,
      breakthroughs,
      memoryCount: memories.length,
      articleCount: articles.length,
    }
  }
}
