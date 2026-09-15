/**
 * What is orbiting a project and has never gone in.
 *
 * The channel used to work like this: pick a subject, ask a model to name
 * its blind spot, strip that question of the subject's vocabulary, search
 * the corpus with it, and hand whatever came back to a second model call
 * with the instruction "write a question". The search decided the pairing
 * silently, on similarity, and nothing ever established WHY the two
 * things belonged in one sentence. So the draft could only name A, name
 * B, and put a hinge between them:
 *
 *   "You wrote about falling asleep and trying to open a door to the
 *    dream world... You have come back three times to walking Oscar since
 *    February. Does the dream happen on the walk, or at the desk?"
 *
 * Two real captures and a manufactured `or`. The project the card was
 * filed under — Paint one wood block — appears nowhere in it.
 *
 * The fix is not a better-worded prompt. It is to stop asking the model
 * for the insight at all, and compute one that is true by construction.
 *
 * ORBIT: a capture is orbiting a project when the vectors say it belongs
 * there and the filing says it never went in. Three conditions, all
 * arithmetic:
 *
 *   NEAR       — close enough to the project to be about it.
 *   NOT INSIDE — it is not one of the project's own captures.
 *   NOT A RESTATEMENT — far enough that it adds something. Above the
 *                ceiling it is the project description in other words,
 *                which is the collision the old channel kept producing.
 *
 * Plus the one that makes it mean something: THIS project is the capture's
 * nearest. A note near four projects is a general interest. A note nearer
 * to this project than to any of the other thirty-three, written eight
 * months ago, never filed — that is a specific, checkable claim about a
 * specific project, and the answer to it is something to make.
 *
 * Which is also why this is forward-looking where the old shape was not.
 * A juxtaposition asks you to admire a coincidence. Orbiting material asks
 * what the project becomes if you use it — and the material is sitting
 * right there, already in your own words.
 */

export interface Embedded {
  id: string
  text: string
  createdAt: string
  /** The project it is filed under, if any. */
  projectId: string | null
  /** pgvector hands these back as a JSON string on some paths. */
  embedding: number[] | string | null
}

export interface OrbitProject {
  id: string
  title: string
  embedding: number[] | string | null
}

export interface Orbiter {
  capture: Embedded
  project: OrbitProject
  similarity: number
  /** How many other projects have a real claim on this capture too. 0 is the
   *  prize: it belongs to this one and nothing else. */
  alsoNear: number
  /** True, computed, and not something a model could invent. */
  fact: string
  /** Higher ships first. */
  strength: number
}

/**
 * Below this the capture is not about the project at all.
 *
 * Measured, not guessed. On the live corpus with centroid project vectors
 * (projectCentroid), a capture's best-project score runs p10 0.667, p50
 * 0.749, p90 0.884, max 0.989. The old 0.55 sat below the tenth percentile,
 * so it admitted essentially everything and did no work -- which is what
 * made every pick read "also near 14 others".
 */
export const ORBIT_FLOOR = 0.70
/**
 * Above this it is the project restated rather than something to bring
 * into it — the note that says what the description already says. The old
 * channel's commonest failure was pairing a project with itself in
 * different words, and it read as profound for exactly one second.
 *
 * 0.88 was a guess made before the geometry was measured, and it sat on the
 * 90th percentile — throwing away a tenth of the real matches as if they
 * were restatements. Restatement lives up at p99 (0.928) and above.
 */
export const ORBIT_CEILING = 0.93
/** Old enough that not filing it was a choice rather than a backlog. */
export const ORBIT_MIN_AGE_DAYS = 30

/**
 * How far clear of the runner-up the winner must be for "this project is its
 * nearest" to be a claim rather than a coin toss.
 *
 * Counting rivals by the floor was wrong for the same reason an absolute
 * floor is wrong for fragment attachment (fragments.ts): in this space
 * almost everything clears any floor you can honestly set, so every capture
 * came out "also near" a dozen projects and the one distinction orbit exists
 * to draw was never drawn. Live margins: p50 0.047, p90 0.202, max 0.333.
 */
export const ORBIT_RIVAL_MARGIN = 0.05

const DAY = 86_400_000

/** pgvector round-trips as a JSON string sometimes; accept either. */
export function toVec(v: number[] | string | null | undefined): number[] | null {
  if (Array.isArray(v)) return v.length > 0 ? v : null
  if (typeof v === 'string' && v.length > 2) {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
    } catch { return null }
  }
  return null
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i] }
  if (ma === 0 || mb === 0) return 0
  return dot / (Math.sqrt(ma) * Math.sqrt(mb))
}

function humanAge(days: number): string {
  const d = Math.round(days)
  if (d < 14) return `${Math.max(1, d)} days ago`
  if (d < 60) return `${Math.round(d / 7)} weeks ago`
  if (d < 730) return `${Math.round(d / 30)} months ago`
  return `${Math.round(d / 365)} years ago`
}

/**
 * Every capture orbiting any of these projects, strongest first.
 *
 * O(captures × projects) on vectors already in memory — no model call, no
 * query. The whole point is that the insight is free and the model only
 * writes it up.
 */
export function findOrbiters(
  projects: OrbitProject[],
  captures: Embedded[],
  now: Date = new Date(),
): Orbiter[] {
  const projectVecs = projects
    .map(p => ({ project: p, vec: toVec(p.embedding) }))
    .filter((p): p is { project: OrbitProject; vec: number[] } => p.vec !== null)
  if (projectVecs.length === 0) return []

  const out: Orbiter[] = []

  for (const capture of captures) {
    const vec = toVec(capture.embedding)
    if (!vec) continue
    const ageDays = (now.getTime() - new Date(capture.createdAt).getTime()) / DAY
    if (!Number.isFinite(ageDays) || ageDays < ORBIT_MIN_AGE_DAYS) continue

    // Score against every project once, so "is this project its nearest"
    // is answered rather than assumed.
    const scored = projectVecs
      .map(p => ({ project: p.project, similarity: cosine(vec, p.vec) }))
      .sort((a, b) => b.similarity - a.similarity)

    const best = scored[0]
    if (!best) continue
    // Already filed here: it went in, so it is not orbiting.
    if (capture.projectId === best.project.id) continue
    if (best.similarity < ORBIT_FLOOR || best.similarity > ORBIT_CEILING) continue

    // Near several projects means a general interest, not this project's
    // unused material. Counted, not excluded — it weakens the claim
    // rather than voiding it. A rival counts when it is within touching
    // distance of the winner, not merely when it clears the floor.
    const alsoNear = scored.slice(1).filter(s => best.similarity - s.similarity < ORBIT_RIVAL_MARGIN).length

    out.push({
      capture,
      project: best.project,
      similarity: best.similarity,
      alsoNear,
      fact: alsoNear === 0
        ? `They wrote this ${humanAge(ageDays)}. Of all their projects it sits closest to "${best.project.title}", and it is not part of it.`
        : `They wrote this ${humanAge(ageDays)}. It sits closest to "${best.project.title}" — nearer than to any of their other projects — and it never became part of it.`,
      // Belonging to exactly one project is the strongest version of this,
      // and age breaks ties: material that has been sitting a year unused
      // is a better question than last month's.
      strength: (alsoNear === 0 ? 1 : 0.8) + Math.min(ageDays / 730, 0.4),
    })
  }

  return out.sort((a, b) => b.strength - a.strength)
}

/**
 * One orbiter per project, best first.
 *
 * Without this a single magnetic project takes every slot, and the run
 * asks three questions about the same thing.
 */
export function pickOrbiters(orbiters: Orbiter[], limit: number): Orbiter[] {
  const seen = new Set<string>()
  const out: Orbiter[] = []
  for (const o of orbiters) {
    if (seen.has(o.project.id)) continue
    seen.add(o.project.id)
    out.push(o)
    if (out.length >= limit) break
  }
  return out
}

/**
 * A project's vector, built from what the project actually is rather than
 * from its description alone.
 *
 * `projects.embedding` comes from `title + "\n\n" + description` — often
 * twenty words, sometimes fewer. Every capture it gets compared against is
 * a paragraph. That length asymmetry is not a detail: short text sits in a
 * systematically different part of the space, so project-to-memory scores
 * are not comparable to the memory-to-memory scores the channel's other
 * bands were tuned on, and a thin description makes a project a hub that
 * is everyone's nearest neighbour.
 *
 * The project's captures are the project. Averaging their vectors gives a
 * centroid in the same register and at the same length scale as the things
 * it is being compared to, and it costs nothing — the vectors are already
 * loaded. The description still counts, weighted like a single capture, so
 * a project with no captures yet still has a position.
 *
 * TIME IS NOT IN THE VECTOR, and must not be. Embedding "March 2024"
 * alongside the text makes every note from that month look alike, which is
 * false. Time weights the AVERAGE instead: recent captures pull the
 * centroid harder, so a project's position follows where the work actually
 * went rather than where it started. That is the time dimension a vector
 * can honestly carry.
 */
export function projectCentroid(
  description: number[] | string | null,
  captures: { embedding: number[] | string | null; createdAt: string }[],
  now: Date = new Date(),
  halfLifeDays = 180,
): number[] | null {
  const parts: { vec: number[]; weight: number }[] = []

  const desc = toVec(description)
  if (desc) parts.push({ vec: desc, weight: 1 })

  for (const c of captures) {
    const vec = toVec(c.embedding)
    if (!vec) continue
    const ageDays = (now.getTime() - new Date(c.createdAt).getTime()) / DAY
    if (!Number.isFinite(ageDays)) continue
    // Half-life decay: a capture from six months ago counts half as much
    // as one from today. Never zero — the old ones are still the project.
    const weight = Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays)
    parts.push({ vec, weight })
  }

  if (parts.length === 0) return null

  const dims = Math.max(...parts.map(p => p.vec.length))
  const sum = new Array(dims).fill(0)
  let totalWeight = 0
  for (const { vec, weight } of parts) {
    for (let i = 0; i < vec.length; i++) sum[i] += vec[i] * weight
    totalWeight += weight
  }
  if (totalWeight === 0) return null

  // Unit-length, so the centroid is comparable with any other vector here
  // (every stored vector is normalized on write — gemini-embeddings.ts).
  const mean = sum.map(v => v / totalWeight)
  let mag = 0
  for (const v of mean) mag += v * v
  mag = Math.sqrt(mag)
  return mag === 0 ? null : mean.map(v => v / mag)
}

/**
 * How far a project's centre has moved: its early captures against its
 * late ones.
 *
 * Purely temporal and impossible to see any other way. A project whose
 * vocabulary has drifted is a project becoming something else, and the
 * corpus knows it before the person does. 0 is "exactly where it started",
 * 1 is "unrecognisable".
 */
export function centroidDrift(
  captures: { embedding: number[] | string | null; createdAt: string }[],
  minPerHalf = 3,
): number | null {
  const dated = captures
    .map(c => ({ vec: toVec(c.embedding), t: new Date(c.createdAt).getTime() }))
    .filter((c): c is { vec: number[]; t: number } => c.vec !== null && Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t)
  if (dated.length < minPerHalf * 2) return null

  const half = Math.floor(dated.length / 2)
  const mean = (rows: { vec: number[] }[]) => {
    const dims = Math.max(...rows.map(r => r.vec.length))
    const sum = new Array(dims).fill(0)
    for (const r of rows) for (let i = 0; i < r.vec.length; i++) sum[i] += r.vec[i]
    return sum.map(v => v / rows.length)
  }
  return 1 - cosine(mean(dated.slice(0, half)), mean(dated.slice(half)))
}
