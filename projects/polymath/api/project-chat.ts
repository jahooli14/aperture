/**
 * Project Chat API
 *
 * Contextual AI chat for an active project. Unlike the brainstorm endpoint
 * (which is for project creation), this is for working alongside someone
 * on a project they're already building. It knows their task list, recent
 * completions, and power hour suggestions — so the conversation is grounded
 * in where the project actually is, not where it started.
 *
 * POST /api/project-chat
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from './_lib/auth.js'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { generateText } from './_lib/gemini-chat.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface Task {
  text: string
  done: boolean
  is_ai_suggested?: boolean
  task_type?: 'ignition' | 'core' | 'shutdown'
}

interface PowerHourSuggestion {
  task_title: string
  task_description?: string
}

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

interface SuggestedTask {
  text: string
  task_type: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

async function searchKnowledgeLake(text: string, userId: string, excludeProjectId?: string): Promise<EchoItem[]> {
  let embedding: number[]
  try {
    embedding = await generateEmbedding(text)
  } catch {
    return []
  }

  const [memoriesRes, articlesRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null),
  ])

  const memories: EchoItem[] = (memoriesRes.data || [])
    .map((m: { title?: string; body?: string; embedding: number[] }) => ({
      title: m.title || (m.body || '').slice(0, 60),
      snippet: (m.body || '').slice(0, 120),
      score: cosineSimilarity(embedding, m.embedding),
      type: 'memory' as const,
    }))
    .filter((m: { score: number }) => m.score > 0.4)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, 4)
    .map(({ title, snippet, type }: { title: string; snippet: string; type: 'memory' }) => ({ title, snippet, type }))

  const articles: EchoItem[] = (articlesRes.data || [])
    .map((a: { title?: string; excerpt?: string; embedding: number[] }) => ({
      title: a.title || 'Untitled',
      snippet: (a.excerpt || '').slice(0, 120),
      score: cosineSimilarity(embedding, a.embedding),
      type: 'article' as const,
    }))
    .filter((a: { score: number }) => a.score > 0.4)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, 2)
    .map(({ title, snippet, type }: { title: string; snippet: string; type: 'article' }) => ({ title, snippet, type }))

  return [...memories, ...articles]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = await getUserId(req)
    const {
      projectId,
      projectTitle,
      projectDescription,
      projectMotivation,
      projectGoal,
      tasks = [],
      powerHourSuggestions = [],
      message,
      history = [],
    } = req.body as {
      projectId: string
      projectTitle: string
      projectDescription?: string
      projectMotivation?: string
      projectGoal?: string
      tasks?: Task[]
      powerHourSuggestions?: PowerHourSuggestion[]
      message: string
      history?: ConversationMessage[]
    }

    if (!message || !projectTitle) {
      return res.status(400).json({ error: 'message and projectTitle are required' })
    }

    // Search knowledge lake for connections to this message
    const echoes = await searchKnowledgeLake(message, userId, projectId)

    // Build task context
    const pendingTasks = tasks.filter(t => !t.done)
    const recentlyCompleted = tasks.filter(t => t.done).slice(-5)

    const taskBlock = pendingTasks.length > 0
      ? `PENDING TASKS (${pendingTasks.length}):\n${pendingTasks.map((t, i) => `${i + 1}. ${t.text}${t.is_ai_suggested ? ' [AI suggested]' : ''}`).join('\n')}`
      : 'PENDING TASKS: none'

    const completedBlock = recentlyCompleted.length > 0
      ? `\nRECENTLY COMPLETED:\n${recentlyCompleted.map(t => `✓ ${t.text}`).join('\n')}`
      : ''

    const powerHourBlock = powerHourSuggestions.length > 0
      ? `\nPOWER HOUR SUGGESTIONS (AI-generated session plan):\n${powerHourSuggestions.map(s => `- ${s.task_title}${s.task_description ? `: ${s.task_description}` : ''}`).join('\n')}`
      : ''

    const echoBlock = echoes.length > 0
      ? `\nRELEVANT FROM KNOWLEDGE LAKE:\n${echoes.map(e => `- "${e.title}" (${e.type}): ${e.snippet}`).join('\n')}`
      : ''

    const projectContext = [
      `PROJECT: ${projectTitle}`,
      projectDescription ? `DESCRIPTION: ${projectDescription}` : '',
      projectMotivation ? `MOTIVATION: ${projectMotivation}` : '',
      projectGoal ? `GOAL: ${projectGoal}` : '',
    ].filter(Boolean).join('\n')

    const priorTurns = (history as ConversationMessage[])
      .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
      .join('\n')

    const prompt = `You are working alongside someone on their project. You know where it stands right now — their task list, what they've just finished, what the AI has suggested for their next session.

${projectContext}

${taskBlock}${completedBlock}${powerHourBlock}${echoBlock}

Your role: be a sharp thinking partner for this specific project. Help them think through what to do next, unblock stuck points, brainstorm approaches. You can propose concrete tasks if they ask or if it would clearly help.

Rules:
- Short. 2-4 sentences unless they ask for more.
- No filler. Never start with "Great", "Interesting", "Absolutely", or any variant.
- Plain language. Short sentences. Say the thing directly.
- If you spot something in their knowledge lake that connects, name it.
- Reference their actual tasks by name when relevant — show you know where they are.
- If you suggest tasks, put them in the suggestedTasks array. Don't list tasks in your reply text if you're returning them structured.
- At most one question. Often none is better.
- Write like a person, not software.
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

Return JSON only:
{
  "reply": "your response",
  "suggestedTasks": [
    {
      "text": "specific actionable task",
      "task_type": "ignition" | "core" | "shutdown",
      "estimated_minutes": 15,
      "reasoning": "one sentence on why this task"
    }
  ]
}

Only include suggestedTasks if you're genuinely recommending specific tasks to add to their list. Leave it empty [] if you're just having a conversation. task_type: ignition = breaks inertia (setup, small starts), core = main work, shutdown = wraps up session.`

    const raw = await generateText(prompt, { temperature: 0.72, maxTokens: 400, responseFormat: 'json' })

    let reply = ''
    let suggestedTasks: SuggestedTask[] = []

    try {
      const parsed = JSON.parse(raw)
      reply = (parsed.reply || '').trim()
      suggestedTasks = Array.isArray(parsed.suggestedTasks) ? parsed.suggestedTasks : []
    } catch {
      reply = raw.trim()
    }

    return res.json({ reply, suggestedTasks, echoes })

  } catch (error) {
    console.error('[ProjectChat] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
