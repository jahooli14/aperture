/**
 * Which project should today's spark be about?
 *
 * Two rules, pulling against each other on purpose.
 *
 * FOLLOW THE MOMENTUM. If there's been real movement on something this
 * week -- captures about it, a session on it, notes that keep landing --
 * that's what's live in your head, and a question about it gets a real
 * answer because you're already thinking about it. Asking about a project
 * you haven't touched since spring mostly gets a shrug.
 *
 * BUT NOT ALWAYS. A spark that only ever follows momentum is a feedback
 * loop: the loud project gets louder, everything else goes quiet and stops
 * being able to spark anything. So every few sparks, deliberately ask
 * about something else -- not the deadest thing on the shelf, but
 * something with a pulse that isn't currently winning.
 *
 * The deviation is derived, not stored: if the last few sparks were all
 * about projects that are currently near the top, the next one deviates.
 * That needs no new column and no random number, and it self-corrects --
 * a week where momentum genuinely moves around produces no forced
 * deviation at all, because the recent subjects already vary.
 *
 * Pure and unit-tested, the same way spark-types.ts keeps the type
 * rotation testable without a database.
 */

/** How many recent sparks all landing on high-momentum projects before one
 *  is deliberately spent elsewhere. Three is roughly twice a fortnight at
 *  one spark a day -- enough that the shelf gets aired, rare enough that
 *  the app doesn't feel like it's ignoring what you're actually doing. */
export const DEVIATE_AFTER = 3

/** Ceiling on how many projects count as "what's in motion" at once. */
export const MOMENTUM_TIER_MAX = 3

/**
 * How big the in-motion tier actually is for a shelf of this size.
 *
 * A fixed three is wrong on a small shelf: with four projects it makes
 * everything except the coldest one "in motion", so the deviation is
 * forced to land on whatever is nearest dead -- exactly the opposite of
 * "something with a pulse that isn't currently winning". Scaling it means
 * there is always a real middle to deviate into.
 */
export function momentumTierSize(shelfSize: number): number {
  return Math.max(1, Math.min(MOMENTUM_TIER_MAX, Math.ceil(shelfSize / 3)))
}

export interface SubjectCandidate {
  id: string
  title: string
  /** Captures that landed on this project in the last week or so. The
   *  strongest signal there is: it means you were thinking about it
   *  unprompted. */
  recentFragments: number
  /** Sessions actually worked on it recently. */
  recentSessions: number
  /** Most recent real activity, ISO. Used as the tiebreak, and as the only
   *  signal at all for a project with no captures. */
  lastTouchedAt: string | null
}

export interface SubjectChoice {
  project: SubjectCandidate
  /** True when this was picked to break a run of momentum picks rather
   *  than because it's what's hot. Worth knowing at the call site: a
   *  deviation can be framed differently ("something else for a change"). */
  deviation: boolean
}

/**
 * Higher is more live. Captures count for more than sessions because they
 * happen unprompted -- a session can be the app's idea, a voice note in
 * the car is entirely yours.
 */
export function momentumScore(c: SubjectCandidate, now: Date = new Date()): number {
  const days = c.lastTouchedAt
    ? (now.getTime() - new Date(c.lastTouchedAt).getTime()) / 86_400_000
    : 999
  // Recency decays over about a fortnight, then stops mattering: at that
  // point the project is cold and the fragments are what's left.
  const recency = Number.isFinite(days) ? Math.max(0, 1 - days / 14) : 0
  return c.recentFragments * 3 + c.recentSessions * 2 + recency * 2
}

export function rankBySubjectMomentum(
  candidates: SubjectCandidate[],
  now: Date = new Date(),
): SubjectCandidate[] {
  return [...candidates].sort((a, b) => {
    const diff = momentumScore(b, now) - momentumScore(a, now)
    if (diff !== 0) return diff
    return a.title.localeCompare(b.title)
  })
}

/**
 * Null when there's nothing to ask about at all.
 *
 * `recentSubjectIds` is most-recent-first, and drives both rules: the
 * immediately-previous subject is never repeated, and a run of
 * high-momentum subjects forces the next one outside that tier.
 */
export function pickSparkSubject(
  candidates: SubjectCandidate[],
  recentSubjectIds: string[] = [],
  now: Date = new Date(),
): SubjectChoice | null {
  if (candidates.length === 0) return null
  const ranked = rankBySubjectMomentum(candidates, now)
  if (ranked.length === 1) return { project: ranked[0], deviation: false }

  // Never the same subject twice running. Only the immediately-previous
  // one is blocked outright -- a longer hard cooldown would starve a shelf
  // of three projects, and the deviation rule below already spreads things
  // out on a bigger shelf.
  const justAsked = recentSubjectIds[0]
  const eligible = ranked.filter(p => p.id !== justAsked)
  if (eligible.length === 0) return { project: ranked[0], deviation: false }

  const topTier = new Set(ranked.slice(0, momentumTierSize(ranked.length)).map(p => p.id))
  const lastFew = recentSubjectIds.slice(0, DEVIATE_AFTER)
  const owed = lastFew.length >= DEVIATE_AFTER && lastFew.every(id => topTier.has(id))

  if (owed) {
    // Something with a pulse that isn't currently winning -- the best of
    // what's outside the top tier, not the deadest thing on the shelf.
    // (Reviving a genuinely abandoned project is the 'forgotten' type's
    // job, and it has its own much longer cooldown for good reason.)
    const outside = eligible.find(p => !topTier.has(p.id))
    if (outside) return { project: outside, deviation: true }
  }

  return { project: eligible[0], deviation: false }
}
