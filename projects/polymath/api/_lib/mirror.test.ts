import { describe, it, expect } from 'vitest'
import { aggregateMonthlyMirror, monthStart } from './mirror.js'

describe('aggregateMonthlyMirror', () => {
  const projects = [
    { id: 'book', title: 'The book', state: 'mull' },
    { id: 'dj', title: 'DJ set', state: 'live' },
    { id: 'wood', title: 'Deck stand', state: 'mull' },
  ]

  it('shows zero hours for the live project even with no sessions', () => {
    const rows = aggregateMonthlyMirror([], projects)
    expect(rows).toEqual([{ project_id: 'dj', title: 'DJ set', minutes: 0, is_live: true }])
  })

  it('drops non-live projects at zero minutes -- no guilt wall', () => {
    const sessions = [{ project_id: 'dj', duration_minutes: 120 }]
    const rows = aggregateMonthlyMirror(sessions, projects)
    expect(rows).toEqual([{ project_id: 'dj', title: 'DJ set', minutes: 120, is_live: true }])
  })

  it('shows a non-live project once it has logged minutes', () => {
    const sessions = [
      { project_id: 'dj', duration_minutes: 480 },
      { project_id: 'book', duration_minutes: 0 },
      { project_id: 'wood', duration_minutes: 45 },
    ]
    const rows = aggregateMonthlyMirror(sessions, projects)
    expect(rows.map(r => r.project_id)).toEqual(['dj', 'wood'])
  })

  it('sums multiple sessions on the same project', () => {
    const sessions = [
      { project_id: 'dj', duration_minutes: 60 },
      { project_id: 'dj', duration_minutes: 90 },
    ]
    const rows = aggregateMonthlyMirror(sessions, projects)
    expect(rows[0]).toEqual({ project_id: 'dj', title: 'DJ set', minutes: 150, is_live: true })
  })

  it('sorts by minutes descending', () => {
    const sessions = [
      { project_id: 'wood', duration_minutes: 200 },
      { project_id: 'dj', duration_minutes: 30 },
    ]
    const rows = aggregateMonthlyMirror(sessions, projects)
    expect(rows.map(r => r.project_id)).toEqual(['wood', 'dj'])
  })

  it('ignores sessions with no duration or unknown project_id', () => {
    const sessions = [
      { project_id: 'dj', duration_minutes: null },
      { project_id: '', duration_minutes: 30 },
    ]
    const rows = aggregateMonthlyMirror(sessions, projects)
    expect(rows).toEqual([{ project_id: 'dj', title: 'DJ set', minutes: 0, is_live: true }])
  })

  it('returns an empty mirror when nothing is live and nothing logged', () => {
    const rows = aggregateMonthlyMirror([], [{ id: 'book', title: 'The book', state: 'mull' }])
    expect(rows).toEqual([])
  })
})

describe('monthStart', () => {
  it('returns midnight UTC on the 1st of the given date\'s month', () => {
    const d = new Date('2026-08-24T15:32:00Z')
    expect(monthStart(d).toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })
})
