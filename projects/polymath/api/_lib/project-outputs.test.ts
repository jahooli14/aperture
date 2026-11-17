import { describe, it, expect } from 'vitest'
import { isNotSetUp } from './project-outputs'

describe('isNotSetUp', () => {
  it('reads a missing table or column as "not set up yet"', () => {
    expect(isNotSetUp({ code: '42P01' })).toBe(true)
    expect(isNotSetUp({ code: 'PGRST205' })).toBe(true)
    expect(isNotSetUp({ code: '42703' })).toBe(true)
  })
  it('treats anything else as a real error', () => {
    expect(isNotSetUp({ code: '23505' })).toBe(false)
    expect(isNotSetUp(null)).toBe(false)
  })
})
