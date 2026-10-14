import { describe, it, expect } from 'vitest'
import { seasonLine } from './season'

const meta = (until: string | null, label: string | null = 'Christmas', role = 'main') => ({ season: { role, until, label } }) as never
const now = new Date(2026, 9, 14, 21, 30) // 14 Oct, evening

describe('seasonLine', () => {
  it('weeks when far, days when close, today on the day', () => {
    expect(seasonLine(meta('2026-12-25'), now)).toBe('10 weeks to Christmas')
    expect(seasonLine(meta('2026-10-20'), now)).toBe('6 days to Christmas')
    expect(seasonLine(meta('2026-10-15'), now)).toBe('1 day to Christmas')
    expect(seasonLine(meta('2026-10-14'), now)).toBe('Christmas is today')
  })
  it('says nothing once it is over, with no date, or on a project that is not main', () => {
    expect(seasonLine(meta('2026-10-13'), now)).toBeNull()
    expect(seasonLine(meta(null), now)).toBeNull()
    expect(seasonLine(meta('2026-12-25', 'Christmas', 'also'), now)).toBeNull()
    expect(seasonLine(undefined, now)).toBeNull()
  })
  it('falls back to "the end" without a label', () => {
    expect(seasonLine(meta('2026-10-20', null), now)).toBe('6 days to the end')
  })
})
