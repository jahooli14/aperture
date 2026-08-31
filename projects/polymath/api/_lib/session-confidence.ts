/**
 * How well does the app actually know this project?
 *
 * Grounding started out binary: cite it or drop it. That stopped the
 * fabrication, but it treated a project with a written finish line, a
 * history of close-outs and half its tasks ticked off exactly the same as
 * one the user has never said a word about. On the first, "the intro's
 * done and the goal is a finished mix, so the transition is next" is
 * reading the evidence. On the second, the same sentence is invention.
 *
 * So: score what's actually on the record, and let the score decide how
 * far the app may reason -- never what it may claim. The specifics gate in
 * session-grounding.ts does not move at any tier. Confidence buys
 * inference BETWEEN known things; it never buys new things.
 *
 * Pure and synchronous, like session-shapes.ts, because a wrong answer
 * here changes what the user is told at the top of a rare hour.
 */

export type Confidence = 'thin' | 'partial' | 'known'

export interface ConfidenceInput {
  /** metadata.end_goal -- what done looks like, in the user's words. */
  endGoal: string | null
  /** metadata.end_goal_source -- set when a person wrote or confirmed it. */
  endGoalSource: string | null
  /** projects.last_closeout_text + last_session_ended_at. */
  lastCloseout: string | null
  lastSessionEndedAt: string | null
  /** Previous sessions that actually moved, from the sessions table. */
  movedSessionCount: number
  /** metadata.tasks, split. A done task with a timestamp is real motion. */
  doneTaskCount: number
  openTaskCount: number
  /** fragments attached in the last 90 days. */
  recentFragmentCount: number
  /** Turns the USER took in the project's shaping chat (metadata.conversation). */
  shapingChatTurns: number
}

/** Older than this and a close-out stops being a reliable "where I am". */
const STALE_CLOSEOUT_DAYS = 45

export function confidenceScore(input: ConfidenceInput, now: Date = new Date()): number {
  let score = 0

  // A finish line is the single most useful thing to reason backwards from,
  // and worth more when a person wrote it rather than a model guessing.
  if (input.endGoal?.trim()) score += input.endGoalSource ? 2 : 1

  if (input.lastCloseout?.trim()) {
    const endedAt = input.lastSessionEndedAt ? new Date(input.lastSessionEndedAt) : null
    const days = endedAt ? (now.getTime() - endedAt.getTime()) / 86_400_000 : Infinity
    score += days <= STALE_CLOSEOUT_DAYS ? 2 : 1
  }

  score += Math.min(input.movedSessionCount, 2)

  // Motion, not just intent: something finished AND something still open is
  // a project in flight. Only open tasks is a list, not a history.
  if (input.doneTaskCount > 0 && input.openTaskCount > 0) score += 2
  else if (input.openTaskCount > 0) score += 1

  if (input.recentFragmentCount >= 3) score += 2
  else if (input.recentFragmentCount > 0) score += 1

  if (input.shapingChatTurns >= 4) score += 1

  return score
}

export function confidenceFor(input: ConfidenceInput, now?: Date): Confidence {
  const score = confidenceScore(input, now)
  if (score >= 6) return 'known'
  if (score >= 3) return 'partial'
  return 'thin'
}

/**
 * What the model is allowed to do at each tier. Reads as prompt text
 * because that's where it's used, but it lives here so the rule and the
 * score that selects it stay in one file.
 */
export function reasoningLicence(confidence: Confidence): string {
  if (confidence === 'known') {
    return `You know this project well. You may join two pieces of evidence into one
move, and you may reason backwards from the finish line — "the goal is X,
Y is already done, so Z is what's left". Cite every id you used.`
  }
  if (confidence === 'partial') {
    return `You know some of this project. One step from one piece of evidence at a
time. Do not chain them together into a conclusion about where the
project is overall — you don't have enough to know that.`
  }
  return `You barely know this project. Only moves that would be true of any
project ("open it and look at where you left it") are allowed. Do not
name anything specific at all.`
}
