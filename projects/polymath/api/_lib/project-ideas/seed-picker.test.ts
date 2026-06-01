import { describe, it, expect } from 'vitest'
import { tokenise, topicalOverlap } from './seed-picker'

describe('tokenise', () => {
  it('lowercases, splits on non-alphanumerics, drops short tokens and stopwords', () => {
    const t = tokenise('The quick brown Fox-jumps! AI ok')
    expect(t.has('quick')).toBe(true)
    expect(t.has('brown')).toBe(true)
    expect(t.has('fox')).toBe(true)
    expect(t.has('jumps')).toBe(true)
    expect(t.has('the')).toBe(false) // stopword
    expect(t.has('ai')).toBe(false)  // < 3 chars
    expect(t.has('ok')).toBe(false)  // < 3 chars
  })

  it('returns an empty set for empty/falsy input', () => {
    expect(tokenise('').size).toBe(0)
    expect(tokenise(undefined as any).size).toBe(0)
  })
})

describe('topicalOverlap (Jaccard)', () => {
  it('is 1.0 for identical sets', () => {
    expect(topicalOverlap(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c']))).toBe(1)
  })

  it('is 0 for disjoint or empty sets', () => {
    expect(topicalOverlap(new Set(['a', 'b']), new Set(['c', 'd']))).toBe(0)
    expect(topicalOverlap(new Set(), new Set(['a']))).toBe(0)
  })

  it('computes intersection-over-union', () => {
    // {a,b,c} vs {b,c,d}: inter 2, union 4 → 0.5
    expect(topicalOverlap(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(0.5)
    // {a,b} vs {b,c,d,e}: inter 1, union 5 → 0.2
    expect(topicalOverlap(new Set(['a', 'b']), new Set(['b', 'c', 'd', 'e']))).toBeCloseTo(0.2)
  })
})
