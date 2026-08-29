/**
 * Streaks, and the local-time arithmetic the 6pm nudge needs.
 *
 * The streak itself is counted in UTC calendar days — the same day boundary
 * `created_at` already uses everywhere else in the app. That's a deliberate
 * simplification: Dan and Ben could in principle be in different timezones,
 * and a streak that read differently depending who's looking at it would be
 * worse than one that's a few hours off at the boundary. Both of them see the
 * same number.
 *
 * The 6pm-local nudge is a different concern — a personal reminder time, not
 * the source of truth for the streak — so it's computed separately per
 * member from their own saved timezone.
 */

const DAY_MS = 86_400_000

function utcDayKey(iso: string): string {
  return iso.slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS)
}

export interface StreakInfo {
  /** Consecutive UTC days up to and including today (or yesterday, if today
   *  has nothing yet — the streak isn't broken until a full day passes with
   *  no line). Zero once a day has been skipped entirely. */
  current: number
  /** The longest run the story has ever had, including the current one. */
  longest: number
  /** Whether a line has already landed today (UTC) — nothing to protect if so. */
  activeToday: boolean
}

/**
 * `now` defaults to the real time; tests pin it. Timestamps need not be
 * sorted or deduplicated — both are handled here.
 */
export function computeStreak(lineTimestamps: string[], now: string = new Date().toISOString()): StreakInfo {
  const days = [...new Set(lineTimestamps.map(utcDayKey))].sort()
  const today = utcDayKey(now)

  if (days.length === 0) return { current: 0, longest: 0, activeToday: false }

  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }

  const lastDay = days[days.length - 1]
  const gapToToday = daysBetween(lastDay, today)

  // gapToToday: 0 = wrote today, 1 = wrote yesterday (streak still alive,
  // today just hasn't happened yet), 2+ = a full day was skipped.
  let current: number
  if (gapToToday >= 2) {
    current = 0
  } else {
    run = 1
    for (let i = days.length - 1; i > 0; i--) {
      if (daysBetween(days[i - 1], days[i]) === 1) run++
      else break
    }
    current = run
  }

  return { current, longest, activeToday: gapToToday === 0 }
}

/** The hour (0-23) it currently is in `timeZone`, for deciding when to nudge. */
export function localHour(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(hour)
}

/** The calendar date (YYYY-MM-DD) in `timeZone`, for "already nudged today". */
export function localDateKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
