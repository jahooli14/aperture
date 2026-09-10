/**
 * Spark type rotation (SPEC.md's mull channel).
 *
 * A spark is not a task -- it's something to carry on a walk and answer by
 * voice in thirty seconds. Two rules govern which type gets baked each
 * night:
 *
 *   1. Never the same type twice running -- habituation kills a spark
 *      type fast, and "noticing" every day stops being noticed.
 *   2. Weight by rolling talk-back rate -- did the user answer, not did
 *      they agree. A type nobody responds to should show up less, and this
 *      is a simple bandit (weighted random over history), not ML.
 *
 * outside_reach is exempt from being crowded out by the weighting: it's
 * the one type that pulls from outside the user's own corpus (reading
 * queue, RSS), and SPEC.md is explicit that it's "not optional" -- a
 * corpus-only system can only recombine the user, so this type needs a
 * floor even if its answer rate lags while the reading bridge is thin.
 */

export const SPARK_TYPES = [
  'noticing',
  // The one type that asks rather than offers: pickGap (session-gap.ts)
  // already works out the single thing the app doesn't know about a
  // project, and it used to be reachable only when you'd sat down to work
  // and it couldn't build a plan. A question is the weakest thing the app
  // can say, so it belongs at the moment you CAN'T work, not the moment
  // you're trying to.
  'gap',
  'transferred_constraint',
  'unfinished_thought',
  'contradiction',
  'scale_jump',
  'material_fact',
  'outside_reach',
  // The last branch of the stale router -- see forgotten.ts. It sits in the
  // normal rotation rather than getting its own priority tier, because its
  // generator declines (returns null) unless the corpus has gone completely
  // silent about a project, and morph/composite proposals already outrank
  // the whole spark tier in the attention budget.
  'forgotten',
] as const

export type SparkType = typeof SPARK_TYPES[number]

export interface SparkHistoryEntry {
  type: SparkType
  answered: boolean
}

/** Every type starts with equal weight; only real history shifts it. */
const BASE_WEIGHT = 1
/** outside_reach's floor. weightFor's formula is BASE_WEIGHT * (0.25 +
 *  rate), which ranges 0.25 (rate 0) to 1.25 (rate 1) -- so this floor
 *  only actually raises the weight when the rolling answer rate drops
 *  below 0.25. Above that, outside_reach is weighted the same as every
 *  other type and the floor is a no-op, which is deliberate: it's a
 *  guarantee against being crowded out entirely, not a boost. */
const MIN_OUTSIDE_REACH_WEIGHT = 0.5

/**
 * Rolling answer rate per type from the last N history entries of that
 * type, defaulting to a neutral 0.5 for a type with no history yet (so an
 * unseen type isn't penalised as if it had already failed).
 */
function answerRateByType(history: SparkHistoryEntry[]): Map<SparkType, number> {
  const rates = new Map<SparkType, number>()
  for (const type of SPARK_TYPES) {
    const entries = history.filter(h => h.type === type)
    if (entries.length === 0) {
      rates.set(type, 0.5)
      continue
    }
    const answered = entries.filter(h => h.answered).length
    rates.set(type, answered / entries.length)
  }
  return rates
}

/** Shared by every picker below, so a change to the weighting formula
 *  can't drift between them the way pickNextSparkType and
 *  highestWeightSparkType used to (each carried its own copy). */
function weightFor(type: SparkType, rates: Map<SparkType, number>): number {
  const rate = rates.get(type) ?? 0.5
  const weight = BASE_WEIGHT * (0.25 + rate) // never fully zero out a type
  return type === 'outside_reach' ? Math.max(weight, MIN_OUTSIDE_REACH_WEIGHT) : weight
}

function candidatePool(history: SparkHistoryEntry[]): SparkType[] {
  const lastType = history[0]?.type ?? null
  const candidates = SPARK_TYPES.filter(t => t !== lastType)
  return candidates.length > 0 ? candidates : [...SPARK_TYPES]
}

/**
 * Picks the next spark type. `history` should be ordered most-recent-first;
 * only history[0] is used for the no-repeat rule, the rest for weighting.
 */
export function pickNextSparkType(history: SparkHistoryEntry[]): SparkType {
  const rates = answerRateByType(history)
  const pool = candidatePool(history)
  const weights = pool.map(type => weightFor(type, rates))

  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/**
 * Deterministic variant for tests and for callers that want the
 * highest-weight type rather than a sampled one (e.g. a preview).
 */
export function highestWeightSparkType(history: SparkHistoryEntry[]): SparkType {
  const rates = answerRateByType(history)
  const pool = candidatePool(history)

  let best = pool[0]
  let bestWeight = -Infinity
  for (const type of pool) {
    const weight = weightFor(type, rates)
    if (weight > bestWeight) {
      bestWeight = weight
      best = type
    }
  }
  return best
}

/**
 * Every candidate type, ranked highest-weight first, for a caller that
 * needs to try more than one before giving up (bakeStandingQuestion's
 * fallback chain).
 *
 * This used to be approximated by trying pickNextSparkType's choice
 * first and then falling back through SPARK_TYPES in fixed declaration
 * order -- which meant the weighting (rule 2: rolling talk-back rate)
 * only ever applied to the FIRST attempt. Whatever came right after
 * 'noticing' in the array above got tried second every single time,
 * regardless of its actual answer rate, and outside_reach/forgotten
 * -- last in the array -- were rarely reached within the attempt cap.
 * Ranking every candidate by the same weight the picks above use keeps
 * the whole fallback chain honouring rule 2, not just its first link.
 */
export function weightedFallbackOrder(history: SparkHistoryEntry[]): SparkType[] {
  const rates = answerRateByType(history)
  const pool = candidatePool(history)
  return [...pool].sort((a, b) => weightFor(b, rates) - weightFor(a, rates))
}
