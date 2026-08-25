import { describe, it, expect } from 'vitest'
import { findRecurringThemes } from './joints.js'

// Small 3-d vectors are enough to exercise the cosine-similarity threshold
// without needing real embeddings.
const CLEAN_RAW_A = [1, 0, 0]
const CLEAN_RAW_B = [0.95, 0.05, 0.1] // close to A
const CLEAN_RAW_C = [0.9, 0.1, 0.15] // close to A and B
const UNRELATED_1 = [0, 1, 0]
const UNRELATED_2 = [0.1, 0.9, 0.2] // close to UNRELATED_1, not to the clean/raw cluster
const LONE = [0, 0, 1] // similar to nothing

describe('findRecurringThemes', () => {
  it('groups fragments whose embeddings are similar enough', () => {
    const clusters = findRecurringThemes([
      { id: 'f1', text: 'clean electronic against raw wood', embedding: CLEAN_RAW_A },
      { id: 'f2', text: 'the contrast of digital and analogue textures', embedding: CLEAN_RAW_B },
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].fragmentIds).toEqual(['f1', 'f2'])
  })

  it('drops a cluster of exactly one -- a single mention is not a joint', () => {
    const clusters = findRecurringThemes([
      { id: 'f1', text: 'once-off thought', embedding: LONE },
    ])
    expect(clusters).toHaveLength(0)
  })

  it('keeps unrelated themes in separate clusters', () => {
    const clusters = findRecurringThemes([
      { id: 'f1', text: 'clean vs raw', embedding: CLEAN_RAW_A },
      { id: 'f2', text: 'digital vs analogue', embedding: CLEAN_RAW_B },
      { id: 'f3', text: 'something about mornings', embedding: UNRELATED_1 },
      { id: 'f4', text: 'something about routine', embedding: UNRELATED_2 },
    ])
    expect(clusters).toHaveLength(2)
    const ids = clusters.map(c => c.fragmentIds.sort())
    expect(ids).toContainEqual(['f1', 'f2'])
    expect(ids).toContainEqual(['f3', 'f4'])
  })

  it('adds a third similar fragment to an existing cluster rather than starting a new one', () => {
    const clusters = findRecurringThemes([
      { id: 'f1', text: 'a', embedding: CLEAN_RAW_A },
      { id: 'f2', text: 'b', embedding: CLEAN_RAW_B },
      { id: 'f3', text: 'c', embedding: CLEAN_RAW_C },
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].fragmentIds).toEqual(['f1', 'f2', 'f3'])
  })

  it('skips fragments with no embedding rather than throwing', () => {
    const clusters = findRecurringThemes([
      { id: 'f1', text: 'no embedding', embedding: [] },
      { id: 'f2', text: 'has one', embedding: CLEAN_RAW_A },
      { id: 'f3', text: 'also has one', embedding: CLEAN_RAW_B },
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].fragmentIds).toEqual(['f2', 'f3'])
  })

  it('returns nothing for an empty corpus', () => {
    expect(findRecurringThemes([])).toEqual([])
  })
})
