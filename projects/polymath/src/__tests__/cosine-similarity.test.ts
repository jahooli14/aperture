import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from '../../api/_lib/gemini-embeddings'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const vec = [1, 2, 3, 4, 5]
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0]
    const b = [-1, 0, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('handles similar vectors with high similarity', () => {
    const a = [1, 2, 3]
    const b = [1.1, 2.1, 3.1]
    const similarity = cosineSimilarity(a, b)
    expect(similarity).toBeGreaterThan(0.99)
  })

  it('handles JSON string input', () => {
    const a = JSON.stringify([1, 2, 3])
    const b = JSON.stringify([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5)
  })

  it('handles mixed input (array and string)', () => {
    const a = [1, 0, 0]
    const b = JSON.stringify([0, 1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('computes correct similarity for real-world-like vectors', () => {
    // Simulate 768-dim embeddings with some overlap
    const a = Array.from({ length: 10 }, (_, i) => Math.sin(i))
    const b = Array.from({ length: 10 }, (_, i) => Math.sin(i + 0.5))
    const similarity = cosineSimilarity(a, b)
    expect(similarity).toBeGreaterThan(0.5)
    expect(similarity).toBeLessThan(1)
  })
})
