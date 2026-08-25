import { describe, expect, it } from 'vitest'
import { countWords, summarise, type StatLine } from './stats.js'

function line(overrides: Partial<StatLine> & { position: number }): StatLine {
  return {
    author_id: 'dan',
    body: 'A line of the story.',
    created_at: '2026-01-01T09:00:00.000Z',
    ...overrides,
  }
}

describe('countWords', () => {
  it('counts hyphenated and apostrophed words as one', () => {
    expect(countWords("Pasco's faux pet echidna")).toBe(4)
    expect(countWords('dazzle-patterned commuter bike')).toBe(3)
  })

  it('ignores punctuation and whitespace', () => {
    expect(countWords('  Detroit, Detroit.  ')).toBe(2)
    expect(countWords('   ')).toBe(0)
  })
})

describe('summarise', () => {
  const lines: StatLine[] = [
    line({ position: 1, author_id: 'dan', body: 'one two three', created_at: '2026-01-01T09:00:00.000Z' }),
    line({ position: 2, author_id: 'ben', body: 'four five', created_at: '2026-01-02T09:00:00.000Z' }),
    line({
      position: 3,
      author_id: 'dan',
      body: 'six',
      created_at: '2026-01-12T09:00:00.000Z',
      chapter_title: 'Chapter 2',
    }),
  ]

  it('totals lines and words', () => {
    const stats = summarise(lines, '2026-01-14T09:00:00.000Z')
    expect(stats.lineCount).toBe(3)
    expect(stats.wordCount).toBe(6)
    expect(stats.averageWordsPerLine).toBe(2)
  })

  it('tallies per author, busiest first', () => {
    const stats = summarise(lines, '2026-01-14T09:00:00.000Z')
    expect(stats.authors[0]).toEqual({ user_id: 'dan', lines: 2, words: 4 })
    expect(stats.authors[1]).toEqual({ user_id: 'ben', lines: 1, words: 2 })
  })

  it('collects chapter markers with their position', () => {
    expect(summarise(lines).chapters).toEqual([{ title: 'Chapter 2', position: 3 }])
  })

  it('measures the longest silence between lines', () => {
    expect(summarise(lines, '2026-01-14T09:00:00.000Z').longestGapDays).toBe(10)
  })

  it('reports how long it has been running and how quiet it has gone', () => {
    const stats = summarise(lines, '2026-01-14T09:00:00.000Z')
    expect(stats.daysRunning).toBe(13)
    expect(stats.daysSinceLastLine).toBe(2)
  })

  it('reads lines in position order, not the order given', () => {
    const shuffled = [lines[2], lines[0], lines[1]]
    expect(summarise(shuffled).chapters).toEqual([{ title: 'Chapter 2', position: 3 }])
    expect(summarise(shuffled).startedAt).toBe('2026-01-01T09:00:00.000Z')
  })

  it('handles a story with no lines yet', () => {
    const stats = summarise([])
    expect(stats.lineCount).toBe(0)
    expect(stats.startedAt).toBeNull()
    expect(stats.daysSinceLastLine).toBeNull()
    expect(stats.averageWordsPerLine).toBe(0)
  })
})
