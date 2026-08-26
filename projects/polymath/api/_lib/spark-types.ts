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
/** How many of the answers a type has actually not been able to reach */
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

/**
 * Picks the next spark type. `history` should be ordered most-recent-first;
 * only history[0] is used for the no-repeat rule, the rest for weighting.
 */
export function pickNextSparkType(history: SparkHistoryEntry[]): SparkType {
  const lastType = history[0]?.type ?? null
  const rates = answerRateByType(history)

  const candidates = SPARK_TYPES.filter(t => t !== lastType)
  const pool = candidates.length > 0 ? candidates : [...SPARK_TYPES]

  const weights = pool.map(type => {
    const rate = rates.get(type) ?? 0.5
    const weight = BASE_WEIGHT * (0.25 + rate) // never fully zero out a type
    return type === 'outside_reach' ? Math.max(weight, MIN_OUTSIDE_REACH_WEIGHT) : weight
  })

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
  const lastType = history[0]?.type ?? null
  const rates = answerRateByType(history)
  const candidates = SPARK_TYPES.filter(t => t !== lastType)
  const pool = candidates.length > 0 ? candidates : [...SPARK_TYPES]

  let best = pool[0]
  let bestWeight = -Infinity
  for (const type of pool) {
    const rate = rates.get(type) ?? 0.5
    let weight = 0.25 + rate
    if (type === 'outside_reach') weight = Math.max(weight, MIN_OUTSIDE_REACH_WEIGHT)
    if (weight > bestWeight) {
      bestWeight = weight
      best = type
    }
  }
  return best
}
