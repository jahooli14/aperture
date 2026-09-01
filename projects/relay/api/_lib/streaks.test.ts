import { describe, expect, it } from 'vitest'
import { computeStreak, localDateKey, localHour } from './streaks.js'

const at = (day: string, time = '12:00:00') => `${day}T${time}.000Z`

describe('computeStreak', () => {
  it('has nothing to report for an empty story', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0, activeToday: false })
  })

  it('counts a single day as a streak of one', () => {
    expect(computeStreak([at('2026-08-20')], at('2026-08-20', '18:00:00'))).toEqual({
      current: 1, longest: 1, activeToday: true,
    })
  })

  it('extends the streak across consecutive days', () => {
    const lines = [at('2026-08-18'), at('2026-08-19'), at('2026-08-20')]
    expect(computeStreak(lines, at('2026-08-20', '20:00:00'))).toEqual({
      current: 3, longest: 3, activeToday: true,
    })
  })

  it('keeps the streak alive on a day nothing has been written yet', () => {
    // Wrote yesterday, nothing today so far — still alive, just not "active today".
    const lines = [at('2026-08-18'), at('2026-08-19')]
    expect(computeStreak(lines, at('2026-08-20', '09:00:00'))).toEqual({
      current: 2, longest: 2, activeToday: false,
    })
  })

  it('breaks the streak once a full day is skipped', () => {
    const lines = [at('2026-08-17'), at('2026-08-18')]
    expect(computeStreak(lines, at('2026-08-20', '09:00:00'))).toEqual({
      current: 0, longest: 2, activeToday: false,
    })
  })

  it('remembers the longest run even after the streak has since broken', () => {
    const lines = [at('2026-08-01'), at('2026-08-02'), at('2026-08-03'), at('2026-08-10')]
    expect(computeStreak(lines, at('2026-08-10', '12:00:00'))).toEqual({
      current: 1, longest: 3, activeToday: true,
    })
  })

  it('counts multiple lines on the same UTC day once', () => {
    const lines = [at('2026-08-20', '08:00:00'), at('2026-08-20', '20:00:00'), at('2026-08-19')]
    expect(computeStreak(lines, at('2026-08-20', '21:00:00')).current).toBe(2)
  })

  it('does not care whether the input is sorted', () => {
    const sorted = [at('2026-08-18'), at('2026-08-19'), at('2026-08-20')]
    const shuffled = [sorted[2], sorted[0], sorted[1]]
    expect(computeStreak(shuffled, at('2026-08-20', '18:00:00'))).toEqual(
      computeStreak(sorted, at('2026-08-20', '18:00:00'))
    )
  })

  it('matches the seeded story: a five-month gap breaks the streak, recent days do not', () => {
    // 10 Mar 2026, then nothing until 6 Aug 2026.
    const lines = [at('2026-03-10'), at('2026-08-06'), at('2026-08-07')]
    const result = computeStreak(lines, at('2026-08-07', '18:00:00'))
    expect(result.current).toBe(2)
    expect(result.longest).toBe(2)
  })
})

describe('localHour', () => {
  it('reads the hour in a fixed-offset zone', () => {
    // 17:30 UTC == 18:30 in Europe/London during BST (UTC+1).
    expect(localHour(new Date('2026-08-15T17:30:00Z'), 'Europe/London')).toBe(18)
  })

  it('reflects GMT in winter, one hour behind BST for the same UTC instant', () => {
    expect(localHour(new Date('2026-01-15T18:00:00Z'), 'Europe/London')).toBe(18)
    expect(localHour(new Date('2026-08-15T18:00:00Z'), 'Europe/London')).toBe(19)
  })

  it('handles a large positive offset', () => {
    expect(localHour(new Date('2026-08-15T10:00:00Z'), 'Pacific/Auckland')).toBe(22)
  })
})

describe('localDateKey', () => {
  it('can be a different calendar date from UTC near midnight', () => {
    // 23:30 UTC on the 14th is already the 15th in Auckland (UTC+12).
    expect(localDateKey(new Date('2026-08-14T23:30:00Z'), 'Pacific/Auckland')).toBe('2026-08-15')
    expect(localDateKey(new Date('2026-08-14T23:30:00Z'), 'UTC')).toBe('2026-08-14')
  })
})
