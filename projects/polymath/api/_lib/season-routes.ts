/**
 * Route for the season (season.ts) — a resource on utilities.ts, logic here.
 *
 *   POST ?resource=season { action: 'get' }
 *        -> { season, projects }            what's set, and the projects to pick from
 *   POST ?resource=season { action: 'read', text }
 *        -> { proposal | null }             what they said, matched to real projects. Not saved.
 *   POST ?resource=season { action: 'apply', main_id, also: [{ id, size?, waiting?, from? }], until, label }
 *        -> { season }                      saved: the main one made live, the tags written
 *                                           (also_ids: string[] still works)
 *   POST ?resource=season { action: 'unblock', project_id }
 *        -> { season }                      "got it": the waiting note and start date cleared
 *   POST ?resource=season { action: 'clear' }
 *        -> { season }                      the tags removed; the live project stays live
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import {
  buildSeasonPrompt, parseSeasonProposal, readSeason, readSeasonTag, isoDay, isRealDate, MAX_ALSO,
  type SeasonProject, type SeasonTag, type SmallSize,
} from './season.js'

const MODEL_TIMEOUT_MS = 20_000
const DONE = new Set(['completed', 'archived', 'abandoned', 'graveyard'])

async function loadProjects(supabase: SupabaseClient, userId: string): Promise<SeasonProject[] | null> {
  const { data, error } = await supabase.from('projects')
    .select('id, title, state, status, is_priority, metadata')
    .eq('user_id', userId)
    .order('last_active', { ascending: false }).limit(500)
  if (error) {
    console.error('[season] projects load failed:', error.message)
    return null
  }
  return (data ?? []) as SeasonProject[]
}

/** Write one project's season tag (or remove it). Metadata is read FRESH
 *  for every write, never from an earlier snapshot, so a next move or a
 *  theme saved a moment ago on the same project isn't overwritten. */
async function setTag(
  supabase: SupabaseClient, userId: string, projectId: string, tag: SeasonTag | null,
): Promise<boolean> {
  const { data, error: readErr } = await supabase.from('projects')
    .select('metadata').eq('id', projectId).eq('user_id', userId).single()
  if (readErr || !data) {
    console.error('[season] could not read the project before tagging it:', readErr?.message)
    return false
  }
  const metadata = { ...((data.metadata as Record<string, unknown>) ?? {}) }
  if (tag) metadata.season = tag
  else delete metadata.season
  const { error } = await supabase.from('projects').update({ metadata }).eq('id', projectId).eq('user_id', userId)
  if (error) console.error('[season] could not write the tag:', error.message)
  return !error
}

export async function handleSeason(
  req: VercelRequest, res: VercelResponse, supabase: SupabaseClient, userId: string,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  const { action = 'get' } = req.body || {}
  const projects = await loadProjects(supabase, userId)
  if (!projects) return res.status(500).json({ error: "Couldn't read your projects" })
  const pickable = projects.filter(p => !DONE.has(p.status ?? '') && p.state !== 'harvested')
  const now = new Date()

  if (action === 'get') {
    return res.status(200).json({
      season: readSeason(projects, now),
      projects: pickable.map(p => ({ id: p.id, title: p.title })),
    })
  }

  if (action === 'read') {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
    if (!text) return res.status(400).json({ error: 'text required' })
    const list = pickable.map(p => ({ id: p.id, title: p.title }))
    try {
      const raw = await generateText(buildSeasonPrompt(text, list, isoDay(now)), {
        model: MODELS.SESSION_SHAPE_CHAT, responseFormat: 'json', temperature: 0, maxTokens: 300,
        thinkingLevel: 'low', timeoutMs: MODEL_TIMEOUT_MS,
      })
      return res.status(200).json({ proposal: parseSeasonProposal(raw, list, isoDay(now)) })
    } catch (e) {
      console.error('[season] read failed:', e instanceof Error ? e.message : String(e))
      return res.status(200).json({ proposal: null })
    }
  }

  if (action === 'clear') {
    for (const p of projects) {
      if ((p.metadata as { season?: unknown } | null)?.season && !(await setTag(supabase, userId, p.id, null))) {
        return res.status(500).json({ error: "Couldn't end it" })
      }
    }
    const fresh = await loadProjects(supabase, userId)
    return res.status(200).json({ season: readSeason(fresh ?? projects, now) })
  }

  if (action === 'unblock') {
    const id = typeof req.body?.project_id === 'string' ? req.body.project_id : ''
    const target = projects.find(p => p.id === id)
    const tag = readSeasonTag(target?.metadata)
    if (!target || !tag) return res.status(400).json({ error: 'That is not part of the season' })
    if (!(await setTag(supabase, userId, id, { ...tag, waiting: null, from: null }))) {
      return res.status(500).json({ error: "Couldn't save that" })
    }
    const fresh = await loadProjects(supabase, userId)
    return res.status(200).json({ season: readSeason(fresh ?? projects, now) })
  }

  if (action === 'apply') {
    const { main_id, also_ids, until, label } = req.body || {}
    const mine = new Map(pickable.map(p => [p.id, p]))
    const main = typeof main_id === 'string' ? mine.get(main_id) : undefined
    if (!main) return res.status(400).json({ error: 'main_id must be one of your projects' })
    // Each one is an id, or { id, size, waiting, from }.
    const wanted: { id: string; size?: unknown; waiting?: unknown; from?: unknown }[] = []
    const asked = Array.isArray(req.body?.also) ? req.body.also : (Array.isArray(also_ids) ? also_ids : [])
    for (const e of asked) {
      const o = typeof e === 'string' ? { id: e } : e
      if (!o || typeof o.id !== 'string' || o.id === main.id || !mine.has(o.id) || wanted.some(w => w.id === o.id)) continue
      wanted.push(o)
      if (wanted.length >= MAX_ALSO) break
    }
    let day: string | null = null
    if (typeof until === 'string' && until.trim()) {
      if (!isRealDate(until)) return res.status(400).json({ error: "That isn't a real date" })
      // Same grace as inSeason: the last day is never cut short by a timezone.
      if (until < isoDay(new Date(now.getTime() - 14 * 3_600_000))) {
        return res.status(400).json({ error: 'That date has already passed' })
      }
      day = until
    }
    const name = typeof label === 'string' && label.trim() ? label.trim().slice(0, 30) : null

    // Main means live: the same gesture as declare-live (the home card, the
    // spark channel and the session all already follow the live project).
    await supabase.from('projects').update({ is_priority: false, state: 'on-deck' })
      .eq('user_id', userId).eq('is_priority', true).neq('id', main.id)
    const { error: liveErr } = await supabase.from('projects')
      .update({ state: 'live', is_priority: true, up_next_position: null })
      .eq('id', main.id).eq('user_id', userId)
    if (liveErr) {
      console.error('[season] could not make the main project live:', liveErr.message)
      return res.status(500).json({ error: "Couldn't set that" })
    }

    // New tags first, then remove only the stale ones, checking every
    // write. A failure part-way says so instead of returning a
    // half-written season with a 200.
    const tags = new Map<string, SeasonTag>([[main.id, { role: 'main', until: day, label: name }]])
    for (const w of wanted) {
      const size: SmallSize | null = w.size === 'hours' || w.size === 'weekend' ? w.size : null
      const waiting = typeof w.waiting === 'string' && w.waiting.trim() ? w.waiting.trim().slice(0, 40) : null
      const from = isRealDate(w.from) ? w.from : null
      tags.set(w.id, { role: 'also', until: day, label: name, size, waiting, from })
    }
    for (const [id, tag] of tags) {
      if (!(await setTag(supabase, userId, id, tag))) return res.status(500).json({ error: "Couldn't save that" })
    }
    for (const p of projects) {
      if (!tags.has(p.id) && (p.metadata as { season?: unknown } | null)?.season) {
        if (!(await setTag(supabase, userId, p.id, null))) return res.status(500).json({ error: "Couldn't save that" })
      }
    }

    const after = await loadProjects(supabase, userId)
    return res.status(200).json({ season: readSeason(after ?? projects, now) })
  }

  return res.status(400).json({ error: "action must be 'get', 'read', 'apply' or 'clear'" })
}
