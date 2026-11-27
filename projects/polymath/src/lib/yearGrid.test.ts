import { describe, it, expect } from 'vitest'
import { yearGrid, shortDay, monthName } from './yearGrid'

describe('yearGrid', () => {
  it('starts weeks on Monday and pads both ends to whole weeks', () => {
    const g = yearGrid(['2026-11-25'], '2026-11-25', '2026-11-27') // Wed..Fri
    expect(g.length % 7).toBe(0)
    expect(g.slice(0, 2).every(c => c.day === null)).toBe(true)
    expect(g[2]).toEqual({ day: '2026-11-25', on: true })
    expect(g[3].on).toBe(false)
  })
  it('has one cell per day in the window', () => {
    const g = yearGrid([], '2026-01-01', '2026-12-31')
    expect(g.filter(c => c.day).length).toBe(365)
  })
  it('names days and months in plain English', () => {
    expect(shortDay('2026-10-03')).toBe('3 Oct')
    expect(monthName('2026-03')).toBe('March')
  })
})
