/**
 * Brainstorm API
 *
 * Conversational project ideation with knowledge-lake awareness.
 * Three modes:
 *   chat         — conversational exchange, surfaces connections from knowledge lake
 *   extract      — distill the conversation into a structured project definition
 *   studio-magic — AI writing partner for the Studio tab
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

  const [memoriesRes, articlesRes, projectsRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(80),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(50),
    supabase
      .from('projects')
      .select('id, title, description, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(50),
  ])

  const memories: EchoItem[] = (memoriesRes.data || [])
    .map(m => ({
      title: m.title || (m.body || '').slice(0, 60),
      snippet: (m.body || '').slice(0, 120),
      score: cosineSimilarity(embedding, m.embedding as number[]),
      type: 'memory' as const,
    }))
    .filter(m => m.score > 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ title, snippet, type }) => ({ title, snippet, type }))

  const articles: EchoItem[] = (articlesRes.data || [])
    .map(a => ({
      title: a.title || 'Untitled',
      snippet: (a.excerpt || '').slice(0, 120),
      score: cosineSimilarity(embedding, a.embedding as number[]),
      type: 'article' as const,
    }))
    .filter(a => a.score > 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ title, snippet, type }) => ({ title, snippet, type }))

  const projects: EchoItem[] = (projectsRes.data || [])
    .filter(p => !excludeProjectId || p.id !== excludeProjectId)
    .map(p => ({
      title: p.title || 'Untitled',
      snippet: (p.description || '').slice(0, 120),
      score: cosineSimilarity(embedding, p.embedding as number[]),
      type: 'project' as const,
    }))
    .filter(p => p.score > 0.52)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
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
      echoes: lakeResults.all.slice(0, 4),
      readyToExtract: parsed.readyToExtract === true,
    }
  } catch {
    // Fallback: treat raw as plain reply, no ready signal
    return {
      reply: raw.trim(),
      echoes: lakeResults.all.slice(0, 4),
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
  "end_goal": "what done looks like (be specific, not generic)",
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = await getUserId(req)
    const body = req.body as { step: string } & Record<string, unknown>

    if (!body.step) {
      return res.status(400).json({ error: 'step is required' })
    }

    switch (body.step) {
      case 'chat':
        return res.json(await handleChat(body as unknown as Parameters<typeof handleChat>[0], userId))
      case 'extract':
        return res.json(await handleExtract(body as unknown as Parameters<typeof handleExtract>[0], userId))
      case 'studio-magic':
        return res.json(await handleStudioMagic(body as unknown as Parameters<typeof handleStudioMagic>[0], userId))
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
