/** The year as a grid: one cell a day, a column a week, weeks start Monday. */
export interface GridCell { day: string | null; on: boolean }

const DAY_MS = 86_400_000
const num = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY_MS)
const iso = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10)

/** Cells in reading order for a 7-row column-first grid. Blank cells pad the
 *  first week (before `from`) and the last (after `to`). */
export function yearGrid(days: string[], from: string, to: string): GridCell[] {
  const on = new Set(days)
  const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  const cells: GridCell[] = Array.from({ length: lead }, () => ({ day: null, on: false }))
  for (let n = num(from); n <= num(to); n++) { const day = iso(n); cells.push({ day, on: on.has(day) }) }
  while (cells.length % 7) cells.push({ day: null, on: false })
  return cells
}

/** "3 Oct" for a day string. */
export function shortDay(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function monthName(m: string): string {
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
}
