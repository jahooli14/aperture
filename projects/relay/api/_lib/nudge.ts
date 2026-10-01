/**
 * Nudging by hand. Pure — no IO, so the rules are unit tested and the story
 * route can tell the client whether the button should show at all.
 *
 * The rule is one nudge per turn, and once a day after that if the turn sits.
 * A nudge is a tap on the shoulder; ten of them is someone shouting. The
 * stamp is the same `last_nudge_at` the daily cron writes, so a hand nudge
 * and the automatic one never land on the same person back to back.
 */
import { whoseTurn, type RotationMember, type TurnMode } from './turns.js'

export const NUDGE_AGAIN_AFTER_MS = 24 * 60 * 60_000

/** Who a nudge from `userId` would reach. Empty means there's no one to nudge. */
export function nudgeRecipients(opts: {
  mode: TurnMode
  members: RotationMember[]
  nextAuthorId: string | null
  lastAuthorId: string | null
  userId: string
}): string[] {
  if (opts.members.length < 2) return []

  if (opts.mode === 'rotation') {
    const up = whoseTurn(opts)
    return up && up !== opts.userId ? [up] : []
  }

  // Open: anyone but the last writer could go. Only the last writer is stuck
  // waiting, so only they get the button; it reaches everyone else.
  if (opts.lastAuthorId !== opts.userId) return []
  return opts.members.map((m) => m.user_id).filter((id) => id !== opts.userId)
}

/** Whether a nudge is allowed now, given when the last line and nudge were. */
export function nudgeAllowed(opts: {
  lastLineAt: string | null
  lastNudgeAt: string | null
  now: string
}): boolean {
  if (!opts.lastNudgeAt) return true
  const nudged = Date.parse(opts.lastNudgeAt)
  // A line since the last nudge means a new turn, so it gets its own nudge.
  if (opts.lastLineAt && Date.parse(opts.lastLineAt) > nudged) return true
  return Date.parse(opts.now) - nudged >= NUDGE_AGAIN_AFTER_MS
}
