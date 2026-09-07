/**
 * Pure reordering for the project's task list.
 *
 * "The order of `metadata.tasks` is the plan" (CLAUDE.md) — the session
 * takes the top open steps in that order. So a drag inside one phase has to
 * be exactly that: a permutation of those items among the positions they
 * already hold, leaving every other step where it was.
 */

import type { Task } from '../../types'

const orderOf = (t: Task) => (typeof t.order === 'number' ? t.order : 0)

/**
 * Move `draggedId` to `targetId`'s position among the open tasks of one
 * phase, and renumber `order` contiguously across the whole list.
 *
 * Returns null when the move isn't a legal one (same task, missing task,
 * different phases, or either one already done) so the caller can bail
 * without writing.
 *
 * The old version rebuilt the list as `[...everythingElse, ...thisPhase]`
 * before renumbering, so dragging one step inside "Break the Ice" shunted
 * the entire phase to the END of the global order — quietly rewriting what
 * the next session would open with, from a gesture that was only ever
 * meant to swap two neighbours.
 */
export function reorderWithinPhase(
  tasks: Task[],
  draggedId: string,
  targetId: string,
  phaseOf: (t: Task) => string,
): Task[] | null {
  if (draggedId === targetId) return null
  const dragged = tasks.find(t => t.id === draggedId)
  const target = tasks.find(t => t.id === targetId)
  if (!dragged || !target) return null
  if (phaseOf(dragged) !== phaseOf(target)) return null
  if (dragged.done || target.done) return null

  const phase = phaseOf(dragged)
  const inPhase = (t: Task) => phaseOf(t) === phase && !t.done

  // The list as it actually stands, and the positions this phase's open
  // tasks occupy inside it.
  const sorted = [...tasks].sort((a, b) => orderOf(a) - orderOf(b))
  const slots: number[] = []
  sorted.forEach((t, i) => { if (inPhase(t)) slots.push(i) })

  const moving = slots.map(i => sorted[i])
  const fromIdx = moving.findIndex(t => t.id === draggedId)
  const toIdx = moving.findIndex(t => t.id === targetId)
  if (fromIdx === -1 || toIdx === -1) return null

  const [moved] = moving.splice(fromIdx, 1)
  moving.splice(toIdx, 0, moved)

  // Same slots, new occupants. Nothing outside the phase shifts.
  const next = [...sorted]
  slots.forEach((slot, k) => { next[slot] = moving[k] })
  return next.map((t, i) => ({ ...t, order: i }))
}
