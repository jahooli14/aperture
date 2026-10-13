/**
 * Routes for themes and "bring me up to speed" — resources on
 * utilities.ts (the function budget, see CLAUDE.md), logic here.
 *
 *   POST ?resource=themes       { project_id, action: 'draft' }           -> { themes: string[] }   (not saved)
 *   POST ?resource=themes       { project_id, action: 'set', themes }     -> { themes: ProjectTheme[] }
 *   POST ?resource=up-to-speed  { project_id, refresh? }                  -> { up_to_speed: UpToSpeed | null }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { loadProjectMaterial, materialEvidence } from './project-material.js'
import { buildThemesPrompt, normalizeThemes, parseThemeDraft, readThemes } from './project-themes.js'
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
    const ok = await mergeMetadata(supabase, userId, project_id, { themes: next })
    if (!ok) return res.status(500).json({ error: "Couldn't save those" })
    return res.status(200).json({ themes: next })
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

  return res.status(400).json({ error: "action must be 'draft' or 'set'" })
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
