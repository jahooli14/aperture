/**
 * The orbit pass, wired to the database.
 *
 * Pure half in orbit.ts. This is the IO: read every project and every
 * capture that has a vector, run the arithmetic, and hand back pairs whose
 * relationship is already established — so the draft call is asked to take
 * a next step rather than to invent a link.
 *
 * Two queries and no model call. The insight is free; the model only
 * writes it up.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { findOrbiters, pickOrbiters, type Embedded, type OrbitProject, type Orbiter } from './orbit.js'
import { isGraveyarded } from './project-state.js'

/** Whole-corpus reads are capped, not windowed — the same rule as the
 *  subject gatherers. */
const CORPUS_LIMIT = 2000

export async function findOrbitPairs(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  trace: string[] = [],
): Promise<Orbiter[]> {
  const [projectsRes, memoriesRes, fragmentsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, embedding, state, status')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(200),
    supabase
      .from('memories')
      .select('id, title, body, embedding, created_at')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT),
    // The link table: which memories already went into which project.
    supabase
      .from('fragments')
      .select('memory_id, project_id')
      .eq('user_id', userId)
      .limit(CORPUS_LIMIT),
  ])

  for (const [label, res] of [
    ['orbit-projects', projectsRes], ['orbit-memories', memoriesRes], ['orbit-fragments', fragmentsRes],
  ] as const) {
    const err = (res as { error: { message?: string } | null }).error
    if (err) {
      trace.push(`!! ${label} query FAILED: ${err.message ?? String(err)}`)
      return []
    }
  }

  // A project the user buried is not somewhere to put unused material.
  const projects: OrbitProject[] = (projectsRes.data ?? [])
    .filter((p: any) => !isGraveyarded(p))
    .map((p: any) => ({ id: p.id, title: p.title, embedding: p.embedding }))

  // A memory can be filed under several projects; orbit only needs to know
  // whether it went into THE one it is nearest to, so keep them all.
  const filed = new Map<string, Set<string>>()
  for (const f of (fragmentsRes.data ?? []) as any[]) {
    if (!f.memory_id || !f.project_id) continue
    if (!filed.has(f.memory_id)) filed.set(f.memory_id, new Set())
    filed.get(f.memory_id)!.add(f.project_id)
  }

  const captures: Embedded[] = (memoriesRes.data ?? []).map((m: any) => ({
    id: m.id,
    text: typeof m.body === 'string' && m.body.trim() ? m.body : (m.title ?? ''),
    createdAt: m.created_at,
    // Not used directly by findOrbiters' filing check (which compares one
    // id), so the nearest-project test below is what actually decides.
    projectId: null,
    embedding: m.embedding,
  })).filter((c: Embedded) => c.text.trim().length > 0)

  const all = findOrbiters(projects, captures)
  // Drop anything already filed under the very project it orbits — that
  // one went in, whatever the vectors say.
  const orbiting = all.filter(o => !filed.get(o.capture.id)?.has(o.project.id))

  trace.push(
    `orbit: ${projects.length} projects x ${captures.length} captures with vectors -> ` +
    `${all.length} orbiting -> ${orbiting.length} not already filed there`,
  )

  const picked = pickOrbiters(orbiting, limit)
  if (picked.length > 0) {
    trace.push(
      'orbit picks: ' +
      picked.map(o => `"${o.project.title}" <- ${o.similarity.toFixed(2)}${o.alsoNear ? ` (also near ${o.alsoNear})` : ''}`).join(' | '),
    )
  }
  return picked
}
