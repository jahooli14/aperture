import { describe, it, expect } from 'vitest'
import { preserveServerOwned } from './server-owned-metadata'

describe('preserveServerOwned', () => {
  const season = { role: 'main', until: '2026-12-25', label: 'Christmas' }
  const themes = [{ text: 'Every chapter in the new voice', at: '2026-10-12T00:00:00Z' }]

  it("keeps the database's season and themes when a stale client sends none", () => {
    const out = preserveServerOwned({ tasks: [1], end_goal: 'x' }, { season, themes, tasks: [] })
    expect(out.season).toEqual(season)
    expect(out.themes).toEqual(themes)
    expect(out.tasks).toEqual([1]) // what the client legitimately edits goes through
    expect(out.end_goal).toBe('x')
  })

  it("ignores a stale client's old copy of them", () => {
    const out = preserveServerOwned({ season: { role: 'main', until: '2026-01-01', label: 'Old' }, themes: [] }, { season, themes })
    expect(out.season).toEqual(season)
    expect(out.themes).toEqual(themes)
  })

  it('does not invent them where the database has none', () => {
    const out = preserveServerOwned({ season, themes }, { tasks: [] })
    expect('season' in out).toBe(false)
    expect('themes' in out).toBe(false)
  })

  it('copes with no existing metadata', () => {
    expect(preserveServerOwned({ a: 1 }, null)).toEqual({ a: 1 })
  })
})
