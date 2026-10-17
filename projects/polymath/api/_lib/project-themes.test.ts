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


import { materialSignature, parseThemeRefresh, buildThemesRefreshPrompt, readThemesUpdate } from './project-themes.js'

describe('keeping the lines in step with the notes', () => {
  const ev = [
    { id: 'N1', label: 'note, 17 Oct', text: 'Pasted the rewrite comments into Claude and the voice is much closer now' },
    { id: 'N2', label: 'note, 2 Oct', text: 'Do the full trim before anything else' },
  ]
  const current = ['Do the full trim', 'Check length and structure']

  it('keeps a current line without a citation and takes a new one that cites a real row', () => {
    const raw = JSON.stringify({ themes: [
      { text: 'Do the full trim', from: 'KEPT' },
      { text: 'The voice is much closer now', from: 'N1' },
    ] })
    expect(parseThemeRefresh(raw, ev, 'Going Analogue', current)).toEqual(['Do the full trim', 'The voice is much closer now'])
  })

  it('drops a new line that cites nothing, a row that does not say it, or names something new', () => {
    const raw = JSON.stringify({ themes: [
      { text: 'Get an agent by March', from: 'KEPT' },
      { text: 'Sell the film rights', from: 'N1' },
      { text: 'Send it to Harper Collins', from: 'N1' },
    ] })
    expect(parseThemeRefresh(raw, ev, 'Going Analogue', current)).toEqual([])
  })

  it('reads nothing from a broken reply', () => {
    expect(parseThemeRefresh('not json', ev, 't', current)).toEqual([])
  })

  it('the fingerprint changes when a note lands, and not otherwise', () => {
    const a = [{ text: 'one', at: '2026-10-01T00:00:00Z' }]
    const b = [{ text: 'two', at: '2026-10-17T00:00:00Z' }, ...a]
    expect(materialSignature(a)).toBe(materialSignature([...a]))
    expect(materialSignature(b)).not.toBe(materialSignature(a))
  })

  it('shows the lines it was given and asks for the same lines when nothing changed', () => {
    const p = buildThemesRefreshPrompt({ title: 'Going Analogue', description: null, current, evidence: ev })
    expect(p).toContain('- Do the full trim')
    expect(p).toContain('return the same lines')
  })

  it('reads the update marker, and only a well-formed one', () => {
    expect(readThemesUpdate({ themes_update: { at: '2026-10-17T10:00:00Z', previous: ['a', 'b'] } })).toEqual({ at: '2026-10-17T10:00:00Z', previous: ['a', 'b'] })
    expect(readThemesUpdate({ themes_update: { at: 5 } })).toBeNull()
    expect(readThemesUpdate({})).toBeNull()
  })
})
