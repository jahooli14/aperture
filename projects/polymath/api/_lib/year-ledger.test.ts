import { describe, it, expect } from 'vitest'
import { buildYear, windowStart } from './year-ledger'

const P = [{ id: 'a', title: 'Going Analogue' }, { id: 'b', title: 'DJ mixes' }]
const at = (day: string) => `${day}T10:00:00Z`
const now = new Date('2026-11-27T09:00:00Z')

describe('buildYear', () => {
  it('counts each day once per project and overall', () => {
    const y = buildYear([
      { project_id: 'a', at: at('2026-11-01') }, { project_id: 'a', at: '2026-11-01T20:00:00Z' },
      { project_id: 'b', at: at('2026-11-01') }, { project_id: 'b', at: at('2026-11-05') },
    ], P, now)
    expect(y.days).toEqual(['2026-11-01', '2026-11-05'])
    expect(y.projects.map(p => [p.title, p.days])).toEqual([['DJ mixes', 2], ['Going Analogue', 1]])
  })

  it('drops traces outside the year, in the future, or on unknown projects', () => {
    const y = buildYear([
      { project_id: 'a', at: at('2025-11-01') }, { project_id: 'a', at: at('2026-12-30') },
      { project_id: 'zzz', at: at('2026-11-02') }, { project_id: 'a', at: at(windowStart('2026-11-27')) },
    ], P, now)
    expect(y.days).toEqual([windowStart('2026-11-27')])
  })

  it('finds a comeback after a long gap, not a short one', () => {
    const y = buildYear([
      { project_id: 'a', at: at('2026-03-01') }, { project_id: 'a', at: at('2026-03-10') },
      { project_id: 'a', at: at('2026-05-01') }, { project_id: 'b', at: at('2026-06-01') }, { project_id: 'b', at: at('2026-06-20') },
    ], P, now)
    expect(y.comebacks).toEqual([{ project_id: 'a', title: 'Going Analogue', day: '2026-05-01', gap: 52 }])
  })

  it('names the busiest month only when it means something', () => {
    expect(buildYear([{ project_id: 'a', at: at('2026-03-01') }], P, now).busiest_month).toBeNull()
    const y = buildYear([
      { project_id: 'a', at: at('2026-03-01') }, { project_id: 'a', at: at('2026-03-04') }, { project_id: 'b', at: at('2026-04-04') },
    ], P, now)
    expect(y.busiest_month).toEqual({ month: '2026-03', days: 2 })
  })

  it('uses the local day, so a late note belongs to the evening it was said', () => {
    const y = buildYear([{ project_id: 'a', at: '2026-11-02T01:30:00Z' }], P, now, 300) // UTC-5
    expect(y.days).toEqual(['2026-11-01'])
  })

  it('is empty, not broken, with nothing', () => {
    const y = buildYear([], P, now)
    expect(y.days).toEqual([]); expect(y.projects).toEqual([]); expect(y.busiest_month).toBeNull()
  })
})
