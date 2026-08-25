/**
 * Whose turn it is. Pure — no IO, so it can be unit tested and reused by the
 * client to render the composer without a round trip.
 *
 * Two modes, because two people and ten people want different things:
 *   rotation — a strict queue. Right for a pair; the story keeps its rhythm.
 *   open     — anyone except whoever wrote the last line. Right for a group,
 *              where a strict queue stalls the moment one person goes away.
 */
export type TurnMode = 'rotation' | 'open'

export interface RotationMember {
  user_id: string
  turn_order: number
}

function byOrder(members: RotationMember[]): RotationMember[] {
  return [...members].sort((a, b) => a.turn_order - b.turn_order)
}

/** The member after `afterUserId` in the queue, wrapping at the end. */
export function nextInRotation(members: RotationMember[], afterUserId: string | null): string | null {
  const ordered = byOrder(members)
  if (ordered.length === 0) return null

  const current = ordered.find((m) => m.user_id === afterUserId)
  if (!current) return ordered[0].user_id

  const after = ordered.find((m) => m.turn_order > current.turn_order)
  return (after ?? ordered[0]).user_id
}

/**
 * Who is up right now. Returns null in open mode, where "up" is everyone
 * except the last writer rather than one named person.
 *
 * `nextAuthorId` is the stored value; it can go stale if that person leaves,
 * so a value that no longer matches a member falls back to the top of the queue
 * rather than freezing the story.
 */
export function whoseTurn(opts: {
  mode: TurnMode
  members: RotationMember[]
  nextAuthorId: string | null
}): string | null {
  if (opts.mode === 'open') return null
  const ordered = byOrder(opts.members)
  if (ordered.length === 0) return null

  const stored = ordered.find((m) => m.user_id === opts.nextAuthorId)
  return stored ? stored.user_id : ordered[0].user_id
}

/** Whether this user may add the next line. Non-members always get false. */
export function canWrite(opts: {
  mode: TurnMode
  members: RotationMember[]
  nextAuthorId: string | null
  lastAuthorId: string | null
  userId: string
}): boolean {
  const isMember = opts.members.some((m) => m.user_id === opts.userId)
  if (!isMember) return false

  // A story with one member is one you haven't invited anyone to yet. Let the
  // owner get it started rather than blocking on a turn that can't come round.
  if (opts.members.length < 2) return true

  if (opts.mode === 'open') return opts.lastAuthorId !== opts.userId

  return whoseTurn(opts) === opts.userId
}
