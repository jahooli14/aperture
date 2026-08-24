import { describe, it, expect } from 'vitest'
import {
  selectReviewCandidates,
  REVIEW_COOLDOWN_DAYS,
  REVIEW_BATCH_SIZE,
} from './project-review.js'

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString()

function project(over: Record<string, any> = {}) {
  return {
    id: 'p1',
    title: 'A Project',
    description: null,
    status: 'dormant',
    last_active: iso(200),
    is_priority: false,
    up_next_position: null,
    metadata: {},
    ...over,
  }
}

describe('selectReviewCandidates — who is eligible', () => {
  it('leaves out the priority project (it is already in your head)', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'a', is_priority: true }),
      project({ id: 'b' }),
    ])
    expect(candidates.map(c => c.id)).toEqual(['b'])
  })

  it('leaves out projects already pinned to the queue', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'a', up_next_position: 1 }),
      project({ id: 'b' }),
    ])
    expect(candidates.map(c => c.id)).toEqual(['b'])
  })

  it('leaves out half-captured projects that were never shaped', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'a', metadata: { is_shaped: false } }),
      project({ id: 'b' }),
    ])
    expect(candidates.map(c => c.id)).toEqual(['b'])
  })

  it('leaves out completed and buried projects', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'a', status: 'completed' }),
      project({ id: 'b', status: 'graveyard' }),
      project({ id: 'c', status: 'dormant' }),
    ])
    expect(candidates.map(c => c.id)).toEqual(['c'])
  })

  it('holds back anything reviewed inside the cooldown, so the rotation rotates', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'justSeen', metadata: { last_reviewed_at: iso(REVIEW_COOLDOWN_DAYS - 1) } }),
      project({ id: 'restedEnough', metadata: { last_reviewed_at: iso(REVIEW_COOLDOWN_DAYS + 1) } }),
      project({ id: 'neverReviewed' }),
    ])
    expect(candidates.map(c => c.id).sort()).toEqual(['neverReviewed', 'restedEnough'])
  })
})

describe('selectReviewCandidates — ordering', () => {
  it('puts projects sharing a label with the priority project first', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'anchor', is_priority: true, title: 'Album', metadata: { tags: ['music'] } }),
      // Older, but shares nothing.
      project({ id: 'unrelated', last_active: iso(400), metadata: { tags: ['gardening'] } }),
      // Newer, but shares a label — the building block.
      project({ id: 'shared', last_active: iso(100), metadata: { tags: ['music', 'woodwork'] } }),
    ])
    expect(candidates[0].id).toBe('shared')
    expect(candidates[0].shared_tags).toEqual(['music'])
  })

  it('falls back to longest-untouched when nothing shares a label', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'recent', last_active: iso(30) }),
      project({ id: 'ancient', last_active: iso(500) }),
      project({ id: 'middle', last_active: iso(200) }),
    ])
    expect(candidates.map(c => c.id)).toEqual(['ancient', 'middle', 'recent'])
  })

  it('caps the batch so the review stays a review, not a chore list', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      project({ id: `p${i}`, last_active: iso(100 + i) })
    )
    expect(selectReviewCandidates(many).candidates).toHaveLength(REVIEW_BATCH_SIZE)
  })

  it('honours an explicit limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => project({ id: `p${i}` }))
    expect(selectReviewCandidates(many, 5).candidates).toHaveLength(5)
  })
})

describe('selectReviewCandidates — the anchor', () => {
  it('reports the priority project as the anchor', () => {
    const { anchor } = selectReviewCandidates([
      project({ id: 'a', is_priority: true, title: 'The Album', metadata: { tags: ['Music'] } }),
      project({ id: 'b' }),
    ])
    expect(anchor).toEqual({ title: 'The Album', tags: ['music'] })
  })

  it('is null when nothing is starred', () => {
    const { anchor } = selectReviewCandidates([project({ id: 'a' })])
    expect(anchor).toBeNull()
  })
})

describe('selectReviewCandidates — the stated reason', () => {
  it('names the shared label and the project it connects to', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'anchor', is_priority: true, title: 'The Album', metadata: { tags: ['music'] } }),
      project({ id: 'b', metadata: { tags: ['music'] } }),
    ])
    expect(candidates[0].reason).toBe('Also music, like The Album.')
  })

  it('states plain elapsed time when there is no connection to claim', () => {
    const { candidates } = selectReviewCandidates([project({ id: 'b', last_active: iso(120) })])
    expect(candidates[0].reason).toBe('Untouched 4 months.')
  })

  it('uses weeks for the more recent end of the range', () => {
    const { candidates } = selectReviewCandidates([project({ id: 'b', last_active: iso(28) })])
    expect(candidates[0].reason).toBe('Untouched 4 weeks.')
  })

  it('says so plainly when a project was never started', () => {
    const { candidates } = selectReviewCandidates([
      project({ id: 'b', last_active: null, updated_at: null, created_at: null }),
    ])
    expect(candidates[0].reason).toBe('Never started.')
    expect(candidates[0].days_since_touched).toBe(0)
  })
})
