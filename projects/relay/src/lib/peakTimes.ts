/**
 * When the two of you actually write, bucketed into a day x time-of-day grid.
 *
 * Read in the viewer's own local time — "when do we write" is a question
 * about the reader's clock, not a fixed reference zone, and this is a display
 * aid rather than something the streak or the turn logic depends on.
 */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const BANDS = ['Night', 'Morning', 'Afternoon', 'Evening'] as const

const BAND_LABELS_LONG = ['night', 'morning', 'afternoon', 'evening'] as const

function bandOf(hour: number): number {
  return Math.floor(hour / 6)
}

function dayIndexMondayFirst(jsDay: number): number {
  return (jsDay + 6) % 7
}

/** grid[day][band] = line count, day 0 = Monday, band 0 = midnight-6am. */
export function bucketByPeakTime(timestamps: string[]): number[][] {
  const grid = DAYS.map(() => BANDS.map(() => 0))
  for (const iso of timestamps) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) continue
    grid[dayIndexMondayFirst(date.getDay())][bandOf(date.getHours())]++
  }
  return grid
}

/** One plain sentence naming the single busiest slot, or null with too little data. */
export function describePeak(grid: number[][]): string | null {
  const total = grid.flat().reduce((sum, n) => sum + n, 0)
  if (total < 6) return null

  let best = { day: 0, band: 0, count: -1 }
  for (let day = 0; day < grid.length; day++) {
    for (let band = 0; band < grid[day].length; band++) {
      if (grid[day][band] > best.count) best = { day, band, count: grid[day][band] }
    }
  }
  if (best.count === 0) return null

  return `Most lines land on ${DAYS_LONG[best.day]} ${BAND_LABELS_LONG[best.band]}s.`
}

const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
