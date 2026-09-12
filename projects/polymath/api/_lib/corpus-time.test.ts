import { describe, it, expect } from 'vitest'
import {
  describeTimeline,
  classifyTimeline,
  findSimultaneous,
  findDrift,
  humanDuration,
  monthYear,
  type Capture,
} from './corpus-time.js'
import { motifWords } from './spark-echo.js'

const NOW = new Date('2026-09-12T00:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

describe('describeTimeline', () => {
  it('tells a two-year drip from one afternoon', () => {
    const drip = describeTimeline([ago(700), ago(500), ago(300), ago(100)], NOW)!
    const afternoon = describeTimeline([ago(700), ago(700), ago(699), ago(699)], NOW)!

    expect(drip.count).toBe(afternoon.count)
    expect(drip.spanDays).toBeGreaterThan(500)
    expect(afternoon.spanDays).toBeLessThan(2)
    // Count alone can't separate these. Span does, which is the whole point.
    expect(drip.evenness).toBeGreaterThan(afternoon.evenness)
  })

  it('finds the longest silence', () => {
    const t = describeTimeline([ago(800), ago(780), ago(60)], NOW)!
    expect(Math.round(t.longestGapDays)).toBe(720)
    expect(Math.round(t.quietDays)).toBe(60)
  })

  it('is empty for nothing', () => {
    expect(describeTimeline([], NOW)).toBeNull()
    expect(describeTimeline(['not a date'], NOW)).toBeNull()
  })
})

describe('classifyTimeline', () => {
  const shapeOf = (dates: string[], hasProject?: boolean) =>
    classifyTimeline({ timeline: describeTimeline(dates, NOW)!, hasProject, label: 'x' })?.shape ?? null

  it('names a thing said for years and never built', () => {
    expect(shapeOf([ago(900), ago(600), ago(300), ago(30)], false)).toBe('long_unfinished')
  })

  it('a long silence then a return beats the conviction reading', () => {
    expect(shapeOf([ago(800), ago(700), ago(20)], true)).toBe('return')
  })

  it('years of mentions, still alive, already a project, is a conviction', () => {
    expect(shapeOf([ago(800), ago(500), ago(200), ago(40)], true)).toBe('conviction')
  })

  it('a regular drip that stopped is dateable', () => {
    expect(shapeOf([ago(600), ago(540), ago(480), ago(420)], true)).toBe('went_quiet')
  })

  it('one week two years ago and never again is a burst', () => {
    expect(shapeOf([ago(730), ago(728), ago(726)], true)).toBe('burst')
  })

  it('says nothing about the ordinary case', () => {
    expect(shapeOf([ago(10), ago(5)], true)).toBeNull()
    expect(shapeOf([ago(3)], false)).toBeNull()
  })

  it('puts a real date in every fact', () => {
    const found = classifyTimeline({
      timeline: describeTimeline([ago(900), ago(600), ago(300), ago(30)], NOW)!,
      hasProject: false,
      label: 'x',
    })!
    expect(found.fact).toMatch(/\b(20\d\d)\b/)
  })
})

describe('findSimultaneous', () => {
  const cap = (id: string, projectId: string, days: number): Capture => ({
    id, projectId, text: id, createdAt: ago(days), source: 'thought',
  })

  it('finds two projects on your mind the same week, long ago', () => {
    const pairs = findSimultaneous([cap('a', 'p1', 500), cap('b', 'p2', 498)], NOW)
    expect(pairs).toHaveLength(1)
    expect(Math.round(pairs[0].daysApart)).toBe(2)
  })

  it('ignores two captures on the same project', () => {
    expect(findSimultaneous([cap('a', 'p1', 500), cap('b', 'p1', 499)], NOW)).toHaveLength(0)
  })

  it('ignores projects that keep co-occurring — that is just how they work', () => {
    const pairs = findSimultaneous([
      cap('a', 'p1', 500), cap('b', 'p2', 499),
      cap('c', 'p1', 300), cap('d', 'p2', 299),
    ], NOW)
    expect(pairs).toHaveLength(0)
  })

  it('ignores a coincidence from this month', () => {
    expect(findSimultaneous([cap('a', 'p1', 5), cap('b', 'p2', 4)], NOW)).toHaveLength(0)
  })

  it('ignores captures with no project to be simultaneous across', () => {
    const loose = { ...cap('a', 'p1', 500), projectId: null }
    expect(findSimultaneous([loose, cap('b', 'p2', 499)], NOW)).toHaveLength(0)
  })
})

describe('findDrift', () => {
  it('catches the vocabulary changing over years', () => {
    const drift = findDrift([
      { text: 'an album of finished tracks', createdAt: ago(900) },
      { text: 'the album needs mastering', createdAt: ago(850) },
      { text: 'maybe sketches instead', createdAt: ago(200) },
      { text: 'a series of sketches, unfinished', createdAt: ago(100) },
    ], motifWords)!
    expect(drift.early.join(' ')).toContain('album')
    expect(drift.late.join(' ')).toContain('sketch')
  })

  it('says nothing without a span — that is just one day of wording', () => {
    expect(findDrift([
      { text: 'an album of tracks', createdAt: ago(10) },
      { text: 'sketches instead maybe', createdAt: ago(9) },
      { text: 'more sketches today', createdAt: ago(8) },
      { text: 'sketching again', createdAt: ago(7) },
    ], motifWords)).toBeNull()
  })
})

describe('how a person says a date', () => {
  it('reads back the way someone would say it', () => {
    expect(monthYear(new Date('2023-03-14'))).toBe('March 2023')
    expect(humanDuration(5)).toBe('5 days')
    expect(humanDuration(21)).toBe('3 weeks')
    expect(humanDuration(400)).toBe('13 months')
    expect(humanDuration(900)).toBe('2 years')
  })
})
