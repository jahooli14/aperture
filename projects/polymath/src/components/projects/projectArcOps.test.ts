import { describe, it, expect } from 'vitest'
import { daysUntil, targetDateLine, shortDate } from './projectArcOps'

describe('daysUntil', () => {
  it('counts forward to a future date', () => {
    expect(daysUntil('2026-01-15', new Date('2026-01-01T09:00:00'))).toBe(14)
  })

  it('counts negative for a date already past', () => {
    expect(daysUntil('2026-01-01', new Date('2026-01-15T09:00:00'))).toBe(-14)
  })

  it('is zero on the day itself, whatever the time', () => {
    expect(daysUntil('2026-01-01', new Date('2026-01-01T23:59:00'))).toBe(0)
  })
})

describe('targetDateLine', () => {
  it('says today plainly', () => {
    expect(targetDateLine(0)).toBe('Target date is today.')
  })

  it('counts down, singular and plural', () => {
    expect(targetDateLine(1)).toBe('1 day until the target date.')
    expect(targetDateLine(14)).toBe('14 days until the target date.')
  })

  it('says overdue rather than a negative number, singular and plural', () => {
    expect(targetDateLine(-1)).toBe('1 day past the target date.')
    expect(targetDateLine(-14)).toBe('14 days past the target date.')
  })
})

describe('shortDate', () => {
  it('reads as day and month, no year', () => {
    // Midday UTC so the assertion holds regardless of the test runner's
    // own timezone offset.
    expect(shortDate('2026-03-05T12:00:00.000Z')).toBe('5 Mar')
  })
})
