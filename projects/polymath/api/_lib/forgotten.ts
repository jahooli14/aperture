/**
 * The 'forgotten' spark — the last branch of the stale router (SPEC.md).
 *
 * "Worth a look" (the old ReviewRotation) did three jobs. Two of them the
 * rebuild already does better: "park it" is drift-decay harvesting quietly,
 * and "still mine" only existed to stop the rotation nagging. The third —
 * offering a long-forgotten project back into play — had no home, so this
 * is it.
 *
 * The ordering rule is the whole point, and it's why this doesn't conflict
 * with morphing/compositing. A stale project is one of four things:
 *
 *   stale + recent fragments         -> morph proposal (corpus has something
 *                                       specific to say; say that instead)
 *   stale + shared recurring joint   -> composite proposal (it wants to come
 *                                       back as something else entirely)
 *   stale + drifted + silent         -> drift-decay harvests it, quietly
 *   stale + nothing at all           -> THIS
 *
 * A question is the weakest output the app has, because it asks the user to
 * supply the information rather than supplying any. So it's only correct
 * when the corpus is genuinely empty on that project. Selecting on "longest
 * untouched" alone would be actively worse than nothing: it would grab the
 * projects with the best morph material and ask a vague question about them
 * instead of proposing something concrete.
 *
 * Proposals already outrank the whole spark tier in the attention budget, so
 * no new priority tier is needed — this just has to decline (return null)
 * whenever the corpus has anything at all, and the type rotation moves on.
 */

/** Never offer a project back that hasn't been sitting for at least this long. */
export const FORGOTTEN_MIN_DAYS = 60

/** How long the corpus must have been silent about a project to qualify. */
export const FORGOTTEN_SILENCE_DAYS = 90

/** Don't re-offer the same project for this long after offering it once. */
export const FORGOTTEN_COOLDOWN_DAYS = 21

export interface ForgottenCandidate {
  id: string
  title: string
  /** Most recent of last_active / last_session_ended_at / created_at. */
  last_touched_at: string | null
  state?: string | null
}

export interface ForgottenInputs {
  projects: ForgottenCandidate[]
  /** Project ids with any fragment inside FORGOTTEN_SILENCE_DAYS — the corpus
   *  is NOT silent about these, so they belong to the morph path, not here. */
  projectIdsWithRecentFragments: string[]
  /** Project ids already offered as a 'forgotten' spark inside the cooldown. */
  recentlyOfferedProjectIds: string[]
}

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Number.MAX_SAFE_INTEGER
  const ms = now.getTime() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return Number.MAX_SAFE_INTEGER
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Pure. Returns the single project worth offering back, or null when the
 * right answer is silence — which is most of the time, and is correct.
 */
export function selectForgottenProject(
  inputs: ForgottenInputs,
  now: Date = new Date(),
): { project: ForgottenCandidate; daysUntouched: number } | null {
  const noisy = new Set(inputs.projectIdsWithRecentFragments)
  const onCooldown = new Set(inputs.recentlyOfferedProjectIds)

  const eligible = inputs.projects
    .filter(p => p.state !== 'harvested' && p.state !== 'live')
    .filter(p => !noisy.has(p.id))       // corpus has material -> morph's job
    .filter(p => !onCooldown.has(p.id))  // already asked recently
    .map(p => ({ project: p, daysUntouched: daysSince(p.last_touched_at, now) }))
    .filter(c => c.daysUntouched >= FORGOTTEN_MIN_DAYS)

  if (eligible.length === 0) return null

  // Longest-untouched first, among what's left after the routing filters.
  eligible.sort((a, b) => b.daysUntouched - a.daysUntouched)
  return eligible[0]
}

/** Plain, no analyst voice: state the fact, don't narrate what it means. */
export function forgottenSparkText(title: string, daysUntouched: number): string {
  if (daysUntouched === Number.MAX_SAFE_INTEGER) return `You never started ${title}.`
  const months = Math.floor(daysUntouched / 30)
  if (months >= 12) {
    const years = Math.floor(months / 12)
    return `You set down ${title} over ${years === 1 ? 'a year' : `${years} years`} ago.`
  }
  if (months >= 2) return `You set down ${title} ${months} months ago.`
  return `You set down ${title} ${Math.floor(daysUntouched / 7)} weeks ago.`
}
