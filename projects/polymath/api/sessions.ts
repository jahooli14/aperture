/**
 * Sessions — the execution contract (SPEC.md).
 *
 * Deliberately its own file rather than another resource in projects.ts:
 * this is the foundation of the rebuild, not a project sub-feature, and
 * projects.ts is already carrying the whole old home surface.
 *
 * Resources:
 *   POST ?resource=start           — open a session, derive its shapes
 *   POST ?resource=close           — close-out capture, classify `moved`,
 *                                     update the project, maybe recompute MVS
 *   GET  ?resource=pending-closeout — a deferred close-out to ask about, if any
 *   POST ?resource=log-retro       — retroactive voice logging ("did 2 hours
 *                                     on the decks last night")
 *   POST ?resource=declare-live    — set a project as the live project
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { generateText } from './_lib/gemini-chat.js'
import { deriveSessionShapes, needsMvsSeed, measuredMvs, type SlotInput } from './_lib/session-shapes.js'
import { PLAIN_ENGLISH_RULES } from './_lib/plain-english.js'

/** A deferred close-out older than this is left alone rather than asked about (SPEC.md). */
const DEFER_MAX_AGE_DAYS = 7

/**
 * A yes/no next to a timer would be the question-beside-two-buttons pattern
 * SPEC.md bans, so "did this move" comes from the close-out text itself via
 * a cheap capped-thinking call, not a button.
 */
async function classifyMoved(closeoutText: string): Promise<boolean> {
  const prompt = `Someone just finished a work session and said what happened.

"${closeoutText}"

Did they describe something changing -- progress, a decision, a thing made or fixed --
or did they describe not getting anywhere (stuck, distracted, nothing landed)?

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "moved": true | false }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'minimal' })
    const parsed = JSON.parse(response)
    return Boolean(parsed?.moved)
  } catch (e) {
    console.warn('[sessions] classifyMoved failed, defaulting to true:', e instanceof Error ? e.message : e)
    // A session that produced closeout text at all is more likely to have
    // moved than not -- default optimistic rather than silently discarding
    // it from the MVS measurement on a transient Gemini failure.
    return true
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = getSupabaseClient()
  const resource = req.query.resource as string

  // ─── START ──────────────────────────────────────────────────────────
  if (resource === 'start') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id, window_minutes, source } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, title, last_closeout_text, mvs_minutes, slots')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single()

    if (projectErr || !project) return res.status(404).json({ error: 'project not found' })

    const { count: priorSessionCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id)
      .eq('user_id', userId)
      .not('ended_at', 'is', null)

    const slots: SlotInput[] = Array.isArray(project.slots)
      ? project.slots.map((s: any) => ({ name: s.name, filled: !!s.filled }))
      : []

    const shapes = deriveSessionShapes({
      lastClosingText: project.last_closeout_text ?? null,
      slots,
      mvsMinutes: project.mvs_minutes ?? null,
      windowMinutes: typeof window_minutes === 'number' ? window_minutes : null,
    })

    const { data: session, error: insertErr } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        project_id,
        window_minutes: window_minutes ?? null,
        items: shapes,
        source: source ?? 'live',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[sessions] start insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({
      session,
      shapes,
      ask_mvs_seed: needsMvsSeed(project.mvs_minutes ?? null, priorSessionCount ?? 0),
    })
  }

  // ─── CLOSE ──────────────────────────────────────────────────────────
  if (resource === 'close') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { session_id, closeout_text, mvs_seed_minutes } = req.body || {}
    if (!session_id) return res.status(400).json({ error: 'session_id required' })

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, project_id, started_at, user_id')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single()

    if (sessionErr || !session) return res.status(404).json({ error: 'session not found' })

    const endedAt = new Date()
    const startedAt = new Date(session.started_at)
    const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))

    const text = typeof closeout_text === 'string' ? closeout_text.trim() : ''
    const moved = text.length > 0 ? await classifyMoved(text) : null

    const { error: updateErr } = await supabase
      .from('sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        closeout_text: text || null,
        moved,
      })
      .eq('id', session_id)
      .eq('user_id', userId)

    if (updateErr) {
      console.error('[sessions] close update failed:', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    // Re-entry playback for next time, and MVS seeding/recompute.
    const projectUpdate: Record<string, unknown> = {}
    if (text) {
      projectUpdate.last_closeout_text = text
      projectUpdate.last_session_ended_at = endedAt.toISOString()
    }

    if (typeof mvs_seed_minutes === 'number' && mvs_seed_minutes > 0) {
      // One-time seed from the user's own estimate, asked only on session one.
      projectUpdate.mvs_minutes = Math.round(mvs_seed_minutes)
    } else {
      const { data: movedSessions } = await supabase
        .from('sessions')
        .select('duration_minutes')
        .eq('project_id', session.project_id)
        .eq('user_id', userId)
        .eq('moved', true)
        .not('duration_minutes', 'is', null)

      const measured = measuredMvs((movedSessions ?? []).map(s => s.duration_minutes as number))
      if (measured != null) projectUpdate.mvs_minutes = measured
    }

    if (Object.keys(projectUpdate).length > 0) {
      const { error: projErr } = await supabase
        .from('projects')
        .update(projectUpdate)
        .eq('id', session.project_id)
        .eq('user_id', userId)
      if (projErr) console.warn('[sessions] project re-entry update failed (non-fatal):', projErr.message)
    }

    return res.status(200).json({ ok: true, duration_minutes: durationMinutes, moved })
  }

  // ─── PENDING CLOSE-OUT ──────────────────────────────────────────────
  if (resource === 'pending-closeout') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const cutoff = new Date(Date.now() - DEFER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('sessions')
      .select('id, project_id, started_at, window_minutes, projects(title)')
      .eq('user_id', userId)
      .is('ended_at', null)
      .gte('started_at', cutoff)
      .order('started_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[sessions] pending-closeout query failed:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ pending: data?.[0] ?? null })
  }

  // ─── RETROACTIVE LOGGING ────────────────────────────────────────────
  // Accepts either explicit {project_id, duration_minutes}, or free text
  // ("did two hours on the decks last night") which gets parsed into both
  // via retro-parser.ts. Free text is the real path from the mirror's
  // "anything missing?" prompt -- a hardcoded duration on whichever
  // project happens to be live would make the mirror lie in a different
  // way than the gap it's meant to fix.
  if (resource === 'log-retro') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    let { project_id, duration_minutes, closeout_text } = req.body || {}
    const freeText = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

    if ((!project_id || !duration_minutes) && freeText) {
      const { parseRetroText } = await import('./_lib/retro-parser.js')
      const parsed = await parseRetroText(supabase, userId, freeText)
      if (!parsed) {
        return res.status(200).json({ ok: false, reason: 'could not tell which project or how long' })
      }
      project_id = parsed.projectId
      duration_minutes = parsed.durationMinutes
      closeout_text = closeout_text || freeText
    }

    if (!project_id || !duration_minutes) {
      return res.status(400).json({ error: 'project_id and duration_minutes, or text, required' })
    }

    const durationMinutes = Math.max(1, Math.round(Number(duration_minutes)))
    const startedAt = new Date(Date.now() - durationMinutes * 60000)
    const text = typeof closeout_text === 'string' ? closeout_text.trim() : ''
    const moved = text.length > 0 ? await classifyMoved(text) : null

    const { data: session, error: insertErr } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        project_id,
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
        closeout_text: text || null,
        moved,
        source: 'retro',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[sessions] log-retro insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ session })
  }

  // ─── DECLARE LIVE ───────────────────────────────────────────────────
  if (resource === 'declare-live') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    // The single-live-project trigger (019-execution-sessions.sql) demotes
    // any previous live project atomically -- this update doesn't need to.
    const { data, error } = await supabase
      .from('projects')
      .update({ state: 'live' })
      .eq('id', project_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[sessions] declare-live failed:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ project: data })
  }

  // ─── LIVE-PROJECT RE-ASK ────────────────────────────────────────────
  // Evidence-driven, not on a timer (SPEC.md): if the last 3 logged
  // sessions all landed on something other than the declared live
  // project, ask once whether that's the real live project now. An
  // accurate declaration is never interrupted -- this only fires when the
  // user's actual behaviour has quietly diverged from what they said.
  if (resource === 'live-reask') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const { data: liveProject } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('state', 'live')
      .maybeSingle()

    if (!liveProject) return res.status(200).json({ suggestion: null })

    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('project_id, projects(title)')
      .eq('user_id', userId)
      .not('project_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(3)

    if (!recentSessions || recentSessions.length < 3) return res.status(200).json({ suggestion: null })

    const allElsewhere = recentSessions.every(s => s.project_id !== liveProject.id)
    const sameOtherProject = new Set(recentSessions.map(s => s.project_id)).size === 1

    if (!allElsewhere || !sameOtherProject) return res.status(200).json({ suggestion: null })

    const other = recentSessions[0] as any
    return res.status(200).json({
      suggestion: { project_id: other.project_id, title: other.projects?.title ?? 'this' },
    })
  }

  // ─── HARVEST ────────────────────────────────────────────────────────
  // Manual kill, for a project the user explicitly lets go of. Never
  // deletes anything -- fragments and memories stay put, per SPEC.md's
  // "death is harvest." The automatic, silent version (drift + no recent
  // capture) is drift-runner.ts, run weekly from proposals.ts's cron.
  if (resource === 'harvest') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    const { error } = await supabase
      .from('projects')
      .update({ state: 'harvested' })
      .eq('id', project_id)
      .eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ─── MIRROR ─────────────────────────────────────────────────────────
  if (resource === 'mirror') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const { aggregateMonthlyMirror, monthStart } = await import('./_lib/mirror.js')
    const start = monthStart(new Date())

    const [{ data: sessionsData }, { data: projectsData }] = await Promise.all([
      supabase
        .from('sessions')
        .select('project_id, duration_minutes')
        .eq('user_id', userId)
        .gte('started_at', start.toISOString())
        .not('project_id', 'is', null),
      supabase.from('projects').select('id, title, state').eq('user_id', userId).neq('state', 'harvested'),
    ])

    const rows = aggregateMonthlyMirror(sessionsData ?? [], (projectsData ?? []) as any)
    return res.status(200).json({ month: start.toISOString().slice(0, 7), rows })
  }

  // ─── BOOK ───────────────────────────────────────────────────────────
  // "The book needs about two hours. When?" No calendar integration in
  // v1 -- this just remembers the date so it can open pre-loaded that day.
  if (resource === 'book') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id, when } = req.body || {}
    if (!project_id || !when) return res.status(400).json({ error: 'project_id and when required' })

    const { error } = await supabase
      .from('projects')
      .update({ booked_session_at: when })
      .eq('id', project_id)
      .eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` })
}
