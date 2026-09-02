import { describe, it, expect } from 'vitest'
import { normalizeTaskOrder, insertAfterDone, orderSteps } from './task-order.js'

describe('normalizeTaskOrder', () => {
  it('gives every task a contiguous order, keeping array position for tasks without one', () => {
    const tasks = [{ id: 'a' }, { id: 'b', order: 5 }, { id: 'c' }]
    expect(normalizeTaskOrder(tasks).map(t => `${t.id}:${t.order}`)).toEqual(['a:0', 'c:1', 'b:2'])
  })

  it('respects an existing order over array position', () => {
    const tasks = [{ id: 'second', order: 1 }, { id: 'first', order: 0 }]
    expect(normalizeTaskOrder(tasks).map(t => t.id)).toEqual(['first', 'second'])
  })

  it('is idempotent', () => {
    const once = normalizeTaskOrder([{ id: 'a', order: 3 }, { id: 'b' }, { id: 'c', order: 1 }])
    expect(normalizeTaskOrder(once)).toEqual(once)
  })

  it('is stable for ties', () => {
    const tasks = [{ id: 'a', order: 0 }, { id: 'b', order: 0 }, { id: 'c', order: 0 }]
    expect(normalizeTaskOrder(tasks).map(t => t.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('insertAfterDone', () => {
  it('puts what a close-out said comes next at the FRONT of the open list', () => {
    // The bug this fixes: "next: let it dry and peel the stencil" was being
    // appended after every step the spine had already planned.
    const tasks = [
      { id: 'done1', done: true, order: 0 },
      { id: 'open1', done: false, order: 1 },
      { id: 'open2', done: false, order: 2 },
    ]
    const result = insertAfterDone(tasks, [{ id: 'next', done: false }])
    expect(result.map(t => t.id)).toEqual(['done1', 'next', 'open1', 'open2'])
    expect(result.map(t => t.order)).toEqual([0, 1, 2, 3])
  })

  it('appends when everything is done', () => {
    const tasks = [{ id: 'done1', done: true, order: 0 }]
    expect(insertAfterDone(tasks, [{ id: 'next', done: false }]).map(t => t.id)).toEqual(['done1', 'next'])
  })

  it('goes first when nothing is done', () => {
    const tasks = [{ id: 'open1', done: false, order: 0 }]
    expect(insertAfterDone(tasks, [{ id: 'next', done: false }]).map(t => t.id)).toEqual(['next', 'open1'])
  })
})

describe('orderSteps', () => {
  const s = (position: number, text: string, after?: number[]) => ({ position, text, after })

  it('leaves an already-correct chain untouched', () => {
    const steps = [s(1, 'design'), s(2, 'cut', [1]), s(3, 'pour', [2])]
    expect(orderSteps(steps).map(x => x.text)).toEqual(['design', 'cut', 'pour'])
  })

  it('fixes the stencil case: a step written above the one it depends on', () => {
    const steps = [
      s(1, 'Let the piece dry and remove the stencil', [2, 3]),
      s(2, 'Design and cut the stencil'),
      s(3, 'Pour the paint over the stencil', [2]),
    ]
    expect(orderSteps(steps).map(x => x.text)).toEqual([
      'Design and cut the stencil',
      'Pour the paint over the stencil',
      'Let the piece dry and remove the stencil',
    ])
  })

  it('moves as little as possible -- unrelated steps keep their written order', () => {
    const steps = [s(1, 'a'), s(2, 'b', [3]), s(3, 'c'), s(4, 'd')]
    expect(orderSteps(steps).map(x => x.text)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('ignores a dependency on a step grounding dropped', () => {
    const steps = [s(2, 'b', [1]), s(3, 'c', [2])]
    expect(orderSteps(steps).map(x => x.text)).toEqual(['b', 'c'])
  })

  it('ignores self-references and junk', () => {
    const steps = [s(1, 'a', [1, 99]), s(2, 'b', [1])]
    expect(orderSteps(steps).map(x => x.text)).toEqual(['a', 'b'])
  })

  it('breaks a cycle by falling back to written order instead of hanging', () => {
    const steps = [s(1, 'a', [2]), s(2, 'b', [1])]
    expect(orderSteps(steps).map(x => x.text)).toEqual(['a', 'b'])
  })

  it('strips the position field from the output', () => {
    const [first] = orderSteps([s(1, 'a')])
    expect('position' in first).toBe(false)
  })
})
