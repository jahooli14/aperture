/**
 * Task order — the one invariant every writer of metadata.tasks must keep.
 *
 * The order of steps IS the plan. "Let the piece dry and peel the stencil"
 * above "Cut the stencil" is not a cosmetic problem: the session shaper
 * takes the first open steps in order, so a misordered list is a session
 * spent on the wrong thing. Three writers were each doing their own thing
 * to `order` -- the spine never set it, the close-out appended at the end,
 * the task list renumbered on drag -- so the field was only sometimes
 * present and only sometimes meaningful.
 *
 * Everything here is pure and unit-tested. The rules:
 *   - Every stored task carries a numeric `order`, contiguous from 0.
 *   - Generated steps declare what they come `after`; a stable topological
 *     sort enforces it, so a model that writes the chain backwards or
 *     shuffles two steps still lands in a doable order.
 *   - Something learned at the END of a session ("next: ...") is by
 *     definition the very next thing, so it goes at the front of the open
 *     list, never after the eight steps the spine already planned.
 */

export interface OrderedLike {
  order?: unknown
  done?: unknown
}

/**
 * Sorts by `order` (array position for anything without one), then
 * renumbers so every task has a contiguous integer order. Idempotent.
 */
export function normalizeTaskOrder<T extends OrderedLike>(tasks: T[]): (T & { order: number })[] {
  return tasks
    .map((t, i) => ({ t, key: typeof t.order === 'number' && Number.isFinite(t.order) ? t.order : i, i }))
    .sort((a, b) => (a.key - b.key) || (a.i - b.i))
    .map(({ t }, order) => ({ ...t, order }))
}

/**
 * Inserts new open tasks right after the last finished one -- i.e. at the
 * front of the open list. Used for what a close-out says comes next.
 */
export function insertAfterDone<T extends OrderedLike, U extends OrderedLike>(
  tasks: T[],
  incoming: U[],
): ((T | U) & { order: number })[] {
  const ordered = normalizeTaskOrder(tasks)
  const firstOpen = ordered.findIndex(t => !t.done)
  const at = firstOpen === -1 ? ordered.length : firstOpen
  const next: (T | U)[] = [...ordered.slice(0, at), ...incoming, ...ordered.slice(at)]
  return normalizeTaskOrder(next)
}

export interface SequencedStep {
  /** 1-based positions (as the model numbered them) that must be finished
   *  before this one. Unknown positions, self-references and anything that
   *  would form a cycle are ignored rather than trusted. */
  after?: number[]
}

/**
 * Stable topological sort over `after`. Keeps the model's own order
 * wherever the dependencies allow it, so a list that was already right
 * comes back untouched and a list with one step out of place is fixed
 * with the smallest possible move.
 *
 * Positions refer to the ORIGINAL numbering the model used, which is why
 * the caller passes `position` for each step -- grounding may have dropped
 * some steps, and a dependency on a dropped step simply doesn't apply.
 */
export function orderSteps<T extends SequencedStep>(steps: (T & { position: number })[]): T[] {
  const byPosition = new Map(steps.map(s => [s.position, s]))
  const deps = new Map<number, number[]>()
  for (const s of steps) {
    const wanted = (s.after ?? [])
      .filter((p): p is number => typeof p === 'number' && Number.isInteger(p))
      .filter(p => p !== s.position && byPosition.has(p))
    deps.set(s.position, [...new Set(wanted)])
  }

  const placed = new Set<number>()
  const out: T[] = []
  const remaining = [...steps]

  // Repeatedly take the FIRST remaining step whose prerequisites are all
  // placed. First-eligible (not any-eligible) is what keeps this stable.
  while (remaining.length > 0) {
    const idx = remaining.findIndex(s => (deps.get(s.position) ?? []).every(p => placed.has(p)))
    // A cycle: nothing is eligible. Break it by taking the earliest step
    // as written -- the model's order is the best remaining evidence.
    const pick = idx === -1 ? 0 : idx
    const [step] = remaining.splice(pick, 1)
    placed.add(step.position)
    const { position: _position, ...rest } = step
    out.push(rest as unknown as T)
  }
  return out
}
