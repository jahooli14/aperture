/**
 * Shared time-estimate vocabulary.
 *
 * An estimate is a property of the TASK ("mixing the outro takes about 20
 * minutes whenever you do it") — set once, at the moment a task is created
 * (by the spine, the first-cut generator, or a session), persisted onto
 * metadata.tasks, and reused. It rides along in the SAME generation call
 * that writes the task's text, rather than a separate round-trip per task
 * or per plan — there's no reason "what is this" and "how long is this"
 * should cost two model calls when one prompt answers both.
 *
 * This file is just the vocabulary both callers share: the fixed ladder
 * (so an AI guess and a hand-set estimate in TaskList.tsx never disagree
 * about what the unit of measurement even is) and the sanitizer that snaps
 * a model's raw number onto it.
 */

export const ESTIMATE_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const
export type EstimateMinutes = (typeof ESTIMATE_MINUTES)[number]

export function nearestEstimate(minutes: number): EstimateMinutes {
  return ESTIMATE_MINUTES.reduce((best, m) =>
    Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best,
  )
}

/** A task with no stored estimate yet needs SOME number to plan a budget
 *  against. 20 minutes is the middle of the ladder -- neither optimistic
 *  nor pessimistic, and wrong in a way that's cheap to correct once the
 *  task is actually estimated at its next generation or replan. */
export const DEFAULT_ESTIMATE_MINUTES: EstimateMinutes = 20

/**
 * A task that was in the plan, wasn't ticked, and the session ran its full
 * window anyway is real evidence the estimate was too low -- cheap to act
 * on without a model call, since the ladder is small and the direction is
 * always "it took longer than guessed", never the other way (nobody
 * reports a task as suspiciously fast by not finishing it).
 */
export function bumpEstimate(minutes: EstimateMinutes): EstimateMinutes {
  const i = ESTIMATE_MINUTES.indexOf(minutes)
  return i === -1 || i === ESTIMATE_MINUTES.length - 1 ? minutes : ESTIMATE_MINUTES[i + 1]
}
