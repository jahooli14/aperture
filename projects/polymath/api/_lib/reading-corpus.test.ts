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
  it('keeps an article the user marked good', () => {
    expect(isCorpusEligible(feedItem({ resonance: 'good' }))).toBe(true)
    expect(isCorpusEligible(handSaved({ resonance: 'good' }))).toBe(true)
  })

  it('drops an article the user marked not for me, however it arrived', () => {
    expect(isCorpusEligible(feedItem({ resonance: 'not_for_me' }))).toBe(false)
    expect(isCorpusEligible(handSaved({ resonance: 'not_for_me' }))).toBe(false)
  })

  it('drops an undecided RSS item — arriving in a feed is not a signal', () => {
    expect(isCorpusEligible(feedItem())).toBe(false)
    expect(isCorpusEligible(feedItem({ status: 'archived' }))).toBe(false)
  })

  it('keeps an undecided hand-saved article, as it did before the verdict existed', () => {
    expect(isCorpusEligible(handSaved())).toBe(true)
    expect(isCorpusEligible({ tags: null, resonance: null })).toBe(true)
    expect(isCorpusEligible({})).toBe(true)
  })
})

describe('corpusWeight', () => {
  it('ranks an explicit good above a legacy hand-save', () => {
    expect(corpusWeight(handSaved({ resonance: 'good' }))).toBe(2)
    expect(corpusWeight(handSaved())).toBe(1)
    expect(corpusWeight(feedItem())).toBe(0)
  })
})

describe('selectCorpusArticles', () => {
  it('filters, then puts vouched-for articles first', () => {
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
      'saved-old',
    ])
  })

  it('preserves input order within a tier, so callers keep newest-first', () => {
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
