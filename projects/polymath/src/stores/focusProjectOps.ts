/**
 * Which project the home answer card is showing — pure, so both the card
 * and "everything else" can agree on it and it can be tested without a
 * store or a render.
 *
 * It lives in its own module rather than in useProjectStore because that
 * store reaches the API client, which reads Supabase's build-time
 * constants and so can't be imported under vitest at all. Same split, and
 * same reason, as reviewRotationOps.
 */

import type { Project } from '../types'

/** A project you could actually sit down to: live enough to work on, and
 *  shaped enough to have a plan. An unshaped capture is neither. */
export const isActiveShaped = (p: { status?: string; metadata?: { is_shaped?: boolean } }) =>
  ['active', 'upcoming'].includes(p.status ?? '') && p.metadata?.is_shaped !== false

export const byRecency = (a: Project, b: Project) => {
  const aTime = new Date(a.last_active || a.updated_at || 0).getTime()
  const bTime = new Date(b.last_active || b.updated_at || 0).getTime()
  return bTime - aTime
}

/** Active, shaped projects minus one, most-recently-touched first. Keeps
 *  queued projects: something you just worked on is "warm" even if it also
 *  sits in Up Next, and it drops out of the queue row instead. */
export const recentExcluding = (projects: Project[], excludeId?: string | null): Project[] =>
  projects.filter(isActiveShaped).filter(p => p.id !== excludeId).sort(byRecency)

/**
 * The focus chain: an override, then a session booked for today, then a
 * declared-live project, then the star, then whatever was touched last.
 *
 * This exists in one place because two surfaces have to agree on it, and
 * for a while they didn't. The card resolved this whole chain while
 * "everything else" only ever excluded the STAR — so any time the card was
 * showing something else, which is every ▶ tap on a mini card (that sets
 * an override rather than re-starring), the same project appeared twice on
 * the home screen at once.
 *
 * One definition also gets the swap for free: playing a card in the row
 * makes it the focus, so it leaves the row, and whatever was focused
 * before stops being excluded and takes its place.
 */
export function resolveFocusProjectId(
  projects: Project[],
  overrideProjectId?: string | null,
): string | null {
  const eligible = projects.filter(isActiveShaped)

  const override = overrideProjectId ? eligible.find(p => p.id === overrideProjectId) : undefined
  if (override) return override.id

  // A session booked for today is the most explicit statement of intent
  // there is about what today is for, so it outranks the star.
  const today = new Date().toISOString().slice(0, 10)
  const booked = eligible.find(
    p => p.booked_session_at?.slice(0, 10) === today && p.state !== 'harvested',
  )
  if (booked) return booked.id

  const live = eligible.find(p => p.state === 'live')
  if (live) return live.id

  const priority = eligible.find(p => p.is_priority)
  if (priority) return priority.id

  // Nothing starred, booked or live: whatever was touched last. Nothing to
  // exclude here — a star would have returned above, and excluding the
  // focus itself would be circular.
  return recentExcluding(projects)[0]?.id ?? null
}
