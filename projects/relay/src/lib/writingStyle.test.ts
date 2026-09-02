import { describe, expect, it } from 'vitest'
import { computeWritingStyle, countWords, findLongestLine } from './writingStyle'
import type { Line } from './types'

function line(overrides: Partial<Line> & { position: number; author_id: string }): Line {
  return {
    id: `line-${overrides.position}`,
    body: 'A line of the story.',
    created_at: '2026-01-01T09:00:00.000Z',
    chapter_title: null,
    display_name: 'Writer',
    ...overrides,
  }
}

describe('countWords', () => {
  it('counts hyphenated and apostrophed words as one', () => {
    expect(countWords("Pasco's faux pet echidna")).toBe(4)
    expect(countWords('dazzle-patterned commuter bike')).toBe(3)
  })
})

describe('computeWritingStyle', () => {
  it('averages words per line per writer', () => {
    const lines = [
      line({ position: 1, author_id: 'dan', body: 'one two three four' }),
      line({ position: 2, author_id: 'ben', body: 'five six' }),
      line({ position: 3, author_id: 'dan', body: 'seven eight nine ten eleven twelve' }),
    ]
    const style = computeWritingStyle(lines)
    expect(style.find((w) => w.user_id === 'dan')?.avgWords).toBe(5)
    expect(style.find((w) => w.user_id === 'ben')?.avgWords).toBe(2)
  })

  it('orders writers busiest (by average words) first', () => {
    const lines = [
      line({ position: 1, author_id: 'ben', body: 'a b' }),
      line({ position: 2, author_id: 'dan', body: 'a b c d e f g h' }),
    ]
    expect(computeWritingStyle(lines).map((w) => w.user_id)).toEqual(['dan', 'ben'])
  })

  it('reads reply speed from the gap since the previous writer, not their own last line', () => {
    const lines = [
      line({ position: 1, author_id: 'dan', created_at: '2026-01-01T09:00:00.000Z' }),
      line({ position: 2, author_id: 'ben', created_at: '2026-01-01T15:00:00.000Z' }), // 6h after dan
      line({ position: 3, author_id: 'dan', created_at: '2026-01-02T15:00:00.000Z' }), // 24h after ben
    ]
    const style = computeWritingStyle(lines)
    expect(style.find((w) => w.user_id === 'ben')?.medianReplyHours).toBe(6)
    expect(style.find((w) => w.user_id === 'dan')?.medianReplyHours).toBe(24)
  })

  it('has no reply time for a writer who has only ever gone first', () => {
    const lines = [line({ position: 1, author_id: 'dan' })]
    expect(computeWritingStyle(lines)[0].medianReplyHours).toBeNull()
  })

  it('handles an empty story', () => {
    expect(computeWritingStyle([])).toEqual([])
  })
})

describe('findLongestLine', () => {
  it('picks the line with the most words', () => {
    const lines = [
      line({ position: 1, author_id: 'dan', body: 'a short one' }),
      line({ position: 2, author_id: 'ben', body: 'a b c d e f g h i j' }),
    ]
    expect(findLongestLine(lines)).toEqual({ user_id: 'ben', position: 2, words: 10 })
  })

  it('is null for an empty story', () => {
    expect(findLongestLine([])).toBeNull()
  })
})
