import { describe, it, expect } from 'vitest'
import { preferUnsparked, SPARK_PROJECT_COOLDOWN_DAYS } from './spark-rotation.js'

describe('preferUnsparked', () => {
  const items = [
    { id: 'f1', project_id: 'p1' },
    { id: 'f2', project_id: 'p2' },
    { id: 'f3', project_id: 'p3' },
  ]

  it('drops candidates whose project was the subject recently', () => {
    expect(preferUnsparked(items, ['p1']).map(i => i.id)).toEqual(['f2', 'f3'])
  })

  it('falls back to the full set rather than going silent when everything is on cooldown', () => {
    // A spark about a project you saw on Tuesday beats no spark on Friday.
    // The cooldown is a preference, not a gate.
    expect(preferUnsparked(items, ['p1', 'p2', 'p3'])).toHaveLength(3)
  })

  it('is a no-op when nothing has been sparked yet', () => {
    expect(preferUnsparked(items, [])).toHaveLength(3)
  })

  it('keeps candidates with no project attached, since they cannot repeat a subject', () => {
    const mixed = [{ id: 'f1', project_id: null }, { id: 'f2', project_id: 'p1' }]
    expect(preferUnsparked(mixed, ['p1']).map(i => i.id)).toEqual(['f1'])
  })

  it('handles an empty candidate list', () => {
    expect(preferUnsparked([], ['p1'])).toEqual([])
  })

  it('accepts a custom id accessor for rows keyed by id rather than project_id', () => {
    const projects = [{ id: 'p1' }, { id: 'p2' }]
    expect(preferUnsparked(projects, ['p1'], p => p.id).map(p => p.id)).toEqual(['p2'])
  })
})

describe('SPARK_PROJECT_COOLDOWN_DAYS', () => {
  it('is short enough to rotate a shelf of projects but long enough to stop repeats', () => {
    expect(SPARK_PROJECT_COOLDOWN_DAYS).toBeGreaterThan(1)
    expect(SPARK_PROJECT_COOLDOWN_DAYS).toBeLessThan(21)
  })
})
