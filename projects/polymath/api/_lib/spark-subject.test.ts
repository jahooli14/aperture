import { describe, it, expect } from 'vitest'
import {
  momentumScore, rankBySubjectMomentum, pickSparkSubject,
  DEVIATE_AFTER, momentumTierSize, type SubjectCandidate,
} from './spark-subject.js'

const now = new Date('2026-09-05T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

const hot: SubjectCandidate = { id: 'p1', title: 'Graham song', recentFragments: 5, recentSessions: 2, lastTouchedAt: daysAgo(1) }
const warm: SubjectCandidate = { id: 'p2', title: 'The album', recentFragments: 2, recentSessions: 1, lastTouchedAt: daysAgo(3) }
const mild: SubjectCandidate = { id: 'p3', title: 'The shelf', recentFragments: 1, recentSessions: 0, lastTouchedAt: daysAgo(9) }
const quiet: SubjectCandidate = { id: 'p4', title: 'Bed by Ten', recentFragments: 0, recentSessions: 0, lastTouchedAt: daysAgo(40) }

describe('momentumScore', () => {
  it('counts unprompted captures for more than sessions', () => {
    const captured = { ...quiet, recentFragments: 1 }
    const sat = { ...quiet, recentSessions: 1 }
    expect(momentumScore(captured, now)).toBeGreaterThan(momentumScore(sat, now))
  })

  it('gives a cold project almost nothing, whatever else is true of it', () => {
    expect(momentumScore(quiet, now)).toBeLessThan(momentumScore(mild, now))
  })

  it('does not blow up on a project that has never been touched', () => {
    const never = { ...quiet, lastTouchedAt: null }
    expect(Number.isFinite(momentumScore(never, now))).toBe(true)
  })
})

describe('rankBySubjectMomentum', () => {
  it('puts what is actually live this week first', () => {
    expect(rankBySubjectMomentum([quiet, mild, hot, warm], now).map(p => p.id))
      .toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('is stable rather than arbitrary when two projects tie', () => {
    const a = { ...quiet, id: 'a', title: 'Aaa' }
    const b = { ...quiet, id: 'b', title: 'Bbb' }
    expect(rankBySubjectMomentum([b, a], now).map(p => p.id)).toEqual(['a', 'b'])
  })
})

describe('pickSparkSubject', () => {
  const shelf = [hot, warm, mild, quiet]

  it('follows the momentum when there is clear movement this week', () => {
    const picked = pickSparkSubject(shelf, [], now)
    expect(picked?.project.id).toBe('p1')
    expect(picked?.deviation).toBe(false)
  })

  it('never asks about the same project twice running', () => {
    expect(pickSparkSubject(shelf, ['p1'], now)?.project.id).not.toBe('p1')
  })

  it('throws in something different after a run of momentum picks', () => {
    // Three in a row all from the top tier -- the shelf is going cold.
    const picked = pickSparkSubject(shelf, ['p2', 'p1', 'p2'], now)
    expect(picked?.deviation).toBe(true)
    // p3, not p4: the best thing outside the tier, not the deadest thing on it
    expect(picked?.project.id).toBe('p3')
  })

  it('picks something with a pulse to deviate to, not the deadest thing going', () => {
    const withMiddle = [hot, warm, mild, quiet, { ...mild, id: 'p5', title: 'Zine', recentFragments: 1, lastTouchedAt: daysAgo(5) }]
    const picked = pickSparkSubject(withMiddle, ['p1', 'p2', 'p1'], now)
    expect(picked?.deviation).toBe(true)
    // p5 has more life in it than p3 or p4, so it wins the deviation
    expect(picked?.project.id).toBe('p5')
  })

  it('does not force a deviation when momentum has genuinely moved around by itself', () => {
    // p4 is well outside the tier, so the run is already broken -- no need
    // to manufacture variety the week already produced.
    const picked = pickSparkSubject(shelf, ['p4', 'p1', 'p2'], now)
    expect(picked?.deviation).toBe(false)
  })

  it('keeps a real middle to deviate into however small the shelf is', () => {
    // A fixed top-3 would make everything but the coldest project count as
    // "in motion" on a four-project shelf, forcing every deviation onto
    // whatever is nearest dead.
    expect(momentumTierSize(4)).toBe(2)
    expect(momentumTierSize(2)).toBe(1)
    expect(momentumTierSize(30)).toBe(3)
  })

  it('needs a real run before deviating, not one or two', () => {
    expect(pickSparkSubject(shelf, ['p2'], now)?.deviation).toBe(false)
    expect(pickSparkSubject(shelf, ['p2', 'p1'], now)?.deviation).toBe(false)
    expect(DEVIATE_AFTER).toBe(3)
  })

  it('copes with a shelf too small to rotate around', () => {
    expect(pickSparkSubject([hot], ['p1'], now)?.project.id).toBe('p1')
    expect(pickSparkSubject([], ['p1'], now)).toBeNull()
  })
})
