import { describe, it, expect } from 'vitest'
import {
  findOrbiters, pickOrbiters, cosine, toVec,
  ORBIT_FLOOR, ORBIT_CEILING,
} from './orbit.js'

const NOW = new Date('2026-09-15T00:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

/** A vector pointing mostly along one axis, so similarity is legible. */
const vec = (x: number, y: number, z = 0) => [x, y, z]

const project = (id: string, title: string, v: number[]) => ({ id, title, embedding: v })
const capture = (
  id: string, v: number[], days: number, projectId: string | null = null,
) => ({ id, text: id, createdAt: ago(days), projectId, embedding: v })

describe('cosine and toVec', () => {
  it('reads pgvector back as a string or an array', () => {
    expect(toVec([1, 0, 0])).toEqual([1, 0, 0])
    expect(toVec('[1,0,0]')).toEqual([1, 0, 0])
    expect(toVec(null)).toBeNull()
    expect(toVec('')).toBeNull()
    expect(toVec([])).toBeNull()
  })

  it('ignores magnitude', () => {
    expect(cosine([1, 0, 0], [5, 0, 0])).toBeCloseTo(1)
    expect(cosine([1, 0, 0], [0, 1, 0])).toBeCloseTo(0)
  })
})

describe('findOrbiters', () => {
  const book = project('p-book', 'The book', vec(1, 0))
  const deck = project('p-deck', 'Deck stand', vec(0, 1))

  it('finds a capture that belongs to a project and never went in', () => {
    // Close to the book, but not close enough to be the book restated.
    const orbiting = capture('c1', vec(1, 0, 0.8), 200)
    const found = findOrbiters([book, deck], [orbiting], NOW)

    expect(found).toHaveLength(1)
    expect(found[0].project.id).toBe('p-book')
    expect(found[0].alsoNear).toBe(0)
    // The fact is computed, dated, and names the project.
    expect(found[0].fact).toContain('The book')
    expect(found[0].fact).toContain('months ago')
    expect(found[0].fact).toMatch(/not part of it|never became part of it/)
  })

  it('ignores a capture already filed under that project — it went in', () => {
    const filed = capture('c1', vec(1, 0, 0.8), 200, 'p-book')
    expect(findOrbiters([book, deck], [filed], NOW)).toHaveLength(0)
  })

  it('ignores the project restated in other words', () => {
    // Nearly identical to the project vector: above the ceiling. This is
    // the collision the old channel kept shipping as an insight.
    const restatement = capture('c1', vec(1, 0.01), 200)
    const found = findOrbiters([book, deck], [restatement], NOW)
    expect(found).toHaveLength(0)
  })

  it('ignores something that is not about any project', () => {
    const unrelated = capture('c1', vec(0, 0, 1), 200)
    expect(findOrbiters([book, deck], [unrelated], NOW)).toHaveLength(0)
  })

  it('ignores anything too recent to have been a choice', () => {
    const fresh = capture('c1', vec(1, 0, 0.8), 3)
    expect(findOrbiters([book, deck], [fresh], NOW)).toHaveLength(0)
  })

  it('counts how many other projects it is also near, and says so', () => {
    // Sits between the two projects: near both.
    const between = capture('c1', vec(1, 0.9), 200)
    const found = findOrbiters([book, deck], [between], NOW)
    expect(found).toHaveLength(1)
    expect(found[0].alsoNear).toBe(1)
    // A general interest is a weaker claim than material that belongs to
    // exactly one project.
    const only = findOrbiters([book, deck], [capture('c2', vec(1, 0, 0.8), 200)], NOW)
    expect(found[0].strength).toBeLessThan(only[0].strength)
  })

  it('prefers material that has been sitting unused for longer', () => {
    const old = findOrbiters([book], [capture('c1', vec(1, 0, 0.8), 700)], NOW)[0]
    const recent = findOrbiters([book], [capture('c2', vec(1, 0, 0.8), 40)], NOW)[0]
    expect(old.strength).toBeGreaterThan(recent.strength)
  })

  it('says nothing when a project has no embedding to compare against', () => {
    const blind = { id: 'p-x', title: 'X', embedding: null }
    expect(findOrbiters([blind], [capture('c1', vec(1, 0, 0.8), 200)], NOW)).toHaveLength(0)
  })

  it('skips a capture with no embedding rather than throwing', () => {
    const noVec = { ...capture('c1', vec(1, 0, 0.8), 200), embedding: null }
    expect(() => findOrbiters([book], [noVec], NOW)).not.toThrow()
    expect(findOrbiters([book], [noVec], NOW)).toHaveLength(0)
  })

  it('keeps the band honest at both ends', () => {
    expect(ORBIT_FLOOR).toBeLessThan(ORBIT_CEILING)
    expect(ORBIT_CEILING).toBeLessThan(1)
  })
})

describe('pickOrbiters', () => {
  it('takes one per project, so a run does not ask three questions about one thing', () => {
    const book = project('p-book', 'The book', vec(1, 0))
    const deck = project('p-deck', 'Deck stand', vec(0, 1))
    const found = findOrbiters([book, deck], [
      capture('c1', vec(1, 0, 0.8), 700),
      capture('c2', vec(1, 0, 0.85), 600),
      capture('c3', vec(0, 1, 0.8), 500),
    ], NOW)

    const picked = pickOrbiters(found, 3)
    expect(picked).toHaveLength(2)
    expect(new Set(picked.map(p => p.project.id)).size).toBe(2)
  })
})
