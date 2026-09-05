/**
 * Which two projects should the polymath spark try to bridge?
 *
 * `transferred_constraint` imports a rule that's visible in one project's
 * captures and asks whether it holds in another. It was picking any two
 * projects that happened to have recent fragments, which quietly wastes
 * the mechanism: two music projects share so much context that "does this
 * apply over there?" is nearly always yes, and nearly always obvious.
 *
 * The value is in the opposite pair. A rule carried from woodwork into a
 * song has to be re-derived to survive the trip, and what comes out the
 * other side is a move nobody working only in music would have made. That
 * is the middle of the Venn diagram, and it is the one part of the output
 * that is genuinely the user's rather than the discipline's.
 *
 * So: prefer pairs whose labels DON'T overlap. `metadata.tags`
 * (project-tags.ts) is already the vocabulary for this, already derived
 * from what the user actually has, and already read by the idea
 * generator's seed picker.
 *
 * Deliberately the inverse of how the app orders things elsewhere:
 * resurfacing a project prefers a SHARED label, because there the job is
 * to hand you a building block for what's already in motion. Here the job
 * is to hand you something you'd never have reached for. Same field,
 * opposite sign, for two different reasons.
 *
 * Pure and unit-tested: no model call decides the pairing, because a model
 * asked to pick "an interesting pair" reliably picks the safe one.
 */

export interface CrossingProject {
  id: string
  title: string
  /** metadata.tags -- normalised labels, may be empty. */
  tags: string[]
  /** How many recent captures this project has, i.e. how much there is to
   *  actually import a rule FROM. */
  fragmentCount: number
}

export interface CrossingPair {
  /** The project a rule is visible in -- the one with material to draw on. */
  from: CrossingProject
  /** The project the rule is being carried into. This is the one the spark
   *  is about, and the one the rotation records. */
  to: CrossingProject
  /** True when the two share no label at all -- the pair worth having. */
  crossesDisciplines: boolean
  /** Labels the two have in common, for the prompt to be honest about how
   *  far the jump actually is. */
  sharedTags: string[]
}

function overlap(a: string[], b: string[]): string[] {
  const set = new Set(a.map(t => t.toLowerCase()))
  return [...new Set(b.filter(t => set.has(t.toLowerCase())))]
}

/**
 * Every ordered pair, best first. "Best" is: crosses disciplines, then has
 * the most material to import a rule from, then is least recently sparked
 * (the caller filters those out entirely, so this is just a tiebreak on
 * what's left).
 *
 * Ordered, not unordered: importing woodwork's rule into the song is a
 * different question from importing the song's rule into the shelf, and
 * which direction is worth asking depends on which side has the material.
 */
export function rankCrossingPairs(projects: CrossingProject[]): CrossingPair[] {
  const pairs: CrossingPair[] = []
  for (const from of projects) {
    // Nothing captured about it means no rule to carry out of it.
    if (from.fragmentCount === 0) continue
    for (const to of projects) {
      if (to.id === from.id) continue
      const sharedTags = overlap(from.tags, to.tags)
      pairs.push({
        from,
        to,
        // Untagged projects count as crossing: the app doesn't know they're
        // adjacent, and assuming they are would silently re-create exactly
        // the safe, same-discipline pairing this exists to avoid.
        crossesDisciplines: sharedTags.length === 0,
        sharedTags,
      })
    }
  }
  return pairs.sort((a, b) => {
    if (a.crossesDisciplines !== b.crossesDisciplines) return a.crossesDisciplines ? -1 : 1
    if (a.sharedTags.length !== b.sharedTags.length) return a.sharedTags.length - b.sharedTags.length
    return b.from.fragmentCount - a.from.fragmentCount
  })
}

/**
 * Null when there aren't two projects to work with, or when everything
 * left is on cooldown. Null is a real answer: the type rotation moves on
 * and nobody gets a forced connection.
 */
export function pickCrossingPair(
  projects: CrossingProject[],
  recentlySparkedProjectIds: string[] = [],
): CrossingPair | null {
  const onCooldown = new Set(recentlySparkedProjectIds)
  const ranked = rankCrossingPairs(projects)
  // The cooldown applies to the project being carried INTO, since that's
  // the one the spark is about and the one the user is asked to think
  // about. A project can keep supplying rules to others without becoming
  // the subject twice in a row.
  return ranked.find(p => !onCooldown.has(p.to.id)) ?? null
}
