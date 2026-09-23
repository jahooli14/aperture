/**
 * One thing from outside, once a week (`utilities?resource=outside-find`).
 *
 * SPEC.md's "closed loop" risk: sparks only ever recombine what's already
 * been captured, so without something coming in from outside the app
 * recombines you forever. This is the one way in, and it's kept narrow so
 * it can't pollute anything:
 *
 *   - Only the live project, only its next step. Not the whole corpus.
 *   - One find a week, at the bottom of the attention slot's priority list.
 *   - Found with web search, then checked against the real page
 *     (outside-find-check.ts). Anything that doesn't hold up is dropped.
 *   - Stored in `outside_finds`, never as a note. Saving one puts the link
 *     in the reading queue, where it counts for nothing until voted "good".
 *   - "Not useful" finds are shown to the next run so it stops offering
 *     that kind of thing.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { detectBotWallText } from './bot-wall.js'
import { htmlToText, pageMentions, parseFind, type Find } from './outside-find-check.js'

/** Never more often than this, however often the job runs. */
export const FIND_EVERY_DAYS = 6
/** A find stops being offered after this. */
export const FIND_SHELF_DAYS = 7
const MODEL_TIMEOUT_MS = 60_000
const PAGE_TIMEOUT_MS = 8_000
const PAGE_MAX_BYTES = 600_000

const DAY_MS = 24 * 60 * 60 * 1000

interface LiveProject {
  id: string
  title: string
  description: string | null
  last_closeout_text: string | null
  metadata: { end_goal?: string; tasks?: { text: string; done?: boolean; order?: number }[] } | null
}

export function buildFindPrompt(project: LiveProject, past: { title: string; verdict: string | null }[]): string {
  const next = (project.metadata?.tasks ?? [])
    .filter(t => t && !t.done && t.text)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 3)
    .map(t => `- ${t.text}`)
    .join('\n')
  const dismissed = past.filter(p => p.verdict === 'dismissed').map(p => `- ${p.title}`).join('\n')
  const shown = past.filter(p => p.verdict !== 'dismissed').map(p => `- ${p.title}`).join('\n')

  return `Someone is working on a creative project. Find ONE real thing from outside their own head that would help with what they're doing next.

Project: ${project.title}
${project.description ? `What it is: ${project.description}\n` : ''}${project.metadata?.end_goal ? `Where it's going: ${project.metadata.end_goal}\n` : ''}${next ? `Next steps:\n${next}\n` : ''}${project.last_closeout_text ? `Where they stopped last time, in their words: "${project.last_closeout_text}"\n` : ''}
Search the web. Pick exactly one of:
- technique: a specific named method for the next step (not general advice)
- maker: a named person who solved this same problem in their own work
- work: one specific piece of work worth studying for this (a track, a book, a film, a building, a video)

Rules:
- It has to be real, and the link has to be a page about that exact thing.
- Specific beats famous. Not a roundup, not a "top 10", not a course, not an app to install, not productivity advice.
- "why" is one sentence, under 25 words, saying what it does for their next step.
- If nothing you find is clearly useful, say so. Nothing is better than a stretch.

${PLAIN_ENGLISH_RULES}

Bad why: "This approach unlocks a richer creative dialogue with your materials."
Good why: "She glued the veneer before cutting it, which is the step you're stuck on."
${dismissed ? `\nThey said these were not useful. Don't offer anything like them:\n${dismissed}\n` : ''}${shown ? `\nAlready offered, don't repeat:\n${shown}\n` : ''}
Answer with JSON only, no other text:
{"title": "...", "kind": "technique" | "maker" | "work", "why": "...", "url": "https://..."}
or {"none": true}`
}

/** Fetches the page and checks it's really about the find. */
async function checkPage(find: Find): Promise<string | null> {
  try {
    const res = await fetch(find.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Polymath/1.0)', Accept: 'text/html,*/*' },
    })
    if (!res.ok) return `page returned ${res.status}`
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('html')) return `not a web page (${type || 'no type'})`
    const html = (await res.text()).slice(0, PAGE_MAX_BYTES)
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
    const text = htmlToText(html)
    const wall = detectBotWallText(title, text)
    if (wall) return `bot wall: ${wall}`
    if (!pageMentions(find.title, `${title} ${text}`)) return 'page is not about it'
    return null
  } catch (e) {
    return `could not load page: ${e instanceof Error ? e.message : String(e)}`
  }
}

async function askModel(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model: MODELS.SESSION_SHAPE_CHAT,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    },
  })
  return response.text ?? ''
}

/** One weekly run for one user. Returns a trace the cron log prints. */
export async function findOutside(supabase: SupabaseClient, userId: string): Promise<{ created: boolean; trace: string[] }> {
  const trace: string[] = []

  const { data: recent, error: recentErr } = await supabase
    .from('outside_finds')
    .select('title, verdict, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (recentErr) {
    trace.push(`could not read past finds: ${recentErr.message}`)
    return { created: false, trace }
  }
  const last = recent?.[0]
  if (last && Date.now() - Date.parse(last.created_at) < FIND_EVERY_DAYS * DAY_MS) {
    trace.push(`skipped: last find was ${last.created_at}`)
    return { created: false, trace }
  }

  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('id, title, description, last_closeout_text, metadata')
    .eq('user_id', userId)
    .eq('state', 'live')
    .maybeSingle()
  if (projectErr) {
    trace.push(`could not read live project: ${projectErr.message}`)
    return { created: false, trace }
  }
  if (!project) {
    trace.push('skipped: no live project')
    return { created: false, trace }
  }
  trace.push(`live project: ${project.title}`)

  let answer: string
  try {
    answer = await askModel(buildFindPrompt(project as LiveProject, recent ?? []))
  } catch (e) {
    trace.push(`model call failed: ${e instanceof Error ? e.message : String(e)}`)
    return { created: false, trace }
  }

  const { find, reason } = parseFind(answer)
  if (!find) {
    trace.push(`dropped: ${reason}`)
    return { created: false, trace }
  }
  trace.push(`candidate: ${find.kind} — ${find.title} — ${find.url}`)

  const pageProblem = await checkPage(find)
  if (pageProblem) {
    trace.push(`dropped: ${pageProblem}`)
    return { created: false, trace }
  }

  const { error: insertErr } = await supabase
    .from('outside_finds')
    .insert({ ...find, user_id: userId, project_id: project.id })
  if (insertErr) {
    trace.push(`could not save: ${insertErr.message}`)
    return { created: false, trace }
  }
  trace.push('saved')
  return { created: true, trace }
}

/**
 * GET  (user) — this week's find for the live project, if any.
 * POST (user) — { id, verdict: 'saved' | 'dismissed' } resolves it.
 * The weekly generator is cron-only and routed separately.
 */
export async function handleOutsideFind(req: VercelRequest, res: VercelResponse, supabase: SupabaseClient, userId: string) {
  if (req.method === 'GET') {
    const since = new Date(Date.now() - FIND_SHELF_DAYS * DAY_MS).toISOString()
    const { data, error } = await supabase
      .from('outside_finds')
      .select('id, project_id, title, kind, why, url, created_at, projects!inner(title, state)')
      .eq('user_id', userId)
      .is('resolved_at', null)
      .gte('created_at', since)
      .eq('projects.state', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
    // Table missing (migration not run) reads as "nothing this week".
    if (error) return res.status(200).json({ find: null })
    const row = data?.[0] as (Record<string, unknown> & { projects?: { title?: string } }) | undefined
    if (!row) return res.status(200).json({ find: null })
    const { projects, ...find } = row
    return res.status(200).json({ find: { ...find, project_title: projects?.title ?? null } })
  }

  if (req.method === 'POST') {
    const { id, verdict } = (req.body ?? {}) as { id?: unknown; verdict?: unknown }
    if (typeof id !== 'string') return res.status(400).json({ error: 'id required' })
    if (verdict !== 'saved' && verdict !== 'dismissed') return res.status(400).json({ error: 'verdict must be saved or dismissed' })
    const { error } = await supabase
      .from('outside_finds')
      .update({ verdict, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'GET or POST' })
}
