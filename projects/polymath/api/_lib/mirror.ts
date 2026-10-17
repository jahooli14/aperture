/**
 * The mirror (SPEC.md) — the only number the app ever shows: the days you
 * touched each project this month, worked out from what you left behind (a
 * note, a close-out, a line in the box on its page). Nothing to start or stop.
 *
 * "Zeros shown only for the live project" is the one rule that keeps this
 * from being a guilt wall:  a full list of zero-day projects is an
 * accusation, but "8 days DJing, 0 on the book" (when the book is what
 * you declared) is the nudge that flips you back.
 */

/** Something you did that leaves a trace on a project: a note filed under it,
 *  a close-out, a line said in the box on its page. `at` is an ISO time. */
export interface WorkTrace {
  project_id: string
  at: string
}

export interface ProjectForMirror {
  id: string
  title: string
  state?: string | null
}

export interface MirrorRow {
  project_id: string
  title: string
  /** Days this month with at least one trace. Not minutes: nobody remembers
   *  to press start and stop, and counting minutes turned it into a timesheet. */
  days: number
  is_live: boolean
}

/** The calendar day a time falls on for the person: `tzOffsetMin` is what
 *  `new Date().getTimezoneOffset()` returns in their browser. */
export function localDay(iso: string, tzOffsetMin = 0): string | null {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t - tzOffsetMin * 60_000).toISOString().slice(0, 10)
}

/**
 * Pure aggregation: traces -> distinct days per project for the month, with
 * the live project always included (even at zero) and every other zero-day
 * project dropped. Rows are sorted by days descending so the project that
 * actually got the attention leads.
 */
export function aggregateMonthlyMirror(
  traces: WorkTrace[],
  projects: ProjectForMirror[],
  tzOffsetMin = 0,
): MirrorRow[] {
  const daysByProject = new Map<string, Set<string>>()
  for (const t of traces) {
    const day = t.project_id ? localDay(t.at, tzOffsetMin) : null
    if (!day) continue
    const set = daysByProject.get(t.project_id) ?? new Set<string>()
    set.add(day)
    daysByProject.set(t.project_id, set)
  }

  const liveProject = projects.find(p => p.state === 'live') ?? null

  const rows: MirrorRow[] = []
  for (const p of projects) {
    const days = daysByProject.get(p.id)?.size ?? 0
    const isLive = liveProject?.id === p.id
    if (days === 0 && !isLive) continue
    rows.push({ project_id: p.id, title: p.title, days, is_live: isLive })
  }

  return rows.sort((a, b) => b.days - a.days)
}

/** First day of the month for `date`, at midnight UTC. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
