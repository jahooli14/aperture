import { describe, it, expect } from 'vitest'
import { reorderWithinPhase } from './projectPathOps'
import type { Task } from '../../types'

const task = (id: string, order: number, phase = 'core', done = false): Task =>
  ({ id, text: id, order, done, task_type: phase } as Task)

const phaseOf = (t: Task) => (t as any).task_type || 'core'
const ids = (ts: Task[] | null) => (ts ?? []).map(t => t.id)

describe('reorderWithinPhase', () => {
  // The order of metadata.tasks IS the plan, so a drag inside one phase
  // must not move anything outside it.
  const list = [
    task('ice1', 0, 'ignition'),
    task('ice2', 1, 'ignition'),
    task('core1', 2, 'core'),
    task('core2', 3, 'core'),
    task('wrap1', 4, 'shutdown'),
  ]

  it('swaps two neighbours and leaves every other step exactly where it was', () => {
    const next = reorderWithinPhase(list, 'ice2', 'ice1', phaseOf)
    expect(ids(next)).toEqual(['ice2', 'ice1', 'core1', 'core2', 'wrap1'])
  })

  it('does not shunt the whole phase to the end of the plan', () => {
    // The bug: rebuilding as [...everythingElse, ...thisPhase] moved both
    // ignition steps behind every core and shutdown step, so the next
    // session opened with something else entirely.
    const next = reorderWithinPhase(list, 'ice2', 'ice1', phaseOf)
    expect(ids(next)!.indexOf('ice1')).toBeLessThan(ids(next)!.indexOf('core1'))
  })

  it('reorders a later phase without disturbing an earlier one', () => {
    const next = reorderWithinPhase(list, 'core2', 'core1', phaseOf)
    expect(ids(next)).toEqual(['ice1', 'ice2', 'core2', 'core1', 'wrap1'])
  })

  it('renumbers order contiguously from zero', () => {
    const next = reorderWithinPhase(list, 'ice2', 'ice1', phaseOf)
    expect(next!.map(t => t.order)).toEqual([0, 1, 2, 3, 4])
  })

  it('reads the current order, not array position', () => {
    const shuffled = [list[3], list[0], list[4], list[2], list[1]]
    const next = reorderWithinPhase(shuffled, 'ice2', 'ice1', phaseOf)
    expect(ids(next)).toEqual(['ice2', 'ice1', 'core1', 'core2', 'wrap1'])
  })

  it('steps over a done task in the same phase instead of moving it', () => {
    const withDone = [
      task('core1', 0, 'core', true),
      task('core2', 1, 'core'),
      task('core3', 2, 'core'),
    ]
    const next = reorderWithinPhase(withDone, 'core3', 'core2', phaseOf)
    expect(ids(next)).toEqual(['core1', 'core3', 'core2'])
  })

  it('refuses moves that are not legal', () => {
    expect(reorderWithinPhase(list, 'ice1', 'ice1', phaseOf)).toBeNull()
    expect(reorderWithinPhase(list, 'ice1', 'core1', phaseOf)).toBeNull()
    expect(reorderWithinPhase(list, 'ice1', 'nope', phaseOf)).toBeNull()
    const done = [task('a', 0, 'core', true), task('b', 1, 'core')]
    expect(reorderWithinPhase(done, 'b', 'a', phaseOf)).toBeNull()
  })
})
