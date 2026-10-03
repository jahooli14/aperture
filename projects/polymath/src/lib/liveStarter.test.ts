import { describe, it, expect } from 'vitest'
import { chooseLiveStarter } from './liveStarter'

describe('chooseLiveStarter', () => {
  it('makes the first project they named live', () => {
    expect(chooseLiveStarter(['a', 'b'], [])).toBe('a')
  })

  it('leaves an existing live project alone', () => {
    expect(chooseLiveStarter(['a'], [{ state: 'live', is_priority: true }])).toBeNull()
    expect(chooseLiveStarter(['a'], [{ state: 'mull', is_priority: true }])).toBeNull()
  })

  it('does nothing when no project was named', () => {
    expect(chooseLiveStarter([], [])).toBeNull()
  })
})
