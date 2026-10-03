/**
 * Brainstorm API
 *
 * Conversational project ideation with knowledge-lake awareness.
 * Steps:
 *   shaping        — turn what someone said about a new project into a plan
 *   project-reveal — why this project suits them (post-onboarding)
 *
 * (project-chat, extract, studio-magic and infer-catalysts are gone: the
 * Guide chat they served is folded into the project's next move.)
 *
 * POST /api/brainstorm
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from './_lib/auth.js'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { generateText } from './_lib/gemini-chat.js'
import { PLAIN_ENGLISH_RULES, CHAT_TURN_RULES } from './_lib/plain-english.js'
import { stripCitationTagsDeep } from './_lib/citation-tags.js'
import { seededShapingReply } from './_lib/shaping-seeds.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
  /** Versions of the idea this turn offered, so a later turn doesn't repeat them. */
  offers?: string[]
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

/** Close to the best match, not merely above a floor. Every note scores
 *  0.55-0.66 against anything in this vector space, so a floor admits the
 *  lot and the top six are near-random; the gap to the winner is what
 *  discriminates (see fragments.ts). */
const TIGHT_BAND = 0.06
const TIGHT_MAX = 3
function tighten<T extends { score: number }>(sorted: T[]): T[] {
  if (sorted.length === 0) return sorted
  const best = sorted[0].score
  return sorted.filter(i => i.score >= best - TIGHT_BAND).slice(0, TIGHT_MAX)
}

async function searchKnowledgeLake(text: string, userId: string, excludeProjectId?: string, tight = false): Promise<LakeResults> {
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

  // Ranked best-first, then cut: to the best few within a band of the winner
  // when `tight`, else to the old fixed counts.
  const pick = <T extends { score: number }>(ranked: T[], max: number): T[] =>
    tight ? tighten(ranked) : ranked.slice(0, max)
  const strip = ({ title, snippet, type }: EchoItem & { score: number }): EchoItem => ({ title, snippet, type })

  const memories: EchoItem[] = pick((memoriesRes.data || [])
    .map(m => ({
      title: m.title || (m.body || '').slice(0, 60),
      snippet: (m.body || '').slice(0, 120),
      score: cosineSimilarity(embedding, m.embedding as number[]),
      type: 'memory' as const,
    }))
    .filter(m => m.score > 0.38)
    .sort((a, b) => b.score - a.score), 6).map(strip)

  const articles: EchoItem[] = pick((articlesRes.data || [])
    .map(a => ({
      title: a.title || 'Untitled',
      snippet: (a.excerpt || '').slice(0, 120),
      score: cosineSimilarity(embedding, a.embedding as number[]),
      type: 'article' as const,
    }))
    .filter(a => a.score > 0.38)
    .sort((a, b) => b.score - a.score), 3).map(strip)

  const projects: EchoItem[] = pick((projectsRes.data || [])
    .filter(p => !excludeProjectId || p.id !== excludeProjectId)
    .map(p => ({
      title: p.title || 'Untitled',
      snippet: (p.description || '').slice(0, 120),
      score: cosineSimilarity(embedding, p.embedding as number[]),
      type: 'project' as const,
    }))
    .filter(p => p.score > 0.45)
    .sort((a, b) => b.score - a.score), 4).map(strip)

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
): Promise<{ reply: string; echoes: EchoItem[]; offers: string[]; readyToExtract: boolean }> {
  const { message, history = [], projectTitle, projectDescription } = body
  const userTurns = history.filter(m => m.role === 'user').length + 1

  // First choice: built from things only they have, each cited and checked
  // (shaping-seeds.ts). Anything wrong with it and the plain chat below
  // answers instead -- a garnish never costs the turn.
  if (userTurns <= 2) {
    const trace: string[] = []
    const seeded = await seededShapingReply(supabase, userId, {
      message, history, userTurnNumber: userTurns,
      context: projectTitle ? `They are shaping this idea: "${projectTitle}"${projectDescription ? ` -- ${projectDescription}` : ''}` : '',
    }, trace)
    if (trace.length) console.log('[Brainstorm/shaping]', trace.join(' | '))
    if (seeded) return { reply: seeded.reply, echoes: [], offers: seeded.offers, readyToExtract: seeded.readyToExtract }
  }

  // Everything they've said so far, not just the last line: one short
  // message is a poor query for what the whole idea is about.
  const lakeQuery = [...history.filter(m => m.role === 'user').map(m => m.content), message].join('\n')
  const lakeResults = await searchKnowledgeLake(lakeQuery, userId, undefined, true)
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
- YOUR JOB IS TO HELP THEM FIND THE IDEA, not to show you remember things.
  When what they're making is still loose ("a wooden toy"), give them 2-3
  concrete versions to react to, each a few words ("a stacking set of
  rings", "a push-along duck", "a rattle ring they can chew"). Pick versions
  that fit what they said, and that someone could actually make in a
  weekend. They react; that narrows it faster than any question.
- If it's already concrete and only 2 is missing, ask ONE plain question
  that gets it. Tie it to what they just said.
- If nothing's missing, say back in one sentence what you've got, so they
  can correct it, and stop.
- Never ask why it matters, who it's for, what tools they have, or how
  much time they've got. None of that changes the first step.
${CHAT_TURN_RULES}
- Their notes below are for you. Use one only when it changes what you'd
  suggest, and fold it into the suggestion. Never reply with a bare "you
  did X before" or "that course gave you a good start": that proves you
  remember and helps with nothing. Most turns, use none.
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

  const raw = await generateText(prompt, { temperature: 0.7, maxTokens: 300, responseFormat: 'json' })

  try {
    const parsed = stripCitationTagsDeep(JSON.parse(raw))
    return {
      reply: (parsed.reply || '').trim(),
      // No chips: the nearest-neighbour hits were mostly off-topic
      // ("Oscar's Developing Brain as He Sleeps" under a wooden toy) and
      // only ever looked like proof of recall.
      echoes: [],
      offers: [],
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
      echoes: [],
      offers: [],
      readyToExtract: false,
    }
  }
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
    const parsed = stripCitationTagsDeep(JSON.parse(raw))
    return { statement: (parsed.statement || '').trim() }
  } catch {
    // The frontend only renders this beat when statement is truthy
    // (PostOnboardingFlow.tsx) — empty skips it cleanly instead of
    // flashing raw JSON as someone's "why you" reveal.
    return { statement: '' }
  }
}

// ─── Infer catalysts ────────────────────────────────────────────────────────

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
      case 'project-reveal':
        return res.json(await handleProjectReveal(body as unknown as Parameters<typeof handleProjectReveal>[0], userId))
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
