import { describe, it, expect } from 'vitest'
import {
  isCorpusEligible,
  corpusWeight,
  selectCorpusArticles,
  corpusLabel,
} from './reading-corpus'

const feedItem = (over: Record<string, unknown> = {}) => ({
  tags: ['rss', 'auto-imported'],
  status: 'unread',
  resonance: null,
  ...over,
})

const handSaved = (over: Record<string, unknown> = {}) => ({
  tags: ['saved'],
  status: 'reading',
  resonance: null,
  ...over,
})

describe('isCorpusEligible', () => {
  it('keeps only what the user finished and voted good', () => {
    expect(isCorpusEligible(feedItem({ resonance: 'good' }))).toBe(true)
    expect(isCorpusEligible(handSaved({ resonance: 'good' }))).toBe(true)
  })

  it('drops an article the user marked not for me, however it arrived', () => {
    expect(isCorpusEligible(feedItem({ resonance: 'not_for_me' }))).toBe(false)
    expect(isCorpusEligible(handSaved({ resonance: 'not_for_me' }))).toBe(false)
  })

  it('drops everything with no verdict — reading it is not voting on it', () => {
    // Two archived articles reached a question this way. read_at was the
    // signal and it is not one: any path that sets status to 'reading'
    // stamps it, including the swipe that means "put this in my list".
    expect(isCorpusEligible(feedItem())).toBe(false)
    expect(isCorpusEligible(feedItem({ read_at: '2026-09-01T10:00:00Z' } as any))).toBe(false)
    expect(isCorpusEligible(feedItem({ status: 'reading' }))).toBe(false)
    expect(isCorpusEligible(feedItem({ status: 'archived' }))).toBe(false)
  })

  it('drops an undecided hand-save too — saving is intent, not a judgement', () => {
    expect(isCorpusEligible(handSaved())).toBe(false)
    expect(isCorpusEligible({ tags: null, resonance: null })).toBe(false)
    expect(isCorpusEligible({})).toBe(false)
  })
})

describe('corpusWeight', () => {
  it('is on or off, since only a vouched-for article is eligible at all', () => {
    expect(corpusWeight(handSaved({ resonance: 'good' }))).toBe(2)
    expect(corpusWeight(handSaved())).toBe(0)
    expect(corpusWeight(feedItem())).toBe(0)
  })
})

describe('selectCorpusArticles', () => {
  it('keeps only the vouched-for, in the order they arrived', () => {
    const rows = [
      { id: 'noise', ...feedItem() },
      { id: 'saved-old', ...handSaved() },
      { id: 'good-feed', ...feedItem({ resonance: 'good' }) },
      { id: 'rejected', ...handSaved({ resonance: 'not_for_me' }) },
      { id: 'good-saved', ...handSaved({ resonance: 'good' }) },
    ]
    expect(selectCorpusArticles(rows).map(r => r.id)).toEqual([
      'good-feed',
      'good-saved',
    ])
  })

  it('preserves input order, so callers keep newest-first', () => {
    const rows = [
      { id: 'a', ...handSaved({ resonance: 'good' }) },
      { id: 'b', ...handSaved({ resonance: 'good' }) },
      { id: 'c', ...handSaved({ resonance: 'good' }) },
    ]
    expect(selectCorpusArticles(rows).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns nothing when the whole batch is unread feed noise', () => {
    expect(selectCorpusArticles([feedItem(), feedItem(), feedItem()])).toEqual([])
  })
})

describe('corpusLabel', () => {
  it('only labels the explicit verdict', () => {
    expect(corpusLabel({ resonance: 'good' })).toContain('good')
    expect(corpusLabel(handSaved())).toBe('')
  })
})
