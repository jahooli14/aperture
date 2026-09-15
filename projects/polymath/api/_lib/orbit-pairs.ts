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
import {
  findOrbiters, pickOrbiters, cosine, toVec, projectCentroid,
  type Embedded, type OrbitProject, type Orbiter,
} from './orbit.js'
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

  // A memory can be filed under several projects; orbit only needs to know
  // whether it went into THE one it is nearest to, so keep them all.
  const filed = new Map<string, Set<string>>()
  const ownedBy = new Map<string, string[]>()
  for (const f of (fragmentsRes.data ?? []) as any[]) {
    if (!f.memory_id || !f.project_id) continue
    if (!filed.has(f.memory_id)) filed.set(f.memory_id, new Set())
    filed.get(f.memory_id)!.add(f.project_id)
    if (!ownedBy.has(f.project_id)) ownedBy.set(f.project_id, [])
    ownedBy.get(f.project_id)!.push(f.memory_id)
  }

  const memoryById = new Map<string, any>()
  for (const m of (memoriesRes.data ?? []) as any[]) memoryById.set(m.id, m)

  // A project the user buried is not somewhere to put unused material.
  //
  // The vector each project is compared WITH is its centroid, not its
  // description (orbit.ts). `projects.embedding` is title plus description —
  // often twenty words — and every capture it is scored against is a
  // paragraph, so the two sit at different length scales and a thin
  // description makes a project everyone's nearest neighbour. The captures
  // already filed under a project are the project, they are already loaded,
  // and weighting them by age gives the vector a time dimension the text
  // could never honestly carry.
  let centroidsBuilt = 0
  const projects: OrbitProject[] = (projectsRes.data ?? [])
    .filter((p: any) => !isGraveyarded(p))
    .map((p: any) => {
      const own = (ownedBy.get(p.id) ?? [])
        .map(id => memoryById.get(id))
        .filter(Boolean)
        .map((m: any) => ({ embedding: m.embedding, createdAt: m.created_at }))
      const centroid = projectCentroid(p.embedding, own)
      if (own.length > 0 && centroid) centroidsBuilt++
      return { id: p.id, title: p.title, embedding: centroid ?? p.embedding }
    })
  trace.push(
    `orbit: ${centroidsBuilt} of ${projects.length} projects positioned by their own captures ` +
    '(the rest by description alone)',
  )

  const captures: Embedded[] = (memoriesRes.data ?? []).map((m: any) => ({
    id: m.id,
    text: typeof m.body === 'string' && m.body.trim() ? m.body : (m.title ?? ''),
    createdAt: m.created_at,
    // Not used directly by findOrbiters' filing check (which compares one
    // id), so the nearest-project test below is what actually decides.
    projectId: null,
    embedding: m.embedding,
  })).filter((c: Embedded) => c.text.trim().length > 0)

  // Measure the geometry before trusting any band drawn on it.
  //
  // The bands elsewhere in this channel (CONNECTOR_FLOOR 0.45, ceiling
  // 0.82) were tuned on QUERY->DOCUMENT similarity: a short blind-spot
  // question against note bodies. Orbit is DOCUMENT->DOCUMENT -- a
  // project's title+description against a memory body -- which is a
  // different distribution, and a band copied across from one to the
  // other is a guess wearing a number.
  //
  // Two things decide whether this mechanism can work at all:
  //   the SPREAD of each capture's best-project score (if everything
  //   scores the same, no floor can separate near from far), and
  //   the MARGIN between best and second-best (if they are equal,
  //   "closest to THIS project" is noise and the claim is false).
  trace.push(...describeGeometry(projects, captures))

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

/** Percentile of a sorted ascending array. */
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[i]
}

/**
 * What the vector space actually looks like here, in numbers, so a band
 * can be drawn from evidence instead of from memory.
 */
export function describeGeometry(projects: OrbitProject[], captures: Embedded[]): string[] {
  const pv = projects
    .map(p => toVec(p.embedding))
    .filter((v): v is number[] => v !== null)
  if (pv.length < 2 || captures.length === 0) return ['orbit geometry: not enough vectors to measure']

  const bests: number[] = []
  const margins: number[] = []
  for (const c of captures) {
    const v = toVec(c.embedding)
    if (!v) continue
    const scores = pv.map(p => cosine(v, p)).sort((a, b) => b - a)
    bests.push(scores[0])
    margins.push(scores[0] - scores[1])
  }
  if (bests.length === 0) return ['orbit geometry: no captures with vectors']

  const b = [...bests].sort((x, y) => x - y)
  const m = [...margins].sort((x, y) => x - y)
  const f = (n: number) => n.toFixed(3)
  return [
    `orbit geometry: best-project score p10 ${f(pct(b, 10))} p50 ${f(pct(b, 50))} ` +
    `p90 ${f(pct(b, 90))} p99 ${f(pct(b, 99))} max ${f(b[b.length - 1])}`,
    `orbit geometry: margin over 2nd-best p50 ${f(pct(m, 50))} p90 ${f(pct(m, 90))} ` +
    `p99 ${f(pct(m, 99))} max ${f(m[m.length - 1])}`,
  ]
}
