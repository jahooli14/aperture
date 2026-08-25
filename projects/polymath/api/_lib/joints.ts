/**
 * Joint mining (SPEC.md's composite mechanism).
 *
 * A joint is something the user has said more than once that applies
 * across projects -- "contrast between clean and raw." The current
 * crossover generator goes pair -> link: hand the model two projects and
 * it must invent a bridge, so it always does, which is where forced
 * mashups come from. This inverts it to joint -> pair: find what recurs
 * in the corpus FIRST, quoted, then ask which two projects it applies to.
 *
 * Finding "what recurs" is pure vector clustering (greedy, not k-means --
 * a handful of recurring themes is expected, not a fixed cluster count),
 * so it's unit-testable with fake embeddings and needs no model call.
 * Turning a cluster into a single quoted joint sentence is a separate,
 * IO-bound step (joints.ts's IO wrapper, not here) precisely so the
 * clustering logic itself can be verified without hitting Gemini.
 */

import { cosineSimilarity } from './gemini-embeddings.js'

const RECURRENCE_SIM_THRESHOLD = 0.72
const MIN_OCCURRENCES = 2

export interface FragmentForClustering {
  id: string
  text: string
  embedding: number[]
}

export interface JointCandidate {
  fragmentIds: string[]
  texts: string[]
}

/**
 * Greedy single-link clustering: each fragment either joins the first
 * existing cluster it's similar enough to, or starts a new one. Only
 * clusters that reach MIN_OCCURRENCES are returned -- a thing said once
 * is a coincidence, not a joint, per SPEC.md ("the joint is quoted and
 * has recurred").
 */
export function findRecurringThemes(fragments: FragmentForClustering[]): JointCandidate[] {
  const clusters: { fragmentIds: string[]; texts: string[]; embeddings: number[][] }[] = []

  for (const fragment of fragments) {
    if (!fragment.embedding || fragment.embedding.length === 0) continue

    let joined = false
    for (const cluster of clusters) {
      const matchesAny = cluster.embeddings.some(
        e => cosineSimilarity(fragment.embedding, e) >= RECURRENCE_SIM_THRESHOLD
      )
      if (matchesAny) {
        cluster.fragmentIds.push(fragment.id)
        cluster.texts.push(fragment.text)
        cluster.embeddings.push(fragment.embedding)
        joined = true
        break
      }
    }
    if (!joined) {
      clusters.push({ fragmentIds: [fragment.id], texts: [fragment.text], embeddings: [fragment.embedding] })
    }
  }

  return clusters
    .filter(c => c.fragmentIds.length >= MIN_OCCURRENCES)
    .map(c => ({ fragmentIds: c.fragmentIds, texts: c.texts }))
}
