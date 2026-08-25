/**
 * Sparks — the mull channel (SPEC.md).
 *
 * Resources:
 *   POST ?resource=bake   — cron, once nightly. Picks the next type
 *                            (spark-types.ts, weighted by talk-back rate,
 *                            never repeating yesterday's type) and bakes
 *                            today's spark. Silence is a valid outcome.
 *   GET  ?resource=today  — the still-live spark for today, if any.
 *   POST ?resource=respond — records the voice answer as a memory,
 *                             marks the spark answered.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { pickNextSparkType, type SparkHistoryEntry } from './_lib/spark-types.js'
import { generateSpark } from './_lib/spark-generator.js'

const HISTORY_WINDOW = 30

function getCronUserId(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization
  const expectedToken = process.env.IDEA_ENGINE_SECRET
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) return null
  return process.env.IDEA_ENGINE_USER_ID ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string
  const supabase = getSupabaseClient()

  // ─── BAKE (cron) ────────────────────────────────────────────────────
  if (resource === 'bake') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: historyRows } = await supabase
      .from('sparks')
      .select('type, answered_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW)

    const history: SparkHistoryEntry[] = (historyRows ?? []).map(r => ({
      type: r.type,
      answered: r.answered_at != null,
    }))

    const type = pickNextSparkType(history)
    const baked = await generateSpark(supabase, userId, type)

    if (!baked) {
      console.log(`[sparks] bake: type=${type} produced silence`)
      return res.status(200).json({ baked: false, type })
    }

    const { error: insertErr } = await supabase.from('sparks').insert({
      user_id: userId,
      type: baked.type,
      project_id: baked.project_id,
      text: baked.text,
      expires_at: baked.expires_at,
    })
    if (insertErr) {
      console.error('[sparks] bake insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ baked: true, type: baked.type })
  }

  // ─── TODAY ──────────────────────────────────────────────────────────
  if (resource === 'today') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('sparks')
      .select('id, type, text, project_id, shown_at, answered_at, expires_at, projects(title)')
      .eq('user_id', userId)
      .is('answered_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[sparks] today query failed:', error)
      return res.status(500).json({ error: error.message })
    }

    const spark = data?.[0] ?? null
    if (spark && !spark.shown_at) {
      // Mark shown on first read, not on bake -- shown_at is "the user
      // actually saw this," which the mirror/attention-budget logic and
      // future analytics need distinct from when it was generated.
      await supabase.from('sparks').update({ shown_at: new Date().toISOString() }).eq('id', spark.id)
    }

    return res.status(200).json({ spark })
  }

  // ─── RESPOND ────────────────────────────────────────────────────────
  if (resource === 'respond') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { spark_id, response_text } = req.body || {}
    if (!spark_id || !response_text) return res.status(400).json({ error: 'spark_id and response_text required' })

    const uniqueId = `spark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const { data: memory, error: memErr } = await supabase
      .from('memories')
      .insert({
        audiopen_id: uniqueId,
        title: 'Spark response',
        body: response_text,
        orig_transcript: response_text,
        tags: [],
        audiopen_created_at: new Date().toISOString(),
        processed: false,
        user_id: userId,
      })
      .select()
      .single()

    if (memErr) {
      console.error('[sparks] respond memory insert failed:', memErr)
      return res.status(500).json({ error: memErr.message })
    }

    const { error: updateErr } = await supabase
      .from('sparks')
      .update({ answered_at: new Date().toISOString(), response_memory_id: memory.id })
      .eq('id', spark_id)
      .eq('user_id', userId)

    if (updateErr) {
      console.error('[sparks] respond spark update failed:', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    // Kick the normal capture pipeline (embed, triage, fragment-attach) on
    // the response, same as any other voicing -- fire-and-forget.
    try {
      const { processMemory } = await import('./_lib/process-memory.js')
      processMemory(memory.id).catch(() => {})
    } catch {
      // Module not available — ignore
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` })
}
