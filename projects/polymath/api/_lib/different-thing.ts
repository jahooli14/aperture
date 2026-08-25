/**
 * The different-thing quota (SPEC.md).
 *
 * One hour a month on something the user wouldn't usually do. Encouragement,
 * never a debt: it doesn't roll over, and a miss is never mentioned -- so
 * this module only ever answers "has it happened this month," never
 * "you missed it" or "you're overdue." The caller (AttentionSlot) is what
 * decides whether and when to nudge; this stays pure so the month-boundary
 * logic is testable without a database.
 */

export interface SessionForQuota {
  source: string
  started_at: string
}

export function isDifferentThingDoneThisMonth(
  sessions: SessionForQuota[],
  now: Date = new Date()
): boolean {
  const monthKey = now.toISOString().slice(0, 7)
  return sessions.some(s => s.source === 'different-thing' && s.started_at.slice(0, 7) === monthKey)
}

/**
 * The nudge only appears in the back half of the month, and only once
 * nothing else (a spark, above it in the attention-budget priority order)
 * has anything to say. Early-month silence isn't a miss -- there's still
 * time -- so nudging on day 3 would just be noise with a guilt edge.
 */
export const DIFFERENT_THING_NUDGE_DAY = 20

export function shouldNudgeDifferentThing(done: boolean, now: Date = new Date()): boolean {
  if (done) return false
  return now.getUTCDate() >= DIFFERENT_THING_NUDGE_DAY
}
