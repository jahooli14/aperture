import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
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
  const userId = getUserId()
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = getSupabaseClient()

  try {
    // ─── GET /api/todos?brief=true ────────────────────────────
    if (req.method === 'GET' && req.query.brief === 'true') {
      return await handleTodoBrief(req, res, supabase, userId)
    }

    // ─── GET /api/todos ────────────────────────────────────────
    if (req.method === 'GET') {
      const { include_done, area_id, since } = req.query

      let query = supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (!include_done || include_done === 'false') {
        // Default: only active todos + recently completed (last 24h) for optimistic UI
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.or(`done.eq.false,completed_at.gte.${yesterday.toISOString()}`)
      }

      if (area_id) query = query.eq('area_id', area_id as string)
      if (since) query = query.gte('updated_at', since as string)

      const { data, error } = await query
      if (error) throw error

      return res.status(200).json(data ?? [])
    }

    // ─── GET /api/todos?areas=true ────────────────────────────
    if (req.method === 'GET' && req.query.areas === 'true') {
      const { data, error } = await supabase
        .from('todo_areas')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return res.status(200).json(data ?? [])
    }

    // ─── POST /api/todos ───────────────────────────────────────
    if (req.method === 'POST') {
      const {
        text, notes, scheduled_date, scheduled_time, deadline_date,
        area_id, project_id, tags, priority,
        estimated_minutes, source_memory_id, sort_order
      } = req.body

      if (!text?.trim()) return res.status(400).json({ error: 'text is required' })

      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          text: text.trim(),
          notes: notes ?? null,
          scheduled_date: scheduled_date ?? null,
          scheduled_time: scheduled_time ?? null,
          deadline_date: deadline_date ?? null,
          area_id: area_id ?? null,
          project_id: project_id ?? null,
          tags: tags ?? [],
          priority: priority ?? 0,
          estimated_minutes: estimated_minutes ?? null,
          source_memory_id: source_memory_id ?? null,
          sort_order: sort_order ?? 0,
          done: false,
        })
        .select()
        .single()

      if (error) throw error
      return res.status(201).json(data)
    }

    // ─── PATCH /api/todos ──────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      // Protect: users can only edit their own todos
      const { data: existing } = await supabase
        .from('todos')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (!existing) return res.status(404).json({ error: 'Todo not found' })

      // If completing, stamp completed_at
      if (updates.done === true && !updates.completed_at) {
        updates.completed_at = new Date().toISOString()
      }
      // If un-completing, clear completed_at
      if (updates.done === false) {
        updates.completed_at = null
      }

      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      // Sync: if completing a todo with project_id, mark matching project task done too
      if (data.done && data.project_id) {
        try {
          const { data: project } = await supabase
            .from('projects')
            .select('metadata')
            .eq('id', data.project_id)
            .single()

          if (project?.metadata?.tasks) {
            const todoText = data.text.toLowerCase().trim()
            const updatedTasks = project.metadata.tasks.map((task: any) => {
              if (!task.done && task.text.toLowerCase().trim() === todoText) {
                return { ...task, done: true, completed_at: new Date().toISOString() }
              }
              return task
            })
            await supabase
              .from('projects')
              .update({ metadata: { ...project.metadata, tasks: updatedTasks } })
              .eq('id', data.project_id)
          }
        } catch (syncErr) {
          // Best-effort sync — don't fail the todo update
          console.warn('[todos] Project task sync failed:', syncErr)
        }
      }

      return res.status(200).json(data)
    }

    // ─── DELETE /api/todos ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id, hard } = req.query
      if (!id) return res.status(400).json({ error: 'id is required' })

      if (hard === 'true') {
        // Hard delete (for clearing logbook etc.)
        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('id', id as string)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        // Soft delete (default - recoverable)
        const { error } = await supabase
          .from('todos')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id as string)
          .eq('user_id', userId)
        if (error) throw error
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[todos] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── Daily Brief handler (merged from todo-brief.ts) ──────────────────────
async function handleTodoBrief(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof getSupabaseClient>, userId: string) {
  const today = new Date().toISOString().split('T')[0]

  try {
    const [todosRes, memoriesRes, projectsRes] = await Promise.all([
      supabase
        .from('todos')
        .select('id, text, notes, scheduled_date, deadline_date, priority, estimated_minutes, project_id, source_memory_id, tags, done')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .eq('done', false)
        .or(`scheduled_date.eq.${today},scheduled_date.lt.${today},deadline_date.lte.${today}`)
        .order('priority', { ascending: false }),
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

    const todoSourceIds = new Set(todos.map((t: any) => t.source_memory_id).filter(Boolean))
    const { data: allTodoSources } = await supabase
      .from('todos')
      .select('source_memory_id')
      .eq('user_id', userId)
      .not('source_memory_id', 'is', null)
    const allLinkedMemoryIds = new Set((allTodoSources || []).map((t: any) => t.source_memory_id))

    const unactionedMemories = recentMemories.filter((m: any) =>
      !allLinkedMemoryIds.has(m.id) && m.triage?.category !== 'new_thought'
    )

    if (todos.length === 0 && unactionedMemories.length === 0) {
      return res.status(200).json({ greeting: 'Clear day ahead.', plan: [], nudges: [] })
    }

    const todoList = todos.map((t: any) => {
      const overdue = t.scheduled_date && t.scheduled_date < today ? ' [OVERDUE]' : ''
      const deadline = t.deadline_date ? ` (due: ${t.deadline_date})` : ''
      const est = t.estimated_minutes ? ` ~${t.estimated_minutes}min` : ''
      return `- [${t.id}] ${t.text}${overdue}${deadline}${est} (priority: ${t.priority})`
    }).join('\n')

    const unactionedList = unactionedMemories.slice(0, 5).map((m: any) =>
      `- [${m.id}] "${m.title}" (${new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}): ${m.body?.slice(0, 80)}...`
    ).join('\n')

    const projectList = projects.map((p: any) => {
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
