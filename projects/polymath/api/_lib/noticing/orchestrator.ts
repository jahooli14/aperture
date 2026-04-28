/**
 * Orchestrator — runs the three-agent noticing pipeline.
 *
 *   gather signals → Historian (cached) → Noticer → Writer (veto loop)
 *
 * If no candidate survives the Writer's filter, returns null. Silence is an
 * acceptable output. The route layer decides whether to fall back to the
 * user's most recent stored noticing.
 */

import type { getSupabaseClient } from '../supabase.js'
import { gatherSignals } from './gather.js'
import { getOrBuildSketch } from './historian.js'
import { proposeCandidates } from './noticer.js'
import { writeNoticing } from './writer.js'
import type { Noticing, NoticingShape, NoticingSourceMeta, Signal } from './types.js'

export interface OrchestrateInput {
  supabase: ReturnType<typeof getSupabaseClient>
  userId: string
  excludeKeys?: Set<string>
  critique?: string
  forceSketchRebuild?: boolean
}

export interface OrchestrateResult {
  noticing: Omit<Noticing, 'id'> | null
  sources_seen: { memories: number; list_items: number; projects: number; total: number }
  reason?: 'no_signal' | 'no_candidate' | 'no_voice'
  attempts?: number
}

export async function orchestrate({
  supabase,
  userId,
  excludeKeys = new Set(),
  critique,
  forceSketchRebuild = false,
}: OrchestrateInput): Promise<OrchestrateResult> {
  const signals = await gatherSignals(supabase, userId)

  const sources_seen = {
    memories: countKind(signals, 'memory'),
    list_items: countKind(signals, 'list_item'),
    projects: countKind(signals, 'project'),
    total: signals.length,
  }

  if (signals.length === 0) {
    return { noticing: null, sources_seen, reason: 'no_signal' }
  }

  const sketch = await getOrBuildSketch(supabase, userId, { force: forceSketchRebuild })
  const candidates = await proposeCandidates({ signals, sketch, excludeKeys, critique })

  if (candidates.length === 0) {
    return { noticing: null, sources_seen, reason: 'no_candidate' }
  }

  // Try candidates strongest-first. Writer has its own internal retry loop;
  // if it gives up on one, we move to the next. Cap attempts so a hostile
  // input can't run unbounded.
  const MAX_CANDIDATES = Math.min(candidates.length, 3)
  let attempts = 0
  for (let i = 0; i < MAX_CANDIDATES; i++) {
    const c = candidates[i]
    const result = await writeNoticing(c)
    if (result) {
      attempts += result.attempts
      return {
        noticing: shapeNoticing(result.lines, c.shape, c.evidence),
        sources_seen,
        attempts,
      }
    }
    attempts += 3 // count exhausted-retry candidates against the budget
  }

  return { noticing: null, sources_seen, reason: 'no_voice', attempts }
}

function countKind(signals: Signal[], kind: Signal['kind']): number {
  return signals.filter(s => s.kind === kind).length
}

function shapeNoticing(
  lines: string[],
  shape: NoticingShape,
  evidence: Array<{ kind: Signal['kind']; source_id: string; label: string; date: string; excerpt: string }>,
): Omit<Noticing, 'id'> {
  const sources: NoticingSourceMeta[] = evidence.map(e => ({
    kind: e.kind,
    source_id: e.source_id,
    label: e.label,
    date: e.date,
    excerpt: e.excerpt,
  }))
  return {
    lines,
    shape,
    sources,
    served_at: new Date().toISOString(),
  }
}

export function sourceKeysFromNoticing(n: Pick<Noticing, 'sources'>): string[] {
  return n.sources.map(s => `${s.kind}:${s.source_id}`)
}
