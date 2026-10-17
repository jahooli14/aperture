import { describe, it, expect } from 'vitest'
import { aggregateMonthlyMirror, localDay } from './mirror.js'

describe('aggregateMonthlyMirror', () => {
  const projects = [
    { id: 'book', title: 'The book', state: 'mull' },
    { id: 'dj', title: 'DJ set', state: 'live' },
    { id: 'wood', title: 'Deck stand', state: 'mull' },
  ]
  const at = (d: string) => `2026-10-${d}T12:00:00Z`

  it('shows zero days for the live project even with nothing', () => {
    expect(aggregateMonthlyMirror([], projects)).toEqual([{ project_id: 'dj', title: 'DJ set', days: 0, is_live: true }])
  })

  it('drops other projects at zero days -- no guilt wall', () => {
    const rows = aggregateMonthlyMirror([{ project_id: 'dj', at: at('03') }], projects)
    expect(rows).toEqual([{ project_id: 'dj', title: 'DJ set', days: 1, is_live: true }])
  })

  it('counts a day once however many notes landed on it', () => {
    const rows = aggregateMonthlyMirror([
      { project_id: 'dj', at: '2026-10-03T08:00:00Z' },
      { project_id: 'dj', at: '2026-10-03T20:00:00Z' },
      { project_id: 'dj', at: at('04') },
    ], projects)
    expect(rows[0].days).toBe(2)
  })

  it('puts the project that got the most days first', () => {
    const rows = aggregateMonthlyMirror([
      { project_id: 'wood', at: at('01') }, { project_id: 'wood', at: at('02') }, { project_id: 'dj', at: at('03') },
    ], projects)
    expect(rows.map(r => r.project_id)).toEqual(['wood', 'dj'])
  })

  it('ignores a trace with no project or a time that is not a time', () => {
    const rows = aggregateMonthlyMirror([{ project_id: '', at: at('01') }, { project_id: 'wood', at: 'nope' }], projects)
    expect(rows.map(r => r.project_id)).toEqual(['dj'])
  })

  it('puts a late-night note on the day the person lived it', () => {
    // 23:30 UTC on the 3rd is 00:30 on the 4th for someone an hour ahead (offset -60).
    expect(localDay('2026-10-03T23:30:00Z', -60)).toBe('2026-10-04')
    expect(localDay('2026-10-03T23:30:00Z', 0)).toBe('2026-10-03')
  })
})
