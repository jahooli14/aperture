/**
 * The arc — what a finish-oriented project has actually been through,
 * checkpoint by checkpoint.
 *
 * task-spine.ts plans 5-8 steps at a time and replans when the list
 * empties (session-shaper.ts's "an empty plan gets planned" branch). That
 * rolling horizon is the right way to plan -- backwards from a real goal,
 * never inventing a whole project's worth of steps up front -- but it left
 * nothing behind: each replan silently starts a new list, and the record
 * of what the last one actually accomplished was nowhere.
 *
 * The app already asks the right question at exactly the right moment:
 * judgeFinishLine runs every time the open list hits zero, reading the
 * stated finish line against what's actually been done and saying which,
 * in one plain sentence -- grounded, never invented, never a guess. That
 * verdict used to be shown once in the close-out receipt and thrown away.
 * This just keeps it.
 *
 * A repeating project (project-cycles.ts) already has its own version of
 * this -- `metadata.cycle.history` -- because reaching the finish line
 * there means something different (the cycle lands, the next one starts).
 * This is the same idea for everything else: a project with a real,
 * non-repeating finish line. The two are kept separate rather than
 * unified, because cycle.history is live, tested, and shipped, and
 * touching it for this would be a much bigger, riskier change than
 * writing its sibling.
 *
 * Pure. Every function takes metadata and gives metadata back.
 */

export const MILESTONE_HISTORY_LIMIT = 12

export interface Milestone {
  /** Which checkpoint this was: 1 for the first. */
  n: number
  /** ISO, when the list ran out and this got judged. */
  at: string
  /** judgeFinishLine's own verdict -- true only if the finish line as the
   *  user wrote it is now genuinely true. */
  reached: boolean
  /** judgeFinishLine's own plain sentence: what exists now if reached,
   *  what's still missing if not. The one honest "how close am I" signal
   *  this has -- never a fabricated percentage. */
  reason: string
  /** What got finished since the previous checkpoint (or since the start,
   *  for the first one) -- the shape of that stretch of work. */
  steps: string[]
}

/** Null-safe read; defaults to no history for every project that predates
 *  this or was never a milestone project. */
export function readMilestones(metadata: unknown): Milestone[] {
  const raw = (metadata as any)?.milestones
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m: any) => m && typeof m.n === 'number' && typeof m.reason === 'string' && Array.isArray(m.steps))
    .map((m: any) => ({
      n: m.n,
      at: typeof m.at === 'string' ? m.at : new Date().toISOString(),
      reached: m.reached === true,
      reason: m.reason,
      steps: m.steps.filter((s: unknown): s is string => typeof s === 'string'),
    }))
}

/**
 * Appends one checkpoint. `doneTaskTexts` is every task currently marked
 * done on the project, oldest first -- `steps` is worked out as whatever
 * of that the existing history doesn't already cover, so re-running this
 * against the same done list twice (a retried request) doesn't double up
 * the same steps into two checkpoints.
 */
export function appendMilestone(
  metadata: unknown,
  verdict: { reached: boolean; reason: string },
  doneTaskTexts: string[],
  at: Date = new Date(),
): Milestone[] {
  const existing = readMilestones(metadata)
  const covered = existing.reduce((total, m) => total + m.steps.length, 0)
  const steps = doneTaskTexts.slice(covered)
  const next: Milestone = {
    n: existing.length + 1,
    at: at.toISOString(),
    reached: verdict.reached,
    reason: verdict.reason,
    steps,
  }
  return [...existing, next].slice(-MILESTONE_HISTORY_LIMIT)
}
