import { describe, it, expect } from 'vitest'
import { openTasksInOrder, selectByBudget, sumMinutes, workingMinutes } from './session-budget.js'

describe('openTasksInOrder', () => {
  it('drops done tasks and anything missing an id or text', () => {
    const tasks = [
      { id: 't1', text: 'a', done: false },
      { id: 't2', text: 'b', done: true },
      { id: 't3', done: false },
      { text: 'no id', done: false },
    ]
    expect(openTasksInOrder(tasks, 10).map(t => t.id)).toEqual(['t1'])
  })

  it('respects the order field, not array position', () => {
    const tasks = [
      { id: 't1', text: 'second', done: false, order: 1 },
      { id: 't2', text: 'first', done: false, order: 0 },
    ]
    expect(openTasksInOrder(tasks, 10).map(t => t.text)).toEqual(['first', 'second'])
  })

  it('uses the stored estimate when one was set', () => {
    const tasks = [{ id: 't1', text: 'a', done: false, estimated_minutes: 45, estimate_set: true }]
    expect(openTasksInOrder(tasks, 10)[0].minutes).toBe(45)
  })

  it('falls back to the neutral default rather than calling the model', () => {
    const tasks = [{ id: 't1', text: 'a', done: false }]
    expect(openTasksInOrder(tasks, 10)[0].minutes).toBe(20)
  })

  it('ignores a stray estimated_minutes with no estimate_set flag', () => {
    // A partially-formed record shouldn't be trusted as a real estimate.
    const tasks = [{ id: 't1', text: 'a', done: false, estimated_minutes: 45 }]
    expect(openTasksInOrder(tasks, 10)[0].minutes).toBe(20)
  })

  it('caps at the given limit', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, text: `task ${i}`, done: false, order: i }))
    expect(openTasksInOrder(tasks, 24)).toHaveLength(24)
  })
})

describe('selectByBudget', () => {
  const t = (id: string, minutes: number) => ({ id, minutes })

  it('takes tasks in order until the budget runs out', () => {
    const { selected, rest } = selectByBudget([t('a', 20), t('b', 20), t('c', 20)], 45, 6)
    expect(selected.map(s => s.id)).toEqual(['a', 'b'])
    expect(rest.map(s => s.id)).toEqual(['c'])
  })

  it('lets two big tasks fill the window without padding to the count ceiling', () => {
    const { selected } = selectByBudget([t('a', 30), t('b', 30), t('c', 15)], 60, 6)
    expect(selected.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('never returns an empty selection just because the first task alone exceeds budget', () => {
    const { selected } = selectByBudget([t('a', 90)], 60, 6)
    expect(selected.map(s => s.id)).toEqual(['a'])
  })

  it('caps at maxCount even with budget to spare', () => {
    const { selected } = selectByBudget([t('a', 5), t('b', 5), t('c', 5), t('d', 5)], 100, 2)
    expect(selected).toHaveLength(2)
  })

  it('falls back to count-only when the window is unknown', () => {
    const { selected, rest } = selectByBudget([t('a', 5), t('b', 5), t('c', 5)], null, 2)
    expect(selected.map(s => s.id)).toEqual(['a', 'b'])
    expect(rest.map(s => s.id)).toEqual(['c'])
  })
})

describe('sumMinutes', () => {
  it('adds up', () => {
    expect(sumMinutes([{ minutes: 5 }, { minutes: 15 }])).toBe(20)
  })

  it('is zero for an empty list', () => {
    expect(sumMinutes([])).toBe(0)
  })
})

describe('workingMinutes', () => {
  it('takes setting up and clearing away out of the window, because both happen inside it', () => {
    expect(workingMinutes(60, 10, 10)).toBe(40)
  })

  it('handles a project that needs one end but not the other', () => {
    expect(workingMinutes(60, 15, null)).toBe(45)
    expect(workingMinutes(60, null, 5)).toBe(55)
  })

  it('is just the window when the project needs neither', () => {
    expect(workingMinutes(60)).toBe(60)
    expect(workingMinutes(60, null, null)).toBe(60)
  })

  it('stays null when the window is unknown, rather than inventing one', () => {
    expect(workingMinutes(null, 10, 10)).toBeNull()
  })

  it('floors at five rather than going to zero, so a swallowed window still gets one small thing', () => {
    expect(workingMinutes(20, 15, 15)).toBe(5)
  })
})
