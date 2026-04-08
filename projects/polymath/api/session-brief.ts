/**
 * Session Brief API
 *
 * Generates a contextual briefing when you open a project.
 * The AI reads the project's current state — phase, momentum, staleness,
 * recent completions, knowledge lake collisions — and tells you what
 * matters right now. This replaces the static "Next Action" card.
 *
 * GET /api/session-brief?projectId=<id>
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_lib/auth.js'
import { getSupabaseClient } from './_lib/supabase.js'
import { generateText } from './_lib/gemini-chat.js'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'

interface Task {
  id: string
  text: string
  done: boolean
  order: number
  task_type?: 'ignition' | 'core' | 'shutdown'
  completed_at?: string
  estimated_minutes?: number
}

interface SessionBrief {
  greeting: string
  phase: 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'
  phaseLabel: string
  focusSuggestion: string
  proactiveQuestion: string
  knowledgeNudge: string | null
  momentum: 'rising' | 'steady' | 'fading' | 'cold'
  completedSinceLastVisit: string[]
  stats: {
    totalTasks: number
    completedTasks: number
    daysSinceActive: number
    progressPercent: number
  }
}

function detectPhase(
  tasks: Task[],
  daysSinceActive: number,
  projectAge: number,
  hasGoal: boolean,
  hasMotivation: boolean
): SessionBrief['phase'] {
  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const progress = total > 0 ? done / total : 0

  // Stale: no activity in 14+ days
  if (daysSinceActive >= 14) return 'stale'

  // Fresh: project is < 3 days old or has no tasks yet
  if (projectAge <= 3 || total === 0) return 'shaping'

  // Shaping: early stage, few tasks, no goal/motivation yet
  if (total <= 3 && !hasGoal && !hasMotivation) return 'shaping'

  // Closing: 75%+ done
  if (progress >= 0.75 && total >= 3) return 'closing'

  // Building: the default active state
  return 'building'
}

function detectMomentum(daysSinceActive: number, recentCompletions: number): SessionBrief['momentum'] {
  if (daysSinceActive >= 14) return 'cold'
  if (daysSinceActive >= 7) return 'fading'
  if (recentCompletions >= 2 && daysSinceActive <= 2) return 'rising'
  return 'steady'
}

const PHASE_LABELS: Record<SessionBrief['phase'], string> = {
  shaping: 'Shaping',
  building: 'Building',
  closing: 'Home Stretch',
  stale: 'Picking Back Up',
  fresh: 'Just Started',
}

async function findKnowledgeNudge(
  projectTitle: string,
  projectDescription: string,
  userId: string,
  projectId: string,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<string | null> {
  // Find recent memories (last 7 days) that semantically match this project
  const searchText = `${projectTitle} ${projectDescription || ''}`
  let embedding: number[]
  try {
    embedding = await generateEmbedding(searchText)
  } catch {
    return null
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentMemories } = await supabase
    .from('memories')
    .select('id, title, body, embedding, created_at')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)
    .not('embedding', 'is', null)

  if (!recentMemories?.length) return null

  const matches = recentMemories
    .map(m => ({
      title: m.title || (m.body || '').slice(0, 60),
      score: cosineSimilarity(embedding, m.embedding as number[]),
      created_at: m.created_at,
    }))
    .filter(m => m.score > 0.42)
    .sort((a, b) => b.score - a.score)

  if (matches.length === 0) return null

  const best = matches[0]
  const daysAgo = Math.floor((Date.now() - new Date(best.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const when = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`

  return `You captured "${best.title}" ${when} — it connects here.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

  const projectId = req.query.projectId as string
  if (!projectId) return res.status(400).json({ error: 'projectId is required' })

  const supabase = getSupabaseClient()

  // Fetch project
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error || !project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const tasks: Task[] = (project.metadata?.tasks as Task[]) || []
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const now = Date.now()
  const lastActive = project.last_active ? new Date(project.last_active).getTime() : new Date(project.created_at).getTime()
  const daysSinceActive = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24))
  const projectAge = Math.floor((now - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24))

  // Count tasks completed in the last 7 days
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const recentCompletions = tasks.filter(t =>
    t.done && t.completed_at && new Date(t.completed_at).getTime() > sevenDaysAgo
  )

  const phase = detectPhase(
    tasks,
    daysSinceActive,
    projectAge,
    !!project.metadata?.end_goal,
    !!project.metadata?.motivation
  )
  const momentum = detectMomentum(daysSinceActive, recentCompletions.length)

  // Find knowledge lake collisions (fire in parallel with AI generation)
  const nudgePromise = findKnowledgeNudge(
    project.title,
    project.description || '',
    userId,
    projectId,
    supabase
  )

  // Build the context for the AI greeting
  const incompleteTasks = tasks.filter(t => !t.done).sort((a, b) => a.order - b.order)
  const recentCompletionTexts = recentCompletions.map(t => t.text)

  const taskSummary = incompleteTasks.length > 0
    ? `UPCOMING TASKS:\n${incompleteTasks.slice(0, 6).map((t, i) => `${i + 1}. ${t.text}${t.task_type ? ` [${t.task_type}]` : ''}`).join('\n')}`
    : 'No tasks defined yet.'

  const completionSummary = recentCompletionTexts.length > 0
    ? `RECENTLY COMPLETED (last 7 days):\n${recentCompletionTexts.map(t => `✓ ${t}`).join('\n')}`
    : ''

  const prompt = `You are a project coach for "${project.title}". Write the opening message someone sees when they open this project. Your job is to move them closer to finishing.

PROJECT: ${project.title}
${project.description ? `DESCRIPTION: ${project.description}` : ''}
${project.metadata?.motivation ? `WHY: ${project.metadata.motivation}` : ''}
${project.metadata?.end_goal ? `FINISH LINE: ${project.metadata.end_goal}` : ''}

PHASE: ${phase} (${PHASE_LABELS[phase]})
MOMENTUM: ${momentum}
DAYS SINCE LAST VISIT: ${daysSinceActive}
PROGRESS: ${completedTasks}/${totalTasks} tasks (${progressPercent}%)

${taskSummary}
${completionSummary}

Write three things:

1. "greeting" — 1-2 sentences in plain everyday English. Like a friend checking in, not a productivity robot. Reference something concrete: what they last did, what's next, or how long it's been. Keep it warm but direct.
   - shaping: Point out what's missing (no goal? no tasks?) and nudge them to define it
   - building: Name the next task and tell them to do it
   - closing: Tell them how close they are and what's left
   - stale: Be honest about the gap, suggest one tiny thing they could do right now

2. "focusSuggestion" — One plain sentence. The ONE thing to do this session. Name the specific task. "Finish writing the outreach message" not "Continue working on communication tasks".

3. "proactiveQuestion" — ONE practical question that drives toward the finish line. Not philosophical. Not abstract. Think "have you actually messaged those 10 people yet?" not "how will you frame the request to ensure alignment with your vision?"
   - No end goal? → "What would the finished version of this actually look like?"
   - No tasks? → "What's the first real thing you need to do?"
   - Stuck? → "What's actually stopping you from doing [next task]?"
   - Building? → "Is [next task] actually the right next move, or are you avoiding something harder?"
   - Closing? → "What's the last thing standing between you and done?"
   ALWAYS reference specific tasks/goals by name. Never be vague.

Rules:
- Plain English. Write like a real person, not a coach or an AI. No buzzwords.
- No filler. No "Great to see you", "Welcome back", "Let's dive in".
- Short sentences. Say it straight.
- Always orient toward the finish line. Every message should make them think about getting this done.
- Second person ("you").

Return JSON only:
{
  "greeting": "your opening line",
  "focusSuggestion": "your one-sentence focus suggestion",
  "proactiveQuestion": "your one question"
}`

  const [aiRaw, knowledgeNudge] = await Promise.all([
    generateText(prompt, { temperature: 0.75, maxTokens: 200, responseFormat: 'json' }),
    nudgePromise,
  ])

  let greeting = ''
  let focusSuggestion = ''
  let proactiveQuestion = ''

  try {
    const parsed = JSON.parse(aiRaw)
    greeting = (parsed.greeting || '').trim()
    focusSuggestion = (parsed.focusSuggestion || '').trim()
    proactiveQuestion = (parsed.proactiveQuestion || '').trim()
  } catch {
    greeting = 'Ready to pick up where you left off.'
    focusSuggestion = incompleteTasks[0]?.text || 'Define what you want to build.'
    proactiveQuestion = !project.metadata?.end_goal
      ? 'What does done actually look like for this?'
      : 'What would you work on if you had 30 minutes right now?'
  }

  const brief: SessionBrief = {
    greeting,
    phase,
    phaseLabel: PHASE_LABELS[phase],
    focusSuggestion,
    proactiveQuestion,
    knowledgeNudge: knowledgeNudge,
    momentum,
    completedSinceLastVisit: recentCompletionTexts,
    stats: {
      totalTasks,
      completedTasks,
      daysSinceActive,
      progressPercent,
    },
  }

  return res.json(brief)
}
