/**
 * AI Daily Brief — "Here's your day, here's why"
 *
 * Generates a personalized daily plan by analyzing:
 * - Today's todos + overdue items with context
 * - Recent unactioned memories (thoughts without linked todos)
 * - Active project momentum
 *
 * Returns a proposed day structure with reasoning and nudges.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { MODELS } from './_lib/models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface DailyBrief {
  greeting: string
  plan: Array<{
    todo_id: string
    reasoning: string
  }>
  nudges: Array<{
    text: string
    source_memory_id?: string
    suggested_todo_text?: string
  }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = getSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    // Fetch in parallel: today's todos, recent unactioned memories, active projects
    const [todosRes, memoriesRes, projectsRes] = await Promise.all([
      supabase
        .from('todos')
        .select('id, text, notes, scheduled_date, deadline_date, priority, estimated_minutes, project_id, source_memory_id, tags, done')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .eq('done', false)
        .or(`scheduled_date.eq.${today},scheduled_date.lt.${today},deadline_date.lte.${today}`)
        .order('priority', { ascending: false }),

      // Recent memories without linked todos (unactioned thoughts)
      supabase
        .from('memories')
        .select('id, title, body, themes, triage, created_at')
        .eq('user_id', userId)
        .eq('processed', true)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('projects')
        .select('id, title, status, last_active')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_active', { ascending: true })
        .limit(5),
    ])

    const todos = todosRes.data || []
    const recentMemories = memoriesRes.data || []
    const projects = projectsRes.data || []

    // Find unactioned memories (no linked todo)
    const todoSourceIds = new Set(todos.map(t => t.source_memory_id).filter(Boolean))
    const { data: allTodoSources } = await supabase
      .from('todos')
      .select('source_memory_id')
      .eq('user_id', userId)
      .not('source_memory_id', 'is', null)
    const allLinkedMemoryIds = new Set((allTodoSources || []).map(t => t.source_memory_id))

    const unactionedMemories = recentMemories.filter(m =>
      !allLinkedMemoryIds.has(m.id) &&
      m.triage?.category !== 'new_thought' // Skip pure musings
    )

    // If no todos and no unactioned memories, return empty brief
    if (todos.length === 0 && unactionedMemories.length === 0) {
      return res.status(200).json({
        greeting: 'Clear day ahead.',
        plan: [],
        nudges: [],
      })
    }

    // Build prompt
    const todoList = todos.map(t => {
      const overdue = t.scheduled_date && t.scheduled_date < today ? ' [OVERDUE]' : ''
      const deadline = t.deadline_date ? ` (due: ${t.deadline_date})` : ''
      const est = t.estimated_minutes ? ` ~${t.estimated_minutes}min` : ''
      return `- [${t.id}] ${t.text}${overdue}${deadline}${est} (priority: ${t.priority})`
    }).join('\n')

    const unactionedList = unactionedMemories.slice(0, 5).map(m =>
      `- [${m.id}] "${m.title}" (${new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}): ${m.body?.slice(0, 80)}...`
    ).join('\n')

    const projectList = projects.map(p => {
      const stale = p.last_active && (Date.now() - new Date(p.last_active).getTime()) > 3 * 86400000
      return `- ${p.title}${stale ? ' [STALE - no activity in 3+ days]' : ''}`
    }).join('\n')

    const hour = new Date().getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

    const prompt = `You are a concise personal productivity assistant. It's ${timeOfDay}.

TODAY'S TODOS (${todos.length}):
${todoList || '(none)'}

RECENT UNACTIONED THOUGHTS (captured this week, no todo created):
${unactionedList || '(none)'}

ACTIVE PROJECTS:
${projectList || '(none)'}

Generate a daily brief:

1. greeting: A single warm, specific sentence (max 15 words). Reference what's ahead, not generic motivation.

2. plan: For each todo above, provide a 1-sentence reason why it matters or how to approach it. Order them by suggested execution sequence. Use the todo IDs.

3. nudges: 0-2 items from the unactioned thoughts that deserve action. For each, provide:
   - text: Why this thought deserves a todo (max 20 words, specific)
   - source_memory_id: The memory ID
   - suggested_todo_text: A concrete todo phrased as an action

RULES:
- Be specific, not generic. Reference actual content.
- Don't repeat todo text — add NEW insight about sequence or approach.
- Only nudge thoughts that clearly have an unresolved action.

Return JSON only:
{
  "greeting": "...",
  "plan": [{"todo_id": "...", "reasoning": "..."}],
  "nudges": [{"text": "...", "source_memory_id": "...", "suggested_todo_text": "..."}]
}`

    const model = genAI.getGenerativeModel({
      model: MODELS.DEFAULT_CHAT,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    let brief: DailyBrief
    try {
      brief = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')
      brief = JSON.parse(match[0])
    }

    return res.status(200).json(brief)
  } catch (error) {
    console.error('[todo-brief] Error:', error)
    return res.status(500).json({ error: 'Failed to generate brief' })
  }
}
