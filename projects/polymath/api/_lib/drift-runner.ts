/**
 * Drift runner (SPEC.md) — the IO half of drift.ts's pure classification.
 *
 * Only handles the "let it go" branch. "High drift + adjacent chatter"
 * (reshape) is already the morph pipeline's job — a project with fresh
 * fragments gets a morph proposal on its own schedule, so a second
 * mechanism reacting to the same condition would just be a redundant path
 * to the same outcome. This runner exists specifically for the branch
 * nothing else covers: a project that has drifted from what it describes
 * AND gone quiet. That one decays -- silently, never asking the user to
 * confirm a kill (SPEC.md), and never deleting anything: harvesting sets
 * state='harvested', full stop. Fragments and memories are untouched, so
 * a harvested project's material is still there for composites to draw on.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { cosineSimilarity } from './gemini-embeddings.js'
import { classifyDrift, isStalled } from './drift.js'

const CHATTER_LOOKBACK_DAYS = 90
const MIN_FRAGMENTS_TO_SCORE = 1

async function computeDriftScore(
  supabase: SupabaseClient,
  userId: string,
  project: { id: string; embedding: number[] | null }
): Promise<{ score: number; hasChatter: boolean } | null> {
  if (!project.embedding || project.embedding.length === 0) return null

  const cutoff = new Date(Date.now() - CHATTER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: fragmentRows } = await supabase
    .from('fragments')
    .select('memory_id, memories(embedding), created_at')
    .eq('project_id', project.id)
    .eq('user_id', userId)
    .gte('created_at', cutoff)

  const embeddings = (fragmentRows ?? [])
    .map((f: any) => f.memories?.embedding as number[] | null)
    .filter((e: number[] | null): e is number[] => !!e && e.length > 0)

  if (embeddings.length < MIN_FRAGMENTS_TO_SCORE) {
    // No recent capture at all connects to this project -- maximal drift,
    // no chatter. That's exactly the profile classifyDrift should treat
    // as "let it go" once it's also stalled.
    return { score: 1, hasChatter: false }
  }

  const avgSimilarity =
    embeddings.reduce((sum, e) => sum + cosineSimilarity(project.embedding as number[], e), 0) / embeddings.length

  return { score: 1 - avgSimilarity, hasChatter: true }
}

export async function runDriftDecay(supabase: SupabaseClient, userId: string): Promise<{ harvested: string[] }> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, embedding, last_session_ended_at, slots')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .neq('state', 'live') // never silently harvest the thing the user is actively executing
    .limit(200)

  const harvested: string[] = []

  for (const project of projects ?? []) {
    const stalled = isStalled({
      last_session_ended_at: project.last_session_ended_at,
      slots: Array.isArray(project.slots) ? project.slots : [],
    })
    if (!stalled) continue

    const drift = await computeDriftScore(supabase, userId, project)
    if (!drift) continue

    const verdict = classifyDrift(drift.score, drift.hasChatter)
    if (verdict !== 'let-go') continue

    const { error } = await supabase
      .from('projects')
      .update({ state: 'harvested' })
      .eq('id', project.id)
      .eq('user_id', userId)

    if (!error) {
      harvested.push(project.id)
      console.log(`[drift-runner] harvested project ${project.id} (${project.title}) -- drifted and silent`)
    }
  }

  return { harvested }
}
