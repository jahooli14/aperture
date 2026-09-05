import { describe, it, expect } from 'vitest'
import { buildOfflinePlan } from './offlinePlan'
import type { Project } from '../../types'

function project(tasks: unknown[]): Project {
  return {
    id: 'p1',
    user_id: 'u1',
    title: 'Test project',
    description: null,
    status: 'active',
    last_active: new Date().toISOString(),
    created_at: new Date().toISOString(),
    metadata: { tasks },
  } as Project
}

describe('buildOfflinePlan', () => {
  it('draws the next steps in order, sized to the window', () => {
    const p = project([
      { id: 't1', text: 'first', done: false, order: 0, estimated_minutes: 30, estimate_set: true },
      { id: 't2', text: 'second', done: false, order: 1, estimated_minutes: 30, estimate_set: true },
      { id: 't3', text: 'third', done: false, order: 2, estimated_minutes: 30, estimate_set: true },
    ])
    const plan = buildOfflinePlan(p, 60)
    expect(plan.items.map(i => i.text)).toEqual(['first', 'second'])
    expect(plan.source).toBe('offline')
  })

  it('skips done tasks', () => {
    const p = project([
      { id: 't1', text: 'done already', done: true, order: 0 },
      { id: 't2', text: 'next up', done: false, order: 1 },
    ])
    const plan = buildOfflinePlan(p, 30)
    expect(plan.items.map(i => i.text)).toEqual(['next up'])
  })

  it('returns an empty, honest plan when the backlog is empty rather than inventing one', () => {
    const plan = buildOfflinePlan(project([]), 30)
    expect(plan.items).toEqual([])
    expect(plan.doneLooksLike).toBeNull()
    expect(plan.source).toBe('offline')
  })

  it('carries the real taskId and a progress note when one exists', () => {
    const p = project([
      { id: 't1', text: 'mix the outro', done: false, order: 0, progress_note: 'got the levels roughed in' },
    ])
    const plan = buildOfflinePlan(p, 30)
    expect(plan.items[0].taskId).toBe('t1')
    expect(plan.items[0].source).toBe('last time: got the levels roughed in')
  })

  it('falls back to count-only selection when the window is unknown', () => {
    const p = project([
      { id: 't1', text: 'a', done: false, order: 0 },
      { id: 't2', text: 'b', done: false, order: 1 },
    ])
    const plan = buildOfflinePlan(p, null)
    expect(plan.items).toHaveLength(2)
  })

  it('reports a real done-looks-like line for the steps it selected', () => {
    const p = project([
      { id: 't1', text: 'sand the top', done: false, order: 0, estimated_minutes: 20, estimate_set: true },
      { id: 't2', text: 'apply the first coat', done: false, order: 1, estimated_minutes: 20, estimate_set: true },
    ])
    const plan = buildOfflinePlan(p, 45)
    expect(plan.doneLooksLike).toBe('Through to "apply the first coat".')
  })
})
