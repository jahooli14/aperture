import { describe, expect, it } from 'vitest'
import { gapLabel, hoursLeftLabel, initials, replyTimeLabel } from './format'

const at = (iso: string) => new Date(iso).toISOString()

describe('gapLabel', () => {
  it('stays quiet about a normal back-and-forth', () => {
    expect(gapLabel(at('2026-01-01T09:00:00Z'), at('2026-01-01T18:00:00Z'))).toBeNull()
    expect(gapLabel(at('2026-01-01T09:00:00Z'), at('2026-01-03T09:00:00Z'))).toBeNull()
  })

  it('names a gap of a few days', () => {
    expect(gapLabel(at('2026-01-01T09:00:00Z'), at('2026-01-05T09:00:00Z'))).toBe('4 days later')
  })

  it('rounds to weeks, months and years as the silence grows', () => {
    expect(gapLabel(at('2026-01-01T09:00:00Z'), at('2026-01-22T09:00:00Z'))).toBe('3 weeks later')
    expect(gapLabel(at('2026-01-01T09:00:00Z'), at('2026-04-01T09:00:00Z'))).toBe('3 months later')
    expect(gapLabel(at('2025-01-01T09:00:00Z'), at('2026-01-01T09:00:00Z'))).toBe('1 year later')
  })

  it('says month and year in the singular where it should', () => {
    expect(gapLabel(at('2026-01-01T09:00:00Z'), at('2026-03-05T09:00:00Z'))).toBe('2 months later')
    expect(gapLabel(at('2024-01-01T09:00:00Z'), at('2026-01-01T09:00:00Z'))).toBe('2 years later')
  })

  it('ignores lines that arrive out of order or with bad dates', () => {
    expect(gapLabel(at('2026-01-05T09:00:00Z'), at('2026-01-01T09:00:00Z'))).toBeNull()
    expect(gapLabel('not a date', at('2026-01-01T09:00:00Z'))).toBeNull()
  })
})

describe('hoursLeftLabel', () => {
  it('names an hour count', () => {
    expect(hoursLeftLabel(6)).toBe('6h left')
    expect(hoursLeftLabel(1)).toBe('1h left')
  })

  it('says "under an hour" rather than "0h left"', () => {
    expect(hoursLeftLabel(0)).toBe('under an hour')
  })
})

describe('replyTimeLabel', () => {
  it('says "under an hour" for anything below one', () => {
    expect(replyTimeLabel(0.4)).toBe('under an hour')
  })

  it('rounds to hours under most of a day', () => {
    expect(replyTimeLabel(4.2)).toBe('4h')
    expect(replyTimeLabel(15)).toBe('15h')
  })

  it('switches to days once it is genuinely a day or more', () => {
    expect(replyTimeLabel(25)).toBe('1 day')
    expect(replyTimeLabel(40)).toBe('2 days')
  })
})

describe('initials', () => {
  it('uses one letter for a single name and two for a full one', () => {
    expect(initials('Dan')).toBe('D')
    expect(initials('Dan Horgan')).toBe('DH')
  })

  it('copes with empty or spacey input', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})
