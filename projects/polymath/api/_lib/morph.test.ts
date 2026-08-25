import { describe, it, expect } from 'vitest'
import { canMorphProject, anyProjectMorphedToday, verifyCitations } from './morph.js'

describe('canMorphProject', () => {
  it('allows a project that has never morphed', () => {
    expect(canMorphProject(null)).toBe(true)
  })

  it('blocks a project morphed 5 days ago', () => {
    const now = new Date('2026-08-24T00:00:00Z')
    const fiveDaysAgo = new Date('2026-08-19T00:00:00Z').toISOString()
    expect(canMorphProject(fiveDaysAgo, now)).toBe(false)
  })

  it('allows a project morphed exactly 14 days ago', () => {
    const now = new Date('2026-08-24T00:00:00Z')
    const fourteenDaysAgo = new Date('2026-08-10T00:00:00Z').toISOString()
    expect(canMorphProject(fourteenDaysAgo, now)).toBe(true)
  })

  it('blocks a project morphed 13 days ago', () => {
    const now = new Date('2026-08-24T00:00:00Z')
    const thirteenDaysAgo = new Date('2026-08-11T00:00:00Z').toISOString()
    expect(canMorphProject(thirteenDaysAgo, now)).toBe(false)
  })
})

describe('anyProjectMorphedToday', () => {
  const now = new Date('2026-08-24T18:00:00Z')

  it('is false with no morphs today', () => {
    expect(anyProjectMorphedToday([], now)).toBe(false)
  })

  it('is true when any timestamp falls on today (UTC)', () => {
    expect(anyProjectMorphedToday(['2026-08-24T02:00:00Z'], now)).toBe(true)
  })

  it('is false when the only morph was yesterday', () => {
    expect(anyProjectMorphedToday(['2026-08-23T23:59:00Z'], now)).toBe(false)
  })
})

describe('verifyCitations', () => {
  const fragments = [
    { id: 'f1', text: 'The new Four Tet album has this really light, ethereal sound to it.' },
    { id: 'f2', text: 'Offcuts from the shelf project are still in the shed.' },
  ]

  it('accepts a citation whose fragment text is quoted directly', () => {
    const result = verifyCitations(
      'You keep coming back to a light, ethereal sound -- worth building the set around that.',
      ['f1'],
      fragments
    )
    expect(result.valid).toBe(true)
    expect(result.invalidIds).toEqual([])
  })

  it('accepts a loose paraphrase with substantial word overlap', () => {
    const result = verifyCitations(
      'The shed still has offcuts from the shelf project sitting there.',
      ['f2'],
      fragments
    )
    expect(result.valid).toBe(true)
  })

  it('rejects a citation to a fragment whose content is not actually reflected', () => {
    const result = verifyCitations(
      'Something about deadlines and collaborators, apparently.',
      ['f1'],
      fragments
    )
    expect(result.valid).toBe(false)
    expect(result.invalidIds).toEqual(['f1'])
  })

  it('rejects a citation to a fragment id that does not exist', () => {
    const result = verifyCitations('anything', ['does-not-exist'], fragments)
    expect(result.valid).toBe(false)
    expect(result.invalidIds).toEqual(['does-not-exist'])
  })

  it('is invalid with zero citations -- a morph must cite something', () => {
    const result = verifyCitations('A vague reshape with no evidence.', [], fragments)
    expect(result.valid).toBe(false)
  })

  it('flags only the invalid citation among several', () => {
    const result = verifyCitations(
      'Light and ethereal, like the Four Tet thing.',
      ['f1', 'f2'],
      fragments
    )
    expect(result.valid).toBe(false)
    expect(result.invalidIds).toEqual(['f2'])
  })
})
