/**
 * Facts about the project table that no search can find.
 *
 * The channel's strongest material has never reached a question. Everything
 * genuinely striking in this corpus is arithmetic over the project rows and
 * the calendar — a thing given up on and quietly started again six months
 * later, a day when four projects were opened and none survived — and none
 * of it resembles anything, so vector search is blind to all of it.
 *
 * Worse, the pipeline used to lose the facts it did compute: a temporal
 * shape became a blind-spot prompt, which became a search query, which
 * paired on similarity and dropped the fact on the floor. Orbit was the one
 * path that carried its claim all the way to the draft, and orbit is the
 * one path that produced defensible questions.
 *
 * So these do the same. Each returns a dated, checkable sentence and the
 * text it was computed from, and goes straight to the draft call.
 */

export interface ShapeProject {
  id: string
  title: string
  status: string | null
  createdAt: string
  embedding?: number[] | string | null
  description?: string | null
}

export interface ProjectShape {
  kind: 'restarted' | 'abandoned_batch'
  /** The project the question should point at. */
  projectId: string
  projectTitle: string
  /** True by construction, dated, and impossible to see from inside. */
  fact: string
  /** The user's own text this was computed from — what the draft may quote. */
  evidence: string
  strength: number
}

const DAY = 86_400_000
const DEAD = new Set(['abandoned', 'dormant'])

/** A project is dead when the user let it go, by either route. */
export function isDead(status: string | null | undefined): boolean {
  return DEAD.has((status ?? '').toLowerCase())
}

function vec(v: number[] | string | null | undefined): number[] | null {
  if (Array.isArray(v)) return v.length > 0 ? v : null
  if (typeof v === 'string' && v.length > 2) {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) && p.length > 0 ? p : null
    } catch { return null }
  }
  return null
}

function cosine(a: number[], b: number[]): number {
  let d = 0, ma = 0, mb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { d += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i] }
  return ma && mb ? d / (Math.sqrt(ma) * Math.sqrt(mb)) : 0
}

function monthYear(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/**
 * Near-identical in meaning — the same project, opened twice.
 *
 * Measured on the live corpus rather than picked. Project-to-project
 * similarity runs p50 0.52, p90 0.58, p99 0.72, and the only true restart in
 * 34 projects scores 0.84 ("Custom t-shirts" -> "Create custom t-shirts for
 * friends"). The next pair down is 0.81 — "A single note on paper" and
 * "Paint one wood block", two genuinely different projects that happen to
 * share a register — so a threshold of 0.80 was one notch from announcing a
 * restart that never happened.
 *
 * This is a claim about what someone DID. It has to be nearly impossible to
 * reach by accident, which means sitting above the corpus's own ceiling for
 * coincidence, not just above its average.
 */
export const RESTART_SIM = 0.82
/** Long enough that it was forgotten rather than duplicated by accident. */
export const RESTART_MIN_GAP_DAYS = 60

/**
 * A project given up on, then started again from scratch months later.
 *
 * Live: "Custom t-shirts" abandoned in January, "Create custom t-shirts for
 * friends" created in June — 176 days apart, 0.84 similar, two separate rows
 * with no memory of each other. The user cannot see this; the app can only
 * see it by comparing every dead project against everything created after.
 */
export function findRestarts(projects: ShapeProject[], now: Date = new Date()): ProjectShape[] {
  const out: ProjectShape[] = []
  for (const dead of projects) {
    if (!isDead(dead.status)) continue
    const dv = vec(dead.embedding)
    if (!dv) continue
    for (const later of projects) {
      if (later.id === dead.id) continue
      const lv = vec(later.embedding)
      if (!lv) continue
      const gap = (new Date(later.createdAt).getTime() - new Date(dead.createdAt).getTime()) / DAY
      if (!Number.isFinite(gap) || gap < RESTART_MIN_GAP_DAYS) continue
      const sim = cosine(dv, lv)
      if (sim < RESTART_SIM) continue
      const months = Math.round(gap / 30)
      out.push({
        kind: 'restarted',
        projectId: later.id,
        projectTitle: later.title,
        // BOTH months, named. The fact used to say only "6 months later",
        // and the draft would reasonably write "and started it again in
        // June" -- which `unsupportedSpecifics` then rejected as an
        // invention, because June appeared nowhere in the evidence. Every
        // restart question died on a date the fact could have supplied.
        // A gate that can only see what it is given has to be given it.
        fact:
          `They gave up on "${dead.title}" in ${monthYear(dead.createdAt)}. ` +
          `In ${monthYear(later.createdAt)} — ${months} months later — they started ` +
          `"${later.title}" from scratch, as a separate project, ` +
          `with no reference to the first one.`,
        evidence: `${dead.title}. ${dead.description ?? ''}`.trim(),
        // The longer the gap, the less chance it was a deliberate redo.
        strength: 1.2 + Math.min(gap / 730, 0.3),
      })
    }
  }
  return out.sort((a, b) => b.strength - a.strength)
}

/** Enough projects in one sitting that it was a mood, not a decision. */
export const BATCH_MIN = 3

/**
 * A day when several projects were opened and none of them survived.
 *
 * Live: on 3 January three projects were created — a memory palace, custom
 * t-shirts, a book of side quests — and all three are dead. That is a fact
 * about a single afternoon, and the only way to see it is to count.
 */
export function findAbandonedBatches(projects: ShapeProject[]): ProjectShape[] {
  const byDay = new Map<string, ShapeProject[]>()
  for (const p of projects) {
    const day = p.createdAt.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(p)
  }

  const out: ProjectShape[] = []
  for (const [day, sameDay] of byDay) {
    if (sameDay.length < BATCH_MIN) continue
    const dead = sameDay.filter(p => isDead(p.status))
    // Every one of them. A batch where something survived is a productive
    // afternoon, not a question.
    if (dead.length !== sameDay.length) continue
    const titles = sameDay.map(p => `"${p.title}"`).join(', ')
    out.push({
      kind: 'abandoned_batch',
      projectId: sameDay[0].id,
      projectTitle: sameDay[0].title,
      fact:
        `On ${new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} ` +
        `they started ${sameDay.length} projects in one sitting — ${titles} — and every one of them is dead.`,
      evidence: sameDay.map(p => `${p.title}. ${p.description ?? ''}`.trim()).join(' '),
      strength: 1.1 + Math.min(sameDay.length / 20, 0.3),
    })
  }
  return out.sort((a, b) => b.strength - a.strength)
}
