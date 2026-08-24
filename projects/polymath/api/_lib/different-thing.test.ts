import { describe, it, expect } from 'vitest'
import { isDifferentThingDoneThisMonth, shouldNudgeDifferentThing, DIFFERENT_THING_NUDGE_DAY } from './different-thing.js'

describe('isDifferentThingDoneThisMonth', () => {
  const now = new Date('2026-08-24T00:00:00Z')

  it('is false with no sessions', () => {
    expect(isDifferentThingDoneThisMonth([], now)).toBe(false)
  })

  it('is true when a different-thing session happened this month', () => {
    const sessions = [{ source: 'different-thing', started_at: '2026-08-05T00:00:00Z' }]
    expect(isDifferentThingDoneThisMonth(sessions, now)).toBe(true)
  })

  it('is false when the different-thing session was last month', () => {
    const sessions = [{ source: 'different-thing', started_at: '2026-07-30T00:00:00Z' }]
    expect(isDifferentThingDoneThisMonth(sessions, now)).toBe(false)
  })

  it('ignores sessions of other sources', () => {
    const sessions = [{ source: 'live', started_at: '2026-08-05T00:00:00Z' }]
    expect(isDifferentThingDoneThisMonth(sessions, now)).toBe(false)
  })
})

describe('shouldNudgeDifferentThing', () => {
  it('never nudges once done, regardless of date', () => {
    const lateMonth = new Date('2026-08-28T00:00:00Z')
    expect(shouldNudgeDifferentThing(true, lateMonth)).toBe(false)
  })

  it('does not nudge early in the month even if not done', () => {
    const earlyMonth = new Date('2026-08-03T00:00:00Z')
    expect(shouldNudgeDifferentThing(false, earlyMonth)).toBe(false)
  })

  it('nudges from day 20 onward if not done', () => {
    const day20 = new Date(`2026-08-${DIFFERENT_THING_NUDGE_DAY}T00:00:00Z`)
    expect(shouldNudgeDifferentThing(false, day20)).toBe(true)
  })

  it('does not nudge the day before the threshold', () => {
    const dayBefore = new Date('2026-08-19T00:00:00Z')
    expect(shouldNudgeDifferentThing(false, dayBefore)).toBe(false)
  })
})
