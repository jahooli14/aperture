/**
 * Route for the season (season.ts) — a resource on utilities.ts, logic here.
 *
 *   POST ?resource=season { action: 'get' }
 *        -> { season, projects }            what's set, and the projects to pick from
 *   POST ?resource=season { action: 'read', text }
 *        -> { proposal | null }             what they said, matched to real projects. Not saved.
 *   POST ?resource=season { action: 'apply', main_id, also_ids, until, label }
 *        -> { season }                      saved: the main one made live, the tags written
 *   POST ?resource=season { action: 'clear' }
 *        -> { season }                      the tags removed; the live project stays live
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import {
  buildSeasonPrompt, parseSeasonProposal, readSeason, isoDay, MAX_ALSO,
  type SeasonProject, type SeasonTag,
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

/** Write one project's season tag (or remove it), reading its metadata
 *  fresh so nothing else on it is wiped. */
async function setTag(
  supabase: SupabaseClient, userId: string, project: SeasonProject, tag: SeasonTag | null,
): Promise<boolean> {
  const metadata = { ...((project.metadata as Record<string, unknown>) ?? {}) }
  if (tag) metadata.season = tag
  else delete metadata.season
  const { error } = await supabase.from('projects').update({ metadata }).eq('id', project.id).eq('user_id', userId)
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
      if ((p.metadata as { season?: unknown } | null)?.season) await setTag(supabase, userId, p, null)
    }
    const fresh = await loadProjects(supabase, userId)
    return res.status(200).json({ season: readSeason(fresh ?? projects, now) })
  }

  if (action === 'apply') {
    const { main_id, also_ids, until, label } = req.body || {}
    const mine = new Map(pickable.map(p => [p.id, p]))
    const main = typeof main_id === 'string' ? mine.get(main_id) : undefined
    if (!main) return res.status(400).json({ error: 'main_id must be one of your projects' })
    const alsoList = (Array.isArray(also_ids) ? also_ids : [])
      .filter((id: unknown): id is string => typeof id === 'string' && id !== main.id && mine.has(id))
      .filter((id: string, i: number, all: string[]) => all.indexOf(id) === i)
      .slice(0, MAX_ALSO)
      .map((id: string) => mine.get(id)!)
    const day = typeof until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= isoDay(now) ? until : null
    const name = typeof label === 'string' && label.trim() ? label.trim().slice(0, 30) : null

    // A new season replaces the old one, so every old tag goes first.
    for (const p of projects) {
      if ((p.metadata as { season?: unknown } | null)?.season) await setTag(supabase, userId, p, null)
    }

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

    const fresh = (await loadProjects(supabase, userId)) ?? projects
    const byId = new Map(fresh.map(p => [p.id, p]))
    await setTag(supabase, userId, byId.get(main.id) ?? main, { role: 'main', until: day, label: name })
    for (const a of alsoList) await setTag(supabase, userId, byId.get(a.id) ?? a, { role: 'also', until: day, label: name })

    const after = await loadProjects(supabase, userId)
    return res.status(200).json({ season: readSeason(after ?? fresh, now) })
  }

  return res.status(400).json({ error: "action must be 'get', 'read', 'apply' or 'clear'" })
}
