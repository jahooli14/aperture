/**
 * Self-Model API (experimental)
 *
 * POST /api/self-model
 *   body: { mode: 'generate' } → derives a thesis + threads + move from the
 *     user's projects, memories, reading list, and active list items.
 *   body: { mode: 'argue', previous: SelfModel, critique: string } →
 *     re-derives with the critique weighted into the prompt.
 *
 * Returns:
 *   {
 *     sources: { projects, memories, articles, list_items },  // counts
 *     model: {
 *       thesis: string,
 *       threads: Array<{ title: string, evidence: string[] }>,
 *       move: { action: string, why: string, artefact: string },
 *       signature: string   // the "only you" line
 *     },
 *     took_ms: number
 *   }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from './_lib/auth.js'
import { generateText } from './_lib/gemini-chat.js'
import { MODELS } from './_lib/models.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface SelfModel {
  thesis: string
  threads: Array<{ title: string; evidence: string[] }>
  move: { action: string; why: string; artefact: string }
  signature: string
}

interface SelfModelSources {
  projects: number
  memories: number
  articles: number
  list_items: number
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

async function gatherSourceData(userId: string) {
  const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString()

  const [projRes, memRes, artRes, listRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, description, status, is_priority, updated_at')
      .eq('user_id', userId)
      .in('status', ['active', 'upcoming'])
      .order('updated_at', { ascending: false })
      .limit(25),
    supabase
      .from('memories')
      .select('title, body, themes, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('reading_queue')
      .select('title, summary, status')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('list_items')
      .select('content, status, metadata')
      .eq('user_id', userId)
      .in('status', ['active', 'queued'])
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  return {
    projects: projRes.data ?? [],
    memories: memRes.data ?? [],
    articles: artRes.data ?? [],
    list_items: listRes.data ?? [],
  }
}

function buildPrompt(
  data: Awaited<ReturnType<typeof gatherSourceData>>,
  critique?: { previous: SelfModel; critique: string }
): string {
  const projectLines = data.projects
    .slice(0, 20)
    .map(p => `- ${p.title}${p.description ? ` — ${String(p.description).slice(0, 160)}` : ''}`)
    .join('\n')

  const memoryLines = data.memories
    .slice(0, 30)
    .map(m => {
      const title = m.title ? `${m.title}: ` : ''
      const body = String(m.body ?? '').slice(0, 200)
      return `- ${title}${body}`
    })
    .join('\n')

  const articleLines = data.articles
    .slice(0, 15)
    .map(a => `- ${a.title}${a.summary ? ` — ${String(a.summary).slice(0, 120)}` : ''}`)
    .join('\n')

  const listLines = data.list_items
    .slice(0, 20)
    .map(i => `- ${String(i.content).slice(0, 120)}`)
    .join('\n')

  const critiqueBlock = critique
    ? `\n\nLAST TIME YOU SAID:
Thesis: "${critique.previous.thesis}"
Signature: "${critique.previous.signature}"
Move: "${critique.previous.move.action}"

THE USER PUSHED BACK:
"${critique.critique}"

Re-model from scratch in light of that critique. Don't be defensive — update the thesis, threads, and move to reflect what they just told you. Show you actually heard them. If the critique is narrow ("wrong move, rest is fine") keep the thesis; if broad ("this whole read is off") rewrite everything.`
    : ''

  return `You are modelling the creative signature of a specific person, from their own data. Produce a JSON object describing what they are actually trying to do with their life this quarter, three latent threads pulling at their attention, and the single move that advances the most threads at once.

RULES:
- Cite specific titles from their data (named projects, memories, books, list items). Never generic categories.
- The thesis must sting a little. Avoid LinkedIn-bio voice. Prefer one crisp claim that names a tension (e.g. "You're building X but keep stalling at the Y part").
- Threads are latent questions, not project names. Things they're circling without noticing.
- The move is one concrete 30–90 minute action, doable today, with an artefact at the end (a voice note, a one-page doc, a prototype, a commit, an email sent).
- The signature is the "only you" line — why this specific stack, this specific person, makes this move uniquely theirs. Name 2–3 sources.
- Output ONLY valid JSON with keys: thesis (string), threads (array of {title, evidence[]}, 3 items, evidence = array of 2–3 source titles), move ({action, why, artefact}), signature (string).

THEIR ACTIVE PROJECTS (${data.projects.length}):
${projectLines || '(none)'}

THEIR RECENT MEMORIES, VOICE NOTES, THOUGHTS (${data.memories.length}, last 90 days):
${memoryLines || '(none)'}

THEIR READING (${data.articles.length}):
${articleLines || '(none)'}

THEIR ACTIVE LIST ITEMS (${data.list_items.length}):
${listLines || '(none)'}${critiqueBlock}

Return the JSON object now.`
}

function safeParse(raw: string): SelfModel | null {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const obj = JSON.parse(trimmed)
    if (
      obj &&
      typeof obj.thesis === 'string' &&
      Array.isArray(obj.threads) &&
      obj.move && typeof obj.move.action === 'string' &&
      typeof obj.signature === 'string'
    ) {
      return {
        thesis: obj.thesis,
        threads: obj.threads.slice(0, 3).map((t: { title?: unknown; evidence?: unknown }) => ({
          title: String(t.title ?? ''),
          evidence: Array.isArray(t.evidence) ? t.evidence.slice(0, 4).map((s: unknown) => String(s)) : [],
        })),
        move: {
          action: String(obj.move.action ?? ''),
          why: String(obj.move.why ?? ''),
          artefact: String(obj.move.artefact ?? ''),
        },
        signature: obj.signature,
      }
    }
  } catch {
    // fallthrough
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to view your self-model' })

    const body = (req.body ?? {}) as { mode?: 'generate' | 'argue'; previous?: SelfModel; critique?: string }
    const mode = body.mode ?? 'generate'

    const started = Date.now()
    const data = await gatherSourceData(userId)

    const sources: SelfModelSources = {
      projects: data.projects.length,
      memories: data.memories.length,
      articles: data.articles.length,
      list_items: data.list_items.length,
    }

    // Not enough signal to model anything meaningful.
    const totalSignal = sources.projects + sources.memories + sources.articles + sources.list_items
    if (totalSignal < 3) {
      return res.status(200).json({
        sources,
        model: null,
        reason: 'not-enough-signal',
        took_ms: Date.now() - started,
      })
    }

    const critique =
      mode === 'argue' && body.previous && body.critique
        ? { previous: body.previous, critique: body.critique }
        : undefined

    const prompt = buildPrompt(data, critique)

    const raw = await generateText(prompt, {
      maxTokens: 1400,
      temperature: 0.85,
      responseFormat: 'json',
      model: MODELS.FLASH_CHAT,
    })

    const model = safeParse(raw)
    if (!model) {
      console.warn('[self-model] failed to parse model output', raw.slice(0, 300))
      return res.status(502).json({ error: 'Model returned unparseable output' })
    }

    return res.status(200).json({
      sources,
      model,
      took_ms: Date.now() - started,
    })
  } catch (err) {
    console.error('[self-model] error', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
