// Ambient decl only — avoids pulling @types/node into the client build just
// for this one test-only assignment. Runs under Node via vitest either way.
declare const process: { env: Record<string, string> }
process.env.TZ = 'Europe/London'

import { describe, expect, it } from 'vitest'
import { bucketByPeakTime, describePeak } from './peakTimes'

// Fixed offsets so local-time bucketing is deterministic regardless of the
// runner's DST state: use UTC and an explicit +00:00, both GMT, safely inside
// winter so Europe/London local time equals UTC.
const at = (iso: string) => `${iso}+00:00`

describe('bucketByPeakTime', () => {
  it('places a morning weekday line in the right cell', () => {
    // 2026-01-05 is a Monday. 09:00 falls in the Morning band (6-12).
    const grid = bucketByPeakTime([at('2026-01-05T09:00:00')])
    expect(grid[0][1]).toBe(1) // Monday, Morning
    expect(grid.flat().reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('buckets every day of the week to its own row, Monday first', () => {
    const grid = bucketByPeakTime([
      at('2026-01-05T12:00:00'), // Mon, Afternoon
      at('2026-01-11T12:00:00'), // Sun, Afternoon
    ])
    expect(grid[0][2]).toBe(1)
    expect(grid[6][2]).toBe(1)
  })

  it('buckets all four time bands correctly', () => {
    const grid = bucketByPeakTime([
      at('2026-01-05T02:00:00'), // Night
      at('2026-01-05T08:00:00'), // Morning
      at('2026-01-05T14:00:00'), // Afternoon
      at('2026-01-05T20:00:00'), // Evening
    ])
    expect(grid[0]).toEqual([1, 1, 1, 1])
  })

  it('ignores an unparseable timestamp rather than throwing', () => {
    expect(() => bucketByPeakTime(['not a date'])).not.toThrow()
    expect(bucketByPeakTime(['not a date']).flat().reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('handles no lines at all', () => {
    const grid = bucketByPeakTime([])
    expect(grid.flat().every((n) => n === 0)).toBe(true)
  })
})

describe('describePeak', () => {
  it('names the single busiest day and band', () => {
    const timestamps = [
      at('2026-01-02T20:00:00'), // Fri Evening
      at('2026-01-09T20:00:00'), // Fri Evening
      at('2026-01-16T20:00:00'), // Fri Evening
      at('2026-01-05T09:00:00'), // Mon Morning
      at('2026-01-12T09:00:00'), // Mon Morning
      at('2026-01-06T14:00:00'), // Tue Afternoon
    ]
    const grid = bucketByPeakTime(timestamps)
    expect(describePeak(grid)).toBe('Most lines land on Friday evenings.')
  })

  it('says nothing with too little data to mean anything', () => {
    const grid = bucketByPeakTime([at('2026-01-05T09:00:00')])
    expect(describePeak(grid)).toBeNull()
  })

  it('says nothing for an empty grid', () => {
    expect(describePeak(bucketByPeakTime([]))).toBeNull()
  })
})
