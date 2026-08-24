/**
 * The mirror (SPEC.md) — the only number the app ever shows: logged
 * execution hours, per project, for the current month.
 *
 * "Zeros shown only for the live project" is the one rule that keeps this
 * from being a guilt wall: a full list of zero-hour projects is an
 * accusation, but "8 hours DJing, 0 on the book" (when the book is what
 * you declared) is the nudge that flips you back.
 */

export interface SessionForMirror {
  project_id: string
  duration_minutes: number | null
}

export interface ProjectForMirror {
  id: string
  title: string
  state?: string | null
}

export interface MirrorRow {
  project_id: string
  title: string
  minutes: number
  is_live: boolean
}

/**
 * Pure aggregation: sessions -> minutes per project for the month, with the
 * live project always included (even at zero) and every other zero-minute
 * project dropped. Rows are sorted by minutes descending so the project
 * that actually got the hours leads.
 */
export function aggregateMonthlyMirror(
  sessions: SessionForMirror[],
  projects: ProjectForMirror[]
): MirrorRow[] {
  const minutesByProject = new Map<string, number>()
  for (const s of sessions) {
    if (!s.project_id || !s.duration_minutes) continue
    minutesByProject.set(s.project_id, (minutesByProject.get(s.project_id) ?? 0) + s.duration_minutes)
  }

  const liveProject = projects.find(p => p.state === 'live') ?? null

  const rows: MirrorRow[] = []
  for (const p of projects) {
    const minutes = minutesByProject.get(p.id) ?? 0
    const isLive = liveProject?.id === p.id
    if (minutes === 0 && !isLive) continue
    rows.push({ project_id: p.id, title: p.title, minutes, is_live: isLive })
  }

  return rows.sort((a, b) => b.minutes - a.minutes)
}

/** First day of the month for `date`, at midnight UTC. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
