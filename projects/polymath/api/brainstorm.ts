/**
 * Brainstorm API
 *
 * Conversational project ideation with knowledge-lake awareness.
 * Modes:
 *   shaping        — deep interrogation to shape a new or unshaped project
 *   extract        — distill the conversation into a structured project definition
 *   studio-magic   — AI writing partner for the Studio tab
 *   project-chat   — contextual AI chat for an active project (replaces /api/project-chat)
 *   portfolio-chat — "what should I work on" triage across all projects (Home)
 *
 * POST /api/brainstorm
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from './_lib/auth.js'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { generateText } from './_lib/gemini-chat.js'
import { PLAIN_ENGLISH_RULES, CHAT_TURN_RULES } from './_lib/plain-english.js'
import { handlePortfolioChat } from './_lib/portfolio-chat.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

interface LakeResults {
  memories: EchoItem[]
  articles: EchoItem[]
  projects: EchoItem[]
  all: EchoItem[]
}

async function searchKnowledgeLake(text: string, userId: string, excludeProjectId?: string): Promise<LakeResults> {
  let embedding: number[]
  try {
    embedding = await generateEmbedding(text)
  } catch (e) {
    console.warn('[Brainstorm] Embedding failed, skipping knowledge lake search', e)
    return { memories: [], articles: [], projects: [], all: [] }
  }

  // No row limits — cosine similarity is cheap, and we want old things to resurface.
  // The whole database is scanned in memory; Gemini Flash Lite keeps this economical.
  const [memoriesRes, articlesRes, projectsRes] = await Promise.all([
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
    supabase
      .from('projects')
      .select('id, title, description, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null),
  ])

  const memories: EchoItem[] = (memoriesRes.data || [])
    .map(m => ({
      title: m.title || (m.body || '').slice(0, 60),
      snippet: (m.body || '').slice(0, 120),
      score: cosineSimilarity(embedding, m.embedding as number[]),
      type: 'memory' as const,
    }))
    .filter(m => m.score > 0.38)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ title, snippet, type }) => ({ title, snippet, type }))

  const articles: EchoItem[] = (articlesRes.data || [])
    .map(a => ({
      title: a.title || 'Untitled',
      snippet: (a.excerpt || '').slice(0, 120),
      score: cosineSimilarity(embedding, a.embedding as number[]),
      type: 'article' as const,
    }))
    .filter(a => a.score > 0.38)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ title, snippet, type }) => ({ title, snippet, type }))

  const projects: EchoItem[] = (projectsRes.data || [])
    .filter(p => !excludeProjectId || p.id !== excludeProjectId)
    .map(p => ({
      title: p.title || 'Untitled',
      snippet: (p.description || '').slice(0, 120),
      score: cosineSimilarity(embedding, p.embedding as number[]),
      type: 'project' as const,
    }))
    .filter(p => p.score > 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ title, snippet, type }) => ({ title, snippet, type }))

  return { memories, articles, projects, all: [...memories, ...articles, ...projects] }
}

function buildContextBlock(results: LakeResults): string {
  const parts: string[] = []

  if (results.memories.length > 0) {
    parts.push('NOTES FROM THEIR KNOWLEDGE LAKE:\n' +
      results.memories.map(m => `- "${m.title}": ${m.snippet}`).join('\n'))
  }
  if (results.articles.length > 0) {
    parts.push('ARTICLES THEY\'VE SAVED:\n' +
      results.articles.map(a => `- "${a.title}": ${a.snippet}`).join('\n'))
  }
  if (results.projects.length > 0) {
    parts.push('RELATED EXISTING PROJECTS:\n' +
      results.projects.map(p => `- "${p.title}": ${p.snippet}`).join('\n'))
  }

  return parts.join('\n\n')
}

// ─── Mode: shaping ──────────────────────────────────────────────────────────
// Deep project interrogation — probes motivation, constraints, skills, tools, end state.
// Used when shaping a new idea or an existing unshaped project.

async function handleShaping(
  body: { message: string; history?: ConversationMessage[]; projectTitle?: string; projectDescription?: string },
  userId: string
): Promise<{ reply: string; echoes: EchoItem[]; readyToExtract: boolean }> {
  const { message, history = [], projectTitle, projectDescription } = body

  const lakeResults = await searchKnowledgeLake(message, userId)
  const contextBlock = buildContextBlock(lakeResults)

  const priorTurns = history
    .map(m => `${m.role === 'user' ? 'USER' : 'SHAPING PARTNER'}: ${m.content}`)
    .join('\n')

  const projectContext = projectTitle
    ? `\nThe user is shaping this idea: "${projectTitle}"${projectDescription ? ` — ${projectDescription}` : ''}\n`
    : ''

  // Extract first, ask at most one thing (project-shaping.ts's rule, now
  // applied to the chat too). The old version worked through six topics
  // and wouldn't let go until four of them were "genuinely clear", which
  // made every new project a six-question interview. The plan only needs
  // two things, and a third when it's there: what they're making, what
  // done looks like, and what's already in hand.
  const userTurns = history.filter(m => m.role === 'user').length + 1

  const prompt = `Someone is telling you about a creative project they want to start. Help them say
it clearly enough to plan from. You're a friend who's paying attention, not an
interviewer.

${PLAIN_ENGLISH_RULES}

WHAT THE PLAN NEEDS, and nothing more:
1. WHAT THEY'RE MAKING — a concrete thing. "A three-track EP", "a stencil print
   for the hallway", not "getting into printmaking".
2. WHAT DONE LOOKS LIKE — the state where they'd stop. Something you could
   point at. If it's an ongoing thing with no end (DJing, a sketchbook habit),
   that counts as an answer: it's ongoing.
3. WHAT'S ALREADY IN HAND — anything they've already made, got, or decided.
   Only if they mention it; never ask for a list.

HOW TO REPLY:
- First, read everything they've said so far and work out which of 1 and 2
  is still missing. Usually one of them is already answered by the time
  they've finished talking.
- If something's missing, ask ONE plain question that gets it. Tie it to
  what they just said. Not "tell me more" — the specific thing.
- If nothing's missing, don't ask. Say back in one sentence what you've got,
  so they can correct it, and stop.
- Never ask why it matters, who it's for, what tools they have, or how
  much time they've got. None of that changes the first step.
${CHAT_TURN_RULES}
- If you spot something in their notes that connects, name it in a few
  words. Don't make a question out of it.
- Never tell them what they "haven't" figured out.
${projectContext}
${contextBlock ? `\n${contextBlock}\n` : ''}
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

This is their turn number ${userTurns}. By turn 3 you should have what you need.

Set readyToExtract to true when 1 and 2 are both clear (or 2 is "ongoing").
Not "assumed" — said. If one is still missing, false.

Return JSON only:
{
  "reply": "your response",
  "readyToExtract": false
}`

  const raw = await generateText(prompt, { temperature: 0.6, maxTokens: 250, responseFormat: 'json' })

  try {
    const parsed = JSON.parse(raw)
    return {
      reply: (parsed.reply || '').trim(),
      echoes: lakeResults.all.slice(0, 6),
      // Three turns is the interview budget. After that the shape is
      // extracted from whatever was said, and the one gap the extraction
      // finds gets asked on the commit screen instead of here.
      readyToExtract: parsed.readyToExtract === true || userTurns >= 3,
    }
  } catch {
    // Don't surface raw JSON as if it were a chat reply — that reads as a
    // broken bot, the exact thing this whole feature is trying not to be.
    return {
      reply: "Lost my train of thought there — say that again?",
      echoes: lakeResults.all.slice(0, 6),
      readyToExtract: false,
    }
  }
}

// ─── Mode: extract ────────────────────────────────────────────────────────────

async function handleExtract(
  body: { history: ConversationMessage[] },
  userId: string
): Promise<{
  title: string
  description: string
  type: string
  project_mode: string
  end_goal: string
  first_step: string
  genesisDraft: string
}> {
  const { history } = body

  const conversationText = history
    .map(m => `${m.role === 'user' ? 'You' : 'Thinking partner'}: ${m.content}`)
    .join('\n')

  const prompt = `A conversation about a project idea:

${conversationText}

Pull the project out of what THEY said. Say nothing they didn't: no gear,
brands, formats, people or places unless they named them. Every step of
the plan gets worked backwards from the finish line, so a guessed one
poisons the lot -- if they never said what done looks like, end_goal is
null, not a plausible guess.

Also write a "genesis draft": the conversation retold as a first-person
journal entry (3-5 sentences), in their words where possible.

${PLAIN_ENGLISH_RULES}

Return JSON only:
{
  "title": "short, concrete, what they'd call it themselves. Not a slogan. 6 words max",
  "description": "1-2 plain sentences: what this is",
  "type": "exactly one of: Writing, Tech, Art, Music, Business, Creative",
  "project_mode": "completion if there is a state where they'd stop; recurring if it's ongoing with no end",
  "end_goal": "what they'll have when it's finished, in their words, or null. 'The print is framed and on the hallway wall', not 'a finished piece'",
  "first_step": "the first thing they said they'd do, if they said one, else null",
  "genesisDraft": "the conversation as a first-person journal entry"
}`

  const raw = await generateText(prompt, { temperature: 0.3, maxTokens: 600, responseFormat: 'json' })

  try {
    const parsed = JSON.parse(raw)
    const clean = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : '')
    return {
      title: clean(parsed.title),
      description: clean(parsed.description),
      type: clean(parsed.type) || 'Creative',
      project_mode: parsed.project_mode === 'recurring' ? 'recurring' : 'completion',
      end_goal: clean(parsed.end_goal),
      first_step: clean(parsed.first_step),
      genesisDraft: clean(parsed.genesisDraft) || conversationText,
    }
  } catch {
    return {
      title: '',
      description: '',
      type: 'Creative',
      project_mode: 'completion',
      end_goal: '',
      first_step: '',
      genesisDraft: conversationText,
    }
  }
}

// ─── Mode: studio-magic ───────────────────────────────────────────────────────

async function handleStudioMagic(
  body: { projectTitle: string; projectDescription: string; draft: string; projectId?: string },
  userId: string
): Promise<{
  ghost: string
  provocations: string[]
  connections: Array<{ title: string; type: string; insight: string }>
}> {
  const { projectTitle, projectDescription, draft, projectId } = body

  if (!draft || draft.trim().length < 20) {
    return {
      ghost: '',
      provocations: ['Write something first — even a single messy sentence is enough to work with.'],
      connections: [],
    }
  }

  const lakeResults = await searchKnowledgeLake(
    `${projectTitle} ${draft.slice(0, 500)}`,
    userId,
    projectId
  )
  const contextBlock = buildContextBlock(lakeResults)

  const prompt = `You are an editor and writing partner. The user is working on a project called "${projectTitle}".
${projectDescription ? `Project: ${projectDescription}\n` : ''}
Their studio draft:
"""
${draft.slice(0, 2000)}
"""
${contextBlock ? `\nFrom their knowledge lake:\n${contextBlock}\n` : ''}
Do three things:

1. Write a "ghost" — a short paragraph (3-5 sentences) that continues from where their draft ends, written in their voice. Not a summary of what they wrote. Take one step further. Something they might steal, react to, or discard. Write it as if you are them, continuing their thought. Match their vocabulary and rhythm.

2. Write 3 "provocations" — specific, pointed observations or questions targeted at this exact draft. Not generic writing advice. Think: a brilliant editor's marginalia. Name assumptions they're making, gaps in the argument, the thing they're circling without quite saying. Be uncomfortable.

${PLAIN_ENGLISH_RULES}
   BAD provocation: "Your text exhibits an unresolved tension between narrative substrate and emergent thematic actualization."
   GOOD provocation: "You say the project is about constraint, but every example you cite is about freedom. Which is it?"

3. Identify up to 3 items from their knowledge lake where there's a genuine insight in the collision with this draft — not just topical similarity, but something that would actually change how they think about what they're writing.

Return JSON only:
{
  "ghost": "paragraph continuing their draft in their voice",
  "provocations": ["...", "...", "..."],
  "connections": [
    { "title": "item title", "type": "memory or article", "insight": "one sentence on why this matters here specifically" }
  ]
}`

  const raw = await generateText(prompt, { temperature: 0.82, maxTokens: 800, responseFormat: 'json' })

  try {
    const result = JSON.parse(raw)
    return {
      ghost: result.ghost || '',
      provocations: Array.isArray(result.provocations) ? result.provocations : [],
      connections: Array.isArray(result.connections) ? result.connections : [],
    }
  } catch {
    return {
      ghost: '',
      provocations: ['Something went wrong — try adding more content to the studio.'],
      connections: [],
    }
  }
}

// ─── Mode: project-chat ───────────────────────────────────────────────────────

interface ProjectTask {
  id: string
  text: string
  done: boolean
  is_ai_suggested?: boolean
  ai_reasoning?: string
  task_type?: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
}

interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit' | 'add' | 'move'
  taskId?: string
  newText?: string
  /** move: the task this one goes after. Null/absent means the top. */
  afterTaskId?: string | null
  task_type?: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

interface GoalUpdate {
  newGoal: string
  reasoning?: string
}

interface NoteAppend {
  text: string
  reasoning?: string
}

interface PowerHourSuggestion {
  task_title: string
  task_description?: string
}

interface SuggestedTask {
  text: string
  task_type: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

async function searchKnowledgeLakeSimple(text: string, userId: string, excludeProjectId?: string): Promise<EchoItem[]> {
  let embedding: number[]
  try {
    embedding = await generateEmbedding(text)
  } catch {
    return []
  }

  const [memoriesRes, articlesRes] = await Promise.all([
    supabase.from('memories').select('id, title, body, embedding').eq('user_id', userId).not('embedding', 'is', null),
    supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).not('embedding', 'is', null),
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

async function handleProjectChat(
  body: {
    projectId: string
    projectTitle: string
    projectDescription?: string
    projectMotivation?: string
    projectGoal?: string
    projectNotes?: string | null
    tasks?: ProjectTask[]
    powerHourSuggestions?: PowerHourSuggestion[]
    message: string
    history?: ConversationMessage[]
    /** From the session brief shown when the panel opened — carries the
     *  opening framing forward so a mid-conversation reply doesn't
     *  contradict how the session started. */
    phase?: 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'
    momentum?: 'rising' | 'steady' | 'fading' | 'cold'
  },
  userId: string
): Promise<{ reply: string; suggestedTasks: SuggestedTask[]; taskOps: TaskOp[]; goalUpdate: GoalUpdate | null; noteAppend: NoteAppend | null; echoes: EchoItem[] }> {
  const {
    projectId,
    projectTitle,
    projectDescription,
    projectMotivation,
    projectGoal,
    projectNotes,
    tasks = [],
    powerHourSuggestions = [],
    message,
    history = [],
    phase,
    momentum,
  } = body

  if (!message || !projectTitle) {
    throw Object.assign(new Error('message and projectTitle are required'), { status: 400 })
  }

  const echoes = await searchKnowledgeLakeSimple(message, userId, projectId)

  const pendingTasks = tasks.filter(t => !t.done)
  const recentlyCompleted = tasks.filter(t => t.done).slice(-5)
  const listFeelsBloated = pendingTasks.length >= 8

  const taskBlock = pendingTasks.length > 0
    ? `PENDING TASKS (${pendingTasks.length}${listFeelsBloated ? ' — LIST IS LONG, consider auditing' : ''}):\n${pendingTasks.map((t, i) => {
        const tags = [
          t.is_ai_suggested ? 'AI-suggested' : null,
          t.task_type || null,
          t.estimated_minutes ? `${t.estimated_minutes}m` : null,
        ].filter(Boolean).join(' · ')
        const tagPart = tags ? ` [${tags}]` : ''
        const reasonPart = t.ai_reasoning ? `\n     ↳ why it was added: ${t.ai_reasoning}` : ''
        return `${i + 1}. [id:${t.id}] ${t.text}${tagPart}${reasonPart}`
      }).join('\n')}`
    : 'PENDING TASKS: none (list is empty — propose starter tasks only if the finish line is set)'

  const completedBlock = recentlyCompleted.length > 0
    ? `\nRECENTLY COMPLETED:\n${recentlyCompleted.map(t => `✓ [id:${t.id}] ${t.text}`).join('\n')}`
    : ''

  const powerHourBlock = powerHourSuggestions.length > 0
    ? `\nPOWER HOUR SUGGESTIONS (AI-generated session plan):\n${powerHourSuggestions.map(s => `- ${s.task_title}${s.task_description ? `: ${s.task_description}` : ''}`).join('\n')}`
    : ''

  const echoBlock = echoes.length > 0
    ? `\nRELEVANT FROM KNOWLEDGE LAKE:\n${echoes.map(e => `- "${e.title}" (${e.type}): ${e.snippet}`).join('\n')}`
    : ''

  const notesTrimmed = (projectNotes || '').trim().slice(0, 2000)
  const projectContext = [
    `PROJECT: ${projectTitle}`,
    projectDescription ? `DESCRIPTION: ${projectDescription}` : '',
    projectMotivation ? `MOTIVATION: ${projectMotivation}` : '',
    projectGoal ? `GOAL: ${projectGoal}` : '',
    notesTrimmed ? `NOTES (the project's freeform content space):\n${notesTrimmed}` : '',
  ].filter(Boolean).join('\n')

  const priorTurns = history
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n')

  const hasGoal = !!(projectGoal && projectGoal.trim())
  // phase/momentum come from the session-brief opening greeting the user
  // already saw when the panel loaded — carry that framing forward so this
  // reply doesn't contradict it (e.g. brief said "it's been a while, ease
  // back in gently" and the next reply shouldn't demand a sprint).
  const sessionLine = phase
    ? `\n- Session opened as: ${phase}${momentum ? `, momentum ${momentum}` : ''}${phase === 'stale' ? ' — they just came back after a gap, keep it gentle, don\'t pile on' : phase === 'closing' ? ' — they\'re close to done, stay focused on what\'s left' : ''}`
    : ''
  const stateBlock = `STATE:
- What done looks like: ${hasGoal ? `"${projectGoal!.trim()}"` : 'not stated — this may be an ongoing thing with no end, which is fine'}
- Open tasks: ${pendingTasks.length}${listFeelsBloated ? ' (list is long — prefer auditing over adding)' : ''}${sessionLine}`

  const prompt = `You are the project's other pair of hands. You've been following along and know what they're building, what's done, and what's left. Talk like a friend who's in this with them — not an assistant, not a life coach.

${projectContext}

${stateBlock}

${taskBlock}${completedBlock}${powerHourBlock}${echoBlock}

═══════════════════════════════════════════════════════════════════
YOUR JOBS — STRICT PRIORITY ORDER
═══════════════════════════════════════════════════════════════════

JOB 1 — KEEP THE LIST TRUE AND IN ORDER.
The list is what the next session is built from: it takes the top few
open tasks, in order, and works through them. So the list being right IS
the product. Two things matter equally:

ORDER. The order is the plan. If a task can't be started until another
one is finished, it goes below it. When you spot the list out of order,
say so and propose the moves.
  BAD:  1. Let the piece dry and peel the stencil off  2. Cut the stencil
  GOOD: 1. Cut the stencil  2. Pour the paint  3. Let it dry and peel it off

TRUTH. Refine, don't dump. Your job is a SHARPER, SHORTER list.

A TASK EARNS A SPOT IF IT:
1. Starts with an action verb you could start in one sitting.
2. Has a visible "done" state — something exists, is sent, is decided.
3. Clearly advances the finish line (not a tangent, not a nice-to-have).

BEFORE YOU PROPOSE add:
- Scan the pending list. If a similar task exists, propose taskOps.edit on it instead. Never duplicate.
- If what the user just said maps onto an existing task with tweaks, that's an edit, not an add.
- If a task idea doesn't clearly advance the finish line, DROP IT. Don't propose it.

PROACTIVELY PROPOSE edit OR delete WHEN:
- A pending task is vague — sharpen it. ("research the API" → "pick between ESPN and PGA Tour API, write the fetch function").
- A pending task is stale given what the user just told you — delete it. If they've decided X, the task "decide X" goes.
- Two tasks overlap — propose deleting one, or edit the survivor to cover both.
- Pending list is 8+ items — AUDIT MODE: proactively propose 2–3 deletes / edits to tighten it.

AUDIT MODE (when list is long or scattered): call it out in the reply. "You've got 11 pending tasks and three of them say variations of 'design the UI'. Want me to fold those?" Then propose the cleanup as taskOps.

JOB 2 — WHAT DONE LOOKS LIKE, ONLY IF THEY OFFER IT.
Never ask for a finish line. Plenty of real projects are ongoing (DJing,
a sketchbook habit) and have no "done" at all; asking makes them invent
one and then rewrite it forever. But if they say in passing what the
finished thing is — "once the print's framed and up", "when I've sent it
to Graham" — write that down as a goalUpdate for them to confirm. It's a
fact you just heard, not a question you asked.

JOB 3 — CAPTURE WORTH-KEEPING FACTS (runs alongside the others, not after).
If the user hands you a fact, decision, link, or reference that isn't itself a task — something they'd be annoyed to lose — propose it as a noteAppend, same confirm-card treatment as a taskOp. This is a real third action, not an afterthought: don't let a fact worth keeping dissolve into plain reply text just because it doesn't fit JOB 1 or JOB 2. Most turns still have nothing to append — default to null.

═══════════════════════════════════════════════════════════════════
HOW TO TALK
═══════════════════════════════════════════════════════════════════

${CHAT_TURN_RULES}
${PLAIN_ENGLISH_RULES}
- Your one question, if you ask one, should turn on a real decision — practical, grounded in what they just said. Not philosophical.
- If you propose ANY taskOps, a goalUpdate, or a noteAppend, name them plainly in the reply so the user knows what the confirm button will do. "I've queued three tweaks: sharpen 'polish UI' to 'polish homepage hero spacing', delete the duplicate logo task, add 'deploy to Vercel'."
- Reference specific tasks by name. Show you're tracking the project.
- If they drift onto a tangent, pull them back: "Before that — is that a new step, or a change to one that's already there?"
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

═══════════════════════════════════════════════════════════════════
OUTPUT — JSON ONLY
═══════════════════════════════════════════════════════════════════
{
  "reply": "your response",
  "suggestedTasks": [],
  "taskOps": [],
  "goalUpdate": null,
  "noteAppend": null
}

suggestedTasks format (reserve for when the user asks for options to pick from; prefer taskOps.add for anything you genuinely recommend):
  { "text": "task", "task_type": "ignition"|"core"|"shutdown", "estimated_minutes": 15, "reasoning": "why it belongs" }

taskOps format (each is a confirm/dismiss proposal — include reasoning so the user sees your logic):
  - add:        { "action": "add", "newText": "task text", "task_type": "core", "estimated_minutes": 15, "reasoning": "why it belongs and how it advances the finish line" }
  - complete:   { "action": "complete", "taskId": "id", "reasoning": "why you think it's done" }
  - uncomplete: { "action": "uncomplete", "taskId": "id", "reasoning": "why" }
  - delete:     { "action": "delete", "taskId": "id", "reasoning": "why it should go" }
  - edit:       { "action": "edit", "taskId": "id", "newText": "sharper text", "reasoning": "why the new wording is better" }
  - move:       { "action": "move", "taskId": "id", "afterTaskId": "id it goes after, or null for the top", "reasoning": "what it depends on" }

goalUpdate format (ONLY when they just said what the finished thing is, unprompted — never as the answer to a question you asked):
  { "newGoal": "what done looks like, in their words", "reasoning": "why" }

noteAppend format (use ONLY when the user asks you to note/save/jot something, or hands you a fact/decision/link/reference worth keeping on the project — NOT for tasks, NOT for chit-chat):
  { "text": "the note text in plain markdown — headings/bold/lists/links are fine", "reasoning": "why it's worth keeping" }
  - This appends to the project's NOTES content space (the user confirms before it lands).
  - Write the note as the user would: plain and concrete. No analyst voice, no "this reveals", no scare-quote jargon.
  - BAD: "A note capturing the user's evolving narrative substrate around backgrounds."
  - GOOD: "Try non-white backgrounds — warm ochre or grey-green — to push the usual style."
  - Default to null. Most replies don't need a note.

HARD RULES:
- Never ask what done looks like. A project without one is not a problem to fix.
- A taskOps.add is only valid if it passes the earn-a-spot test AND isn't already covered by a pending task. Edit > add.
- Cap taskOps at 5 per reply. Audits bigger than that overwhelm — do it in waves.
- Default arrays to [] and goalUpdate to null when there's nothing to propose. Silence is fine.
- task_type: ignition = breaks inertia, core = main work, shutdown = wraps up.`

  const raw = await generateText(prompt, { temperature: 0.72, responseFormat: 'json' })

  let reply = ''
  let suggestedTasks: SuggestedTask[] = []
  let taskOps: TaskOp[] = []
  let goalUpdate: GoalUpdate | null = null
  let noteAppend: NoteAppend | null = null

  try {
    const parsed = JSON.parse(raw)
    reply = (parsed.reply || '').trim()
    suggestedTasks = Array.isArray(parsed.suggestedTasks) ? parsed.suggestedTasks : []
    taskOps = Array.isArray(parsed.taskOps) ? parsed.taskOps : []
    if (parsed.goalUpdate && typeof parsed.goalUpdate === 'object' && typeof parsed.goalUpdate.newGoal === 'string') {
      goalUpdate = {
        newGoal: parsed.goalUpdate.newGoal.trim(),
        reasoning: typeof parsed.goalUpdate.reasoning === 'string' ? parsed.goalUpdate.reasoning : undefined,
      }
    }
    if (parsed.noteAppend && typeof parsed.noteAppend === 'object' && typeof parsed.noteAppend.text === 'string' && parsed.noteAppend.text.trim()) {
      noteAppend = {
        text: parsed.noteAppend.text.trim(),
        reasoning: typeof parsed.noteAppend.reasoning === 'string' ? parsed.noteAppend.reasoning : undefined,
      }
    }
  } catch {
    // Don't surface raw JSON as if it were a chat reply — that reads as a
    // broken bot, the exact thing this whole feature is trying not to be.
    // Leave taskOps/goalUpdate/noteAppend at their empty defaults above.
    reply = "Lost my train of thought there — try that again?"
  }

  return { reply, suggestedTasks, taskOps, goalUpdate, noteAppend, echoes }
}

// ─── Mode: project-reveal ────────────────────────────────────────────────────
// Generates a personalized "why this project is perfect for you" statement
// using onboarding analysis + project data + knowledge lake context.

async function handleProjectReveal(
  body: {
    projectTitle: string
    projectDescription: string
    projectType: string
    themes: string[]
    capabilities: string[]
    firstInsight: string
  },
  userId: string
): Promise<{ statement: string }> {
  const { projectTitle, projectDescription, projectType, themes, capabilities, firstInsight } = body

  // Search knowledge lake for connections to this project
  const lakeResults = await searchKnowledgeLake(
    `${projectTitle} ${projectDescription}`,
    userId
  )
  const contextBlock = buildContextBlock(lakeResults)

  const prompt = `You are writing a single, personal statement for someone who just created their first project in Polymath — a thinking tool that turns scattered ideas into real work.

This person completed voice onboarding where we learned:
- Themes on their mind: ${themes.join(', ') || 'varied interests'}
- Capabilities detected: ${capabilities.join(', ') || 'creative problem-solving'}
- First insight about them: "${firstInsight || 'They think in connections.'}"

They just created this project:
- Title: "${projectTitle}"
- Type: ${projectType || 'Creative'}
- Description: "${projectDescription}"
${contextBlock ? `\nFrom their knowledge lake (saved thoughts, articles, projects):\n${contextBlock}\n` : ''}

Write a 2-3 sentence statement that explains why THIS person is the right person to build THIS project. Not generic encouragement. Connect specific dots:
- Reference a specific theme or capability and show how it maps to what this project needs
- If their knowledge lake has relevant entries, name one ("You've already been thinking about X")
- Make it feel like a revelation — something they half-knew but hadn't articulated

${PLAIN_ENGLISH_RULES}

Additional rules:
- No filler, no "Great job", no "This is exciting"
- Write like a sharp friend who sees you clearly, not a motivational poster
- Second person ("you"). Do NOT start with "You" — vary the opening.
- The tone is: knowing, warm, precise.

Bad: "Your multifaceted curiosity uniquely positions you to leverage cross-domain synthesis on this project."
Good: "The way you keep coming back to constraints — in the songs, in the photos — is exactly what this project needs. You already wrote about wanting fewer choices."

Return JSON only:
{ "statement": "your 2-3 sentence statement" }`

  const raw = await generateText(prompt, { temperature: 0.8, maxTokens: 200, responseFormat: 'json' })

  try {
    const parsed = JSON.parse(raw)
    return { statement: (parsed.statement || '').trim() }
  } catch {
    // The frontend only renders this beat when statement is truthy
    // (PostOnboardingFlow.tsx) — empty skips it cleanly instead of
    // flashing raw JSON as someone's "why you" reveal.
    return { statement: '' }
  }
}

// ─── Infer catalysts ────────────────────────────────────────────────────────

interface InferCatalystsBody {
  project_id?: string
  title: string
  description?: string
}

async function handleInferCatalysts(body: InferCatalystsBody, userId: string) {
  const { inferCatalysts } = await import('./_lib/metabolism.js')
  const catalysts = await inferCatalysts(body.title || '', body.description || '')

  if (body.project_id && catalysts.length > 0) {
    await supabase
      .from('projects')
      .update({ catalysts })
      .eq('id', body.project_id)
      .eq('user_id', userId)
  }

  return { catalysts }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
    const body = req.body as { step: string } & Record<string, unknown>

    if (!body.step) {
      return res.status(400).json({ error: 'step is required' })
    }

    switch (body.step) {
      case 'shaping':
        return res.json(await handleShaping(body as unknown as Parameters<typeof handleShaping>[0], userId))
      case 'extract':
        return res.json(await handleExtract(body as unknown as Parameters<typeof handleExtract>[0], userId))
      case 'studio-magic':
        return res.json(await handleStudioMagic(body as unknown as Parameters<typeof handleStudioMagic>[0], userId))
      case 'project-chat':
        return res.json(await handleProjectChat(body as unknown as Parameters<typeof handleProjectChat>[0], userId))
      case 'portfolio-chat':
        return res.json(await handlePortfolioChat(body as unknown as Parameters<typeof handlePortfolioChat>[0], userId))
      case 'project-reveal':
        return res.json(await handleProjectReveal(body as unknown as Parameters<typeof handleProjectReveal>[0], userId))
      case 'infer-catalysts':
        return res.json(await handleInferCatalysts(body as unknown as InferCatalystsBody, userId))
      default:
        return res.status(400).json({ error: `Unknown step: ${body.step}` })
    }
  } catch (error) {
    console.error('[Brainstorm] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
