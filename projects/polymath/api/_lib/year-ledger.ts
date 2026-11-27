/**
 * The year, kept (mirror.ts's older sibling). The mirror is a monthly glance
 * you see once and lose; this is the same days-touched fact laid out over a
 * year so the reward of the loop is something you can go and look at.
 *
 * Still only one number: days you touched something. No streaks, no pace, no
 * zeros for projects you let go. A "comeback" is a day you picked a project
 * up after a long gap, stated as a fact and never as a debt.
 */
import { localDay, type WorkTrace, type ProjectForMirror } from './mirror.js'

export const YEAR_DAYS = 365
/** A gap this long, then a touch, is a coming back. */
export const COMEBACK_GAP_DAYS = 21

export interface YearProject {
  project_id: string
  title: string
  days: number
  first: string
  last: string
}

export interface Comeback {
  project_id: string
  title: string
  /** The day you picked it up again. */
  day: string
  /** Days it had been left. */
  gap: number
}

export interface YearLedger {
  from: string
  to: string
  /** Every distinct day with a trace, oldest first. */
  days: string[]
  projects: YearProject[]
  comebacks: Comeback[]
  busiest_month: { month: string; days: number } | null
}

const DAY_MS = 86_400_000
const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY_MS)

/** First day of the window: the local day a year before `today`, plus one. */
export function windowStart(today: string): string {
  return new Date((dayNumber(today) - (YEAR_DAYS - 1)) * DAY_MS).toISOString().slice(0, 10)
}

export function buildYear(traces: WorkTrace[], projects: ProjectForMirror[], now: Date, tzOffsetMin = 0): YearLedger {
  const to = localDay(now.toISOString(), tzOffsetMin) ?? now.toISOString().slice(0, 10)
  const from = windowStart(to)
  const titles = new Map(projects.map(p => [p.id, p.title]))
  const byProject = new Map<string, Set<string>>()
  const all = new Set<string>()
  for (const t of traces) {
    const day = t.project_id ? localDay(t.at, tzOffsetMin) : null
    if (!day || day < from || day > to || !titles.has(t.project_id)) continue
    all.add(day)
    const set = byProject.get(t.project_id) ?? new Set<string>()
    set.add(day)
    byProject.set(t.project_id, set)
  }

  const rows: YearProject[] = []
  const comebacks: Comeback[] = []
  for (const [id, set] of byProject) {
    const sorted = [...set].sort()
    rows.push({ project_id: id, title: titles.get(id) ?? '', days: sorted.length, first: sorted[0], last: sorted[sorted.length - 1] })
    for (let i = 1; i < sorted.length; i++) {
      const gap = dayNumber(sorted[i]) - dayNumber(sorted[i - 1])
      if (gap >= COMEBACK_GAP_DAYS) comebacks.push({ project_id: id, title: titles.get(id) ?? '', day: sorted[i], gap })
    }
  }

  const perMonth = new Map<string, number>()
  for (const d of all) perMonth.set(d.slice(0, 7), (perMonth.get(d.slice(0, 7)) ?? 0) + 1)
  let busiest: YearLedger['busiest_month'] = null
  for (const [month, days] of perMonth) {
    if (!busiest || days > busiest.days || (days === busiest.days && month > busiest.month)) busiest = { month, days }
  }

  return {
    from, to,
    days: [...all].sort(),
    projects: rows.sort((a, b) => b.days - a.days || a.title.localeCompare(b.title)),
    comebacks: comebacks.sort((a, b) => b.gap - a.gap).slice(0, 3),
    busiest_month: busiest && busiest.days >= 2 ? busiest : null,
  }
}
