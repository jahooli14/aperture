import { describe, it, expect } from 'vitest'
import { parseUpToSpeed, isFresh, readUpToSpeed } from './up-to-speed'
import type { Evidence } from './session-grounding'

const evidence: Evidence[] = [
  { id: 'N1', label: 'note, 1 Sep 2026', text: 'Poured the second canvas. The cells came out too small, need more silicone or a thinner mix?' },
  { id: 'N2', label: 'session note, 20 Aug 2026', text: 'Mixed the medium and tested it on card. Tipping works better than swiping.' },
]
const now = new Date('2026-10-12T00:00:00Z')

describe('parseUpToSpeed', () => {
  it('keeps cited, grounded lines', () => {
    const raw = JSON.stringify({
      what: 'Paintings made by pouring paint and tipping it.',
      where: { text: 'You poured the second canvas.', from: 'N1' },
      open: [{ text: 'Whether the cells need more silicone or a thinner mix.', from: 'N1' }],
    })
    const out = parseUpToSpeed(raw, evidence, 'Paint pouring', '2026-09-01T00:00:00Z', now)
    expect(out?.where).toEqual({ text: 'You poured the second canvas.', from: 'note, 1 Sep 2026' })
    expect(out?.open).toHaveLength(1)
    expect(out?.what).toContain('pouring')
    expect(out?.basis_at).toBe('2026-09-01T00:00:00Z')
  })

  it('drops a line that names something nobody said', () => {
    const raw = JSON.stringify({
      where: { text: 'You bought Floetrol from Hobbycraft.', from: 'N1' },
      open: [],
    })
    expect(parseUpToSpeed(raw, evidence, 'Paint pouring', null, now)).toBeNull()
  })

  it('drops a line whose citation does not support it', () => {
    const raw = JSON.stringify({ where: { text: 'You poured the second canvas.', from: 'N2' }, open: [] })
    expect(parseUpToSpeed(raw, evidence, 'Paint pouring', null, now)).toBeNull()
  })

  it('returns null on junk', () => {
    expect(parseUpToSpeed('nope', evidence, 'x', null, now)).toBeNull()
  })
})

describe('caching', () => {
  it('is fresh only while the newest material is unchanged', () => {
    const cached = readUpToSpeed({ up_to_speed: { what: null, where: { text: 'a', from: 'b' }, open: [], basis_at: '2026-09-01', built_at: '2026-10-01' } })
    expect(isFresh(cached, '2026-09-01')).toBe(true)
    expect(isFresh(cached, '2026-10-05')).toBe(false)
    expect(isFresh(null, '2026-09-01')).toBe(false)
  })
})
