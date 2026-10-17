/**
 * Routes for themes and "bring me up to speed" — resources on
 * utilities.ts (the function budget, see CLAUDE.md), logic here.
 *
 *   POST ?resource=themes       { project_id, action: 'draft' }           -> { themes: string[] }   (not saved)
 *   POST ?resource=themes       { project_id, action: 'set', themes }     -> { themes: ProjectTheme[] }
 *   POST ?resource=themes       { project_id, action: 'refresh' }         -> { themes, changed, previous? }   (re-read against new notes)
 *   POST ?resource=up-to-speed  { project_id, refresh? }                  -> { up_to_speed: UpToSpeed | null }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { loadProjectMaterial, materialEvidence } from './project-material.js'
import { buildThemesPrompt, buildThemesRefreshPrompt, materialSignature, normalizeThemes, parseThemeDraft, parseThemeRefresh, readThemes } from './project-themes.js'
import { buildUpToSpeedPrompt, isFresh, parseUpToSpeed, readUpToSpeed } from './up-to-speed.js'

const MODEL_TIMEOUT_MS = 20_000

/** Re-read metadata right before writing, so a slow model call can't wipe
 *  something that changed meanwhile (same rule as saveMove). */
async function mergeMetadata(
  supabase: SupabaseClient, userId: string, projectId: string, patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('projects').select('metadata').eq('id', projectId).eq('user_id', userId).single()
  if (error || !data) {
    console.error('[catchup] could not re-read the project before saving:', error?.message)
    return false
  }
  const metadata = (data.metadata as Record<string, unknown>) ?? {}
  const { error: saveErr } = await supabase
    .from('projects').update({ metadata: { ...metadata, ...patch } })
    .eq('id', projectId).eq('user_id', userId)
  if (saveErr) {
    console.error('[catchup] save failed:', saveErr.message)
    return false
  }
  return true
}

/** Re-reads a project's lines against its notes. Null when the project isn't
 *  the person's. Never throws: a failed model call leaves the lines alone. */
export async function refreshThemes(
  supabase: SupabaseClient, userId: string, project_id: string, force = false,
): Promise<{ themes: ReturnType<typeof readThemes>; changed: boolean; previous?: string[] } | null> {
  const current = await supabase
    .from('projects').select('metadata').eq('id', project_id).eq('user_id', userId).single()
  if (current.error || !current.data) return null
  const before = readThemes(current.data.metadata)
  // Never author lines from nothing behind someone's back.
  if (before.length === 0) return { themes: before, changed: false }
  const material = await loadProjectMaterial(supabase, userId, project_id)
  if (!material || material.rows.length === 0) return { themes: before, changed: false }

  const signature = materialSignature(material.rows)
  const meta = (current.data.metadata ?? {}) as Record<string, unknown>
  if (!force && meta.themes_signature === signature) return { themes: before, changed: false }

  const evidence = materialEvidence(material)
  const currentTexts = before.map(t => t.text)
  try {
    const raw = await generateText(
      buildThemesRefreshPrompt({ title: material.title, description: material.description, current: currentTexts, evidence }),
      { model: MODELS.SESSION_SHAPE_CHAT, responseFormat: 'json', temperature: 0.2, maxTokens: 400, thinkingLevel: 'low', timeoutMs: MODEL_TIMEOUT_MS },
    )
    const refreshed = parseThemeRefresh(raw, evidence, material.title, currentTexts)
    const same = refreshed.length === 0
      || (refreshed.length === currentTexts.length && refreshed.every((t, i) => t.toLowerCase() === currentTexts[i].toLowerCase()))
    if (same) {
      await mergeMetadata(supabase, userId, project_id, { themes_signature: signature })
      return { themes: before, changed: false }
    }
    const next = normalizeThemes(refreshed, before)
    const ok = await mergeMetadata(supabase, userId, project_id, {
      themes: next,
      themes_signature: signature,
      themes_update: { at: new Date().toISOString(), previous: currentTexts },
    })
    if (!ok) return { themes: before, changed: false }
    return { themes: next, changed: true, previous: currentTexts }
  } catch (e) {
    // The signature is left alone so the next look tries again.
    console.error('[themes] refresh failed:', e instanceof Error ? e.message : String(e))
    return { themes: before, changed: false }
  }
}

export async function handleThemes(
  req: VercelRequest, res: VercelResponse, supabase: SupabaseClient, userId: string,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  const { project_id, action, themes } = req.body || {}
  if (typeof project_id !== 'string' || !project_id) return res.status(400).json({ error: 'project_id required' })

  if (action === 'set') {
    const { data, error } = await supabase
      .from('projects').select('metadata').eq('id', project_id).eq('user_id', userId).single()
    if (error || !data) return res.status(404).json({ error: 'project not found' })
    const next = normalizeThemes(themes, readThemes(data.metadata))
    // A hand edit (or an Undo) settles it: the lines are what the owner wants
    // now, so the "updated from your notes" marker goes.
    // And they were written against the notes as they stand, so the next look
    // doesn't re-read them against the same notes and undo the edit.
    const material = await loadProjectMaterial(supabase, userId, project_id)
    const ok = await mergeMetadata(supabase, userId, project_id, {
      themes: next, themes_update: null,
      ...(material && material.rows.length ? { themes_signature: materialSignature(material.rows) } : {}),
    })
    if (!ok) return res.status(500).json({ error: "Couldn't save those" })
    return res.status(200).json({ themes: next })
  }

  if (action === 'refresh') {
    const out = await refreshThemes(supabase, userId, project_id, !!req.body?.force)
    return out ? res.status(200).json(out) : res.status(404).json({ error: 'project not found' })
  }

  if (action === 'draft') {
    const material = await loadProjectMaterial(supabase, userId, project_id)
    if (!material) return res.status(404).json({ error: 'project not found' })
    const evidence = materialEvidence(material)
    if (evidence.length === 0) return res.status(200).json({ themes: [] })
    try {
      const raw = await generateText(
        buildThemesPrompt({ title: material.title, description: material.description, evidence }),
        { model: MODELS.SESSION_SHAPE_CHAT, responseFormat: 'json', temperature: 0.3, maxTokens: 400, thinkingLevel: 'low', timeoutMs: MODEL_TIMEOUT_MS },
      )
      return res.status(200).json({ themes: parseThemeDraft(raw, evidence, material.title) })
    } catch (e) {
      console.error('[themes] draft failed:', e instanceof Error ? e.message : String(e))
      return res.status(200).json({ themes: [] })
    }
  }

  return res.status(400).json({ error: "action must be 'draft', 'set' or 'refresh'" })
}

export async function handleUpToSpeed(
  req: VercelRequest, res: VercelResponse, supabase: SupabaseClient, userId: string,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  const { project_id, refresh } = req.body || {}
  if (typeof project_id !== 'string' || !project_id) return res.status(400).json({ error: 'project_id required' })

  const material = await loadProjectMaterial(supabase, userId, project_id)
  if (!material) return res.status(404).json({ error: 'project not found' })
  if (material.rows.length === 0) return res.status(200).json({ up_to_speed: null })

  const newest = material.rows[0]?.at ?? null
  const cached = readUpToSpeed(material.metadata)
  if (!refresh && isFresh(cached, newest)) return res.status(200).json({ up_to_speed: cached })

  const lastWorked = material.lastSessionAt || material.lastActive
  const daysAway = lastWorked ? Math.max(0, Math.floor((Date.now() - new Date(lastWorked).getTime()) / 86_400_000)) : 0
  const evidence = materialEvidence(material)
  try {
    const raw = await generateText(
      buildUpToSpeedPrompt({ title: material.title, description: material.description, endGoal: material.endGoal, daysAway, evidence }),
      { model: MODELS.SESSION_SHAPE_CHAT, responseFormat: 'json', temperature: 0.2, maxTokens: 600, thinkingLevel: 'low', timeoutMs: MODEL_TIMEOUT_MS },
    )
    const result = parseUpToSpeed(raw, evidence, material.title, newest)
    // Cached even when empty-handed? No: a null result is cheap to retry
    // and might be a bad model day. Only a real one is kept.
    if (result) await mergeMetadata(supabase, userId, project_id, { up_to_speed: result })
    return res.status(200).json({ up_to_speed: result })
  } catch (e) {
    console.error('[up-to-speed] failed:', e instanceof Error ? e.message : String(e))
    // A stale catch-up beats none when the model is down.
    return res.status(200).json({ up_to_speed: cached })
  }
}
