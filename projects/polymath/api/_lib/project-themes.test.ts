import { describe, it, expect } from 'vitest'
import { normalizeThemes, parseThemeDraft, readThemes, isActivelyWorked, MAX_THEMES } from './project-themes'
import type { Evidence } from './session-grounding'

const evidence: Evidence[] = [
  { id: 'N1', label: 'note, 10 Oct 2026', text: 'Rewrote chapter three. Every chapter has to be in the new voice now, not mine.' },
  { id: 'N2', label: 'note, 2 Oct 2026', text: "The ending still doesn't land. She explains the letters and it kills it." },
]

describe('normalizeThemes', () => {
  it('trims, de-duplicates and caps', () => {
    const out = normalizeThemes(['  New voice  ', 'new voice', '', 'Ending', 'Cut explaining', 'Fourth'], [])
    expect(out.map(t => t.text)).toEqual(['New voice', 'Ending', 'Cut explaining'])
    expect(out).toHaveLength(MAX_THEMES)
  })

  it('keeps the date of a theme whose wording did not change', () => {
    const prev = [{ text: 'New voice', at: '2026-09-21T00:00:00.000Z' }]
    const out = normalizeThemes(['New voice', 'Ending'], prev, new Date('2026-10-12T00:00:00Z'))
    expect(out[0].at).toBe('2026-09-21T00:00:00.000Z')
    expect(out[1].at).toBe('2026-10-12T00:00:00.000Z')
  })

  it('reads nothing from junk', () => {
    expect(normalizeThemes('nope', [])).toEqual([])
    expect(readThemes({ themes: [{ text: '' }, { nope: 1 }] })).toEqual([])
  })
})

describe('parseThemeDraft', () => {
  it('keeps a theme that cites a row sharing its words', () => {
    const raw = JSON.stringify({ themes: [{ text: 'Every chapter in the new voice', from: 'N1' }] })
    expect(parseThemeDraft(raw, evidence, 'Going analog')).toEqual(['Every chapter in the new voice'])
  })

  it('drops a theme citing a row that does not support it', () => {
    const raw = JSON.stringify({ themes: [{ text: 'Every chapter in the new voice', from: 'N2' }] })
    expect(parseThemeDraft(raw, evidence, 'Going analog')).toEqual([])
  })

  it('drops a theme naming something nobody said', () => {
    const raw = JSON.stringify({ themes: [{ text: 'Send the ending to Margaret', from: 'N2' }] })
    expect(parseThemeDraft(raw, evidence, 'Going analog')).toEqual([])
  })

  it('drops an uncited theme and survives bad JSON', () => {
    expect(parseThemeDraft(JSON.stringify({ themes: [{ text: 'The ending' }] }), evidence, 'x')).toEqual([])
    expect(parseThemeDraft('not json', evidence, 'x')).toEqual([])
  })
})

describe('isActivelyWorked', () => {
  const now = new Date('2026-10-12T12:00:00Z')
  it('is true within two weeks of the newest date', () => {
    expect(isActivelyWorked(['2026-10-05T00:00:00Z', null], now)).toBe(true)
  })
  it('is false after two weeks or with no dates', () => {
    expect(isActivelyWorked(['2026-09-01T00:00:00Z'], now)).toBe(false)
    expect(isActivelyWorked([null, undefined], now)).toBe(false)
  })
})
