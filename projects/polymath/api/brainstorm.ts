/**
 * Brainstorm API
 *
 * Conversational project ideation with knowledge-lake awareness.
 * Four modes:
 *   chat         — conversational exchange, surfaces connections from knowledge lake
 *   extract      — distill the conversation into a structured project definition
 *   studio-magic — AI writing partner for the Studio tab
 *   project-chat — contextual AI chat for an active project (replaces /api/project-chat)
 *
 * POST /api/brainstorm
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

// ─── Mode: chat ──────────────────────────────────────────────────────────────

async function handleChat(
  body: { message: string; history?: ConversationMessage[] },
  userId: string
): Promise<{ reply: string; echoes: EchoItem[]; readyToExtract: boolean }> {
  const { message, history = [] } = body

  const lakeResults = await searchKnowledgeLake(message, userId)
  const contextBlock = buildContextBlock(lakeResults)

  const priorTurns = history
    .map(m => `${m.role === 'user' ? 'USER' : 'THINKING PARTNER'}: ${m.content}`)
    .join('\n')

  const prompt = `You are a thinking partner. Someone is figuring out what they want to build. You have their knowledge lake — notes, saved articles, existing projects.

Respond to what they just said. One response: an observation, a connection, something that moves the thinking forward. Not a list. Not encouragement.

Rules for your reply:
- Short. 2-4 sentences.
- No filler: never start with "Great", "Interesting", "That sounds exciting", "I see", or any variant.
- Plain language. Short sentences. Say the thing directly.
- If you spot something in their knowledge lake that connects, name it: "You wrote about X" or "You have a project called Y".
- If there's an existing project in the same territory, ask whether this is the same thing or something new.
- If nothing connects, say nothing about the lake.
- At most one question. Often none is better.
- Write like a person, not software.
- When they mention something specific — a name, a domain, a particular problem — reflect it back with precision, not generality. "You mentioned X" beats "that area of work". Show you heard the specific thing.
${contextBlock ? `\n${contextBlock}\n` : ''}
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

Now assess whether this conversation has enough to turn into a project definition. Check all four:
1. Core idea — is what they're building clearly named?
2. Motivation — do you know why this matters to them?
3. Shape — is it a one-time finish or an ongoing practice?
4. Starting point — is there any sense of where it begins?

Even if all four are covered, set readyToExtract to false if the person is mid-tangent, building energy, or if the last message opened something new. Only mark ready when the conversation feels like it has reached a natural resting point and more talking wouldn't change the shape of the project.

Return JSON only:
{
  "reply": "your response as thinking partner",
  "readyToExtract": false
}`

  const raw = await generateText(prompt, { temperature: 0.75, maxTokens: 300, responseFormat: 'json' })

  try {
    const parsed = JSON.parse(raw)
    return {
      reply: (parsed.reply || '').trim(),
      echoes: lakeResults.all.slice(0, 6),
      readyToExtract: parsed.readyToExtract === true,
    }
  } catch {
    // Fallback: treat raw as plain reply, no ready signal
    return {
      reply: raw.trim(),
      echoes: lakeResults.all.slice(0, 6),
      readyToExtract: false,
    }
  }
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

  const prompt = `You are shaping a creative project with someone. Your job is to help them turn a vague impulse into something they can actually build. You're an interviewer, a producer, a creative director — not a cheerleader.

Your goal: get to the core of what this project really is. Ask the questions they haven't thought to ask themselves.

INTERROGATION PRIORITIES (work through these, one per exchange, in natural order):
1. WHY — What's the real motivation? Not "it'd be cool" but what's driving this? A gift? A skill they want? A feeling?
2. WHAT — What does the finished thing actually look like? Be concrete. A 3-minute song? A deployed app? A framed print?
3. WHO — Is this for them or for someone else? Who sees/hears/uses the output?
4. HOW — What tools, skills, materials do they have? What's missing?
5. CONSTRAINTS — How much time can they actually give this? What's blocking them?
6. FIRST MOVE — What's the smallest thing they could do in 30 minutes to start?

Rules:
- ONE question per response. Never more. Make it count.
- 2-3 sentences max. The question is the point; everything else is setup.
- No filler: never start with "Great", "Interesting", "That sounds exciting", "Love it", or any variant.
- If you spot something in their knowledge lake that connects, name it specifically.
- If a previous answer was vague, push harder. "What do you mean by that?" is a valid response.
- Write like a sharp producer in a recording studio, not a therapist.
- Reflect back specifics: names, tools, references they've mentioned.
${projectContext}
${contextBlock ? `\n${contextBlock}\n` : ''}
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

Assess whether you now have enough to define a project. You need at minimum:
1. What they're making (concrete output, not abstract)
2. Why it matters to them
3. What "done" looks like
4. A concrete first step

Set readyToExtract to true ONLY when all four are genuinely clear from the conversation — not assumed, not generic. If the user is still vague on any of these, keep probing.

Return JSON only:
{
  "reply": "your response",
  "readyToExtract": false
}`

  const raw = await generateText(prompt, { temperature: 0.72, maxTokens: 250, responseFormat: 'json' })

  try {
    const parsed = JSON.parse(raw)
    return {
      reply: (parsed.reply || '').trim(),
      echoes: lakeResults.all.slice(0, 6),
      readyToExtract: parsed.readyToExtract === true,
    }
  } catch {
    return {
      reply: raw.trim(),
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

Extract a structured project definition from this conversation. Be specific — don't invent details that weren't discussed.

Also write a "genesis draft": the conversation retold as a first-person journal entry (3-5 sentences, conversational). This becomes the project's initial Studio note.

Return JSON only:
{
  "title": "concise active-voice title, 6 words max",
  "description": "1-2 sentences: what this is and why it matters to the person",
  "type": "exactly one of: Writing, Tech, Art, Music, Business, Creative",
  "project_mode": "completion or recurring",
  "end_goal": "a plain sentence describing when this is finished — e.g. 'A working iOS app in the App Store' or 'The manuscript is edited and sent to beta readers'. Concrete, not abstract.",
  "first_step": "the smallest concrete action to begin — a verb phrase",
  "genesisDraft": "the conversation as a first-person journal entry"
}`

  const raw = await generateText(prompt, { temperature: 0.35, maxTokens: 500, responseFormat: 'json' })

  try {
    return JSON.parse(raw)
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

1. Write a "ghost" — a short paragraph (3-5 sentences) that continues from where their draft ends, written in their voice. Not a summary of what they wrote. Take one step further. Something they might steal, react to, or discard. Write it as if you are them, continuing their thought.

2. Write 3 "provocations" — specific, pointed observations or questions targeted at this exact draft. Not generic writing advice. Think: a brilliant editor's marginalia. Name assumptions they're making, gaps in the argument, the thing they're circling without quite saying. Be uncomfortable.

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
  task_type?: 'ignition' | 'core' | 'shutdown'
}

interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit' | 'add'
  taskId?: string
  newText?: string
  task_type?: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

interface GoalUpdate {
  newGoal: string
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
    tasks?: ProjectTask[]
    powerHourSuggestions?: PowerHourSuggestion[]
    message: string
    history?: ConversationMessage[]
  },
  userId: string
): Promise<{ reply: string; suggestedTasks: SuggestedTask[]; taskOps: TaskOp[]; goalUpdate: GoalUpdate | null; echoes: EchoItem[] }> {
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
  } = body

  if (!message || !projectTitle) {
    throw Object.assign(new Error('message and projectTitle are required'), { status: 400 })
  }

  const echoes = await searchKnowledgeLakeSimple(message, userId, projectId)

  const pendingTasks = tasks.filter(t => !t.done)
  const recentlyCompleted = tasks.filter(t => t.done).slice(-5)

  const taskBlock = pendingTasks.length > 0
    ? `PENDING TASKS (${pendingTasks.length}):\n${pendingTasks.map((t, i) => `${i + 1}. [id:${t.id}] ${t.text}${t.is_ai_suggested ? ' [AI suggested]' : ''}`).join('\n')}`
    : 'PENDING TASKS: none'

  const completedBlock = recentlyCompleted.length > 0
    ? `\nRECENTLY COMPLETED:\n${recentlyCompleted.map(t => `✓ [id:${t.id}] ${t.text}`).join('\n')}`
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

  const priorTurns = history
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n')

  const hasGoal = !!(projectGoal && projectGoal.trim())
  const stateBlock = `STATE:
- Finish line set: ${hasGoal ? 'YES' : 'NO'}
- Open tasks: ${pendingTasks.length}`

  const prompt = `You're helping someone finish their project. You know what they're building, what's done, and what's left. Talk to them like a friend who's been following along — not like an AI assistant or a life coach.

${projectContext}

${stateBlock}

${taskBlock}${completedBlock}${powerHourBlock}${echoBlock}

YOUR TWO JOBS, IN ORDER:
1. MAKE SURE THERE'S A FINISH LINE. If the finish line is not set, getting a concrete, verifiable definition of "done" is your ONLY goal. Do not propose tasks yet. Ask targeted questions until they give you enough to write one, then propose it via goalUpdate.
2. ONCE THE FINISH LINE EXISTS: keep the task list tight, relevant, and pointed at it. Proactively propose add / edit / delete as the conversation reveals new info. Refine — don't dump.

BE PROACTIVE, NOT PASSIVE:
- When the user says something that implies a concrete next step (a dependency, a blocker, a decision, a thing they've committed to doing), propose a taskOps.add. Don't wait for them to ask.
- If an existing task is vague, wrong, or out of date, propose taskOps.edit with clearer text.
- If a task no longer fits given what they just said, propose taskOps.delete.
- Never add a task just to bulk out the list. If the list already covers it, leave it alone. Quality beats quantity every time.
- Aim for ~3–7 live tasks. If the list is already long, prefer edit/delete over add.

CONVERSATION STEERING:
- Every question you ask should extract info that either (a) nails down the finish line, or (b) sharpens a specific next step. Never philosophical, never reflective — practical.
- If no finish line yet: keep pulling on that thread. "What would have to be true for you to call this done?" "Is this shipped to users, or finished for you?" One question per reply.
- If they drift onto a tangent, bring them back: "Before that — have we agreed on what done looks like?" or "Where does that land on the task list?"
- Ask ONE question per reply.

HOW TO REPLY:
- 2–3 sentences max. Plain English.
- Never open with "Great", "Interesting", "Absolutely", or any sycophantic filler.
- When you propose a taskOps item or a goalUpdate, briefly describe it in the reply so the user knows what the confirm button will do.
- Reference specific tasks and the finish line by name. Show you know the project.
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

Return JSON only:
{
  "reply": "your response",
  "suggestedTasks": [],
  "taskOps": [],
  "goalUpdate": null
}

suggestedTasks format (reserve for optional idea menus — prefer taskOps.add for anything you actually think belongs on the list): { "text": "task", "task_type": "ignition"|"core"|"shutdown", "estimated_minutes": 15, "reasoning": "why" }
taskOps format — propose proactively when the conversation reveals the need; each is a confirm/dismiss proposal:
  - add:        { "action": "add", "newText": "task text", "task_type": "core", "estimated_minutes": 15, "reasoning": "why it belongs and where it sits relative to the finish line" }
  - complete:   { "action": "complete", "taskId": "id" }
  - uncomplete: { "action": "uncomplete", "taskId": "id" }
  - delete:     { "action": "delete", "taskId": "id" }
  - edit:       { "action": "edit", "taskId": "id", "newText": "new text" }
goalUpdate format (propose as soon as the user has given you enough to write a concrete finish line, or when they give info that sharpens the existing one): { "newGoal": "the new finish line text", "reasoning": "why" }
Default arrays to [] and goalUpdate to null. If the finish line is NOT set, taskOps MUST be []  — your job is the goal first. task_type: ignition = breaks inertia, core = main work, shutdown = wraps up.`

  const raw = await generateText(prompt, { temperature: 0.72, responseFormat: 'json' })

  let reply = ''
  let suggestedTasks: SuggestedTask[] = []
  let taskOps: TaskOp[] = []
  let goalUpdate: GoalUpdate | null = null

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
  } catch {
    reply = raw.trim()
  }

  return { reply, suggestedTasks, taskOps, goalUpdate, echoes }
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

Rules:
- No filler, no "Great job", no "This is exciting"
- Write like a sharp friend who sees you clearly, not a motivational poster
- Second person ("you")
- Short punchy sentences. One thought per sentence.
- Do NOT start with "You" — vary the opening
- The tone is: knowing, warm, precise

Return JSON only:
{ "statement": "your 2-3 sentence statement" }`

  const raw = await generateText(prompt, { temperature: 0.8, maxTokens: 200, responseFormat: 'json' })

  try {
    const parsed = JSON.parse(raw)
    return { statement: (parsed.statement || '').trim() }
  } catch {
    return { statement: raw.trim() }
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
      case 'chat':
        return res.json(await handleChat(body as unknown as Parameters<typeof handleChat>[0], userId))
      case 'shaping':
        return res.json(await handleShaping(body as unknown as Parameters<typeof handleShaping>[0], userId))
      case 'extract':
        return res.json(await handleExtract(body as unknown as Parameters<typeof handleExtract>[0], userId))
      case 'studio-magic':
        return res.json(await handleStudioMagic(body as unknown as Parameters<typeof handleStudioMagic>[0], userId))
      case 'project-chat':
        return res.json(await handleProjectChat(body as unknown as Parameters<typeof handleProjectChat>[0], userId))
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
