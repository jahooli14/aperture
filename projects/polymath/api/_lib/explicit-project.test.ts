import { describe, it, expect } from 'vitest'
import { explicitProjectId, pinnedTriage } from './explicit-project.js'

describe('explicitProjectId', () => {
  const id = '3f0c1a52-7b0e-4c5d-9a11-0d2e4f6a8b10'
  it('reads the id off a project reference, string or object', () => {
    expect(explicitProjectId(`project:${id}`)).toBe(id)
    expect(explicitProjectId({ type: 'project', id })).toBe(id)
  })
  it('ignores anything else, including a spark answer', () => {
    expect(explicitProjectId(null)).toBeNull()
    expect(explicitProjectId('spark:abc')).toBeNull()
    expect(explicitProjectId({ type: 'spark', id: 's1', title: 'x' })).toBeNull()
    expect(explicitProjectId('project:')).toBeNull()
  })
})

describe('pinnedTriage', () => {
  it('pins the project and counts it as an update, keeping the rest', () => {
    const t = pinnedTriage({ category: 'list_item', project_id: 'other', bridge_insight: 'x' }, 'p1')
    expect(t).toMatchObject({ category: 'task_update', project_id: 'p1', confidence: 1, bridge_insight: 'x' })
  })
  it('works from nothing', () => {
    expect(pinnedTriage(undefined, 'p1')).toEqual({ category: 'task_update', project_id: 'p1', confidence: 1 })
  })
})
