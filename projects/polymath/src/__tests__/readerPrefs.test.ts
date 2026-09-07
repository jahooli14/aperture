import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_PREFS,
  coercePrefs,
  loadPrefs,
  savePrefs,
  typeStyle,
} from '../lib/readerPrefs'

describe('coercePrefs', () => {
  it('falls back to defaults for anything it does not recognise', () => {
    expect(coercePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(coercePrefs('nonsense')).toEqual(DEFAULT_PREFS)
    expect(coercePrefs({ size: 'gigantic', typeface: 'comic' })).toEqual(DEFAULT_PREFS)
  })

  it('keeps the valid fields and repairs only the broken ones', () => {
    expect(coercePrefs({ size: 'large', typeface: 'wrong', looseLines: true })).toEqual({
      ...DEFAULT_PREFS,
      size: 'large',
      looseLines: true,
    })
  })
})

describe('loadPrefs / savePrefs', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips', () => {
    savePrefs({ typeface: 'sans', size: 'xlarge', width: 'wide', looseLines: true })
    expect(loadPrefs()).toEqual({ typeface: 'sans', size: 'xlarge', width: 'wide', looseLines: true })
  })

  it('returns defaults when storage is empty or holds junk', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    localStorage.setItem('aperture.reader.prefs.v1', 'not json')
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
  })
})

describe('typeStyle', () => {
  it('uses the reading face for serif and the body face for sans', () => {
    expect(typeStyle({ ...DEFAULT_PREFS, typeface: 'reading-serif' }).fontFamily)
      .toBe('var(--brand-font-reading)')
    expect(typeStyle({ ...DEFAULT_PREFS, typeface: 'sans' }).fontFamily)
      .toBe('var(--brand-font-body)')
  })

  it('gives bigger text tighter leading, not looser', () => {
    const small = typeStyle({ ...DEFAULT_PREFS, size: 'small' })
    const largest = typeStyle({ ...DEFAULT_PREFS, size: 'xlarge' })
    expect(parseInt(largest.fontSize)).toBeGreaterThan(parseInt(small.fontSize))
    expect(largest.lineHeight).toBeLessThan(small.lineHeight)
  })

  it('adds air when loose lines is on, at every size', () => {
    for (const size of ['small', 'medium', 'large', 'xlarge'] as const) {
      const tight = typeStyle({ ...DEFAULT_PREFS, size })
      const loose = typeStyle({ ...DEFAULT_PREFS, size, looseLines: true })
      expect(loose.lineHeight).toBeGreaterThan(tight.lineHeight)
    }
  })

  it('holds the measure narrow by default and widens only on request', () => {
    expect(typeStyle(DEFAULT_PREFS).maxWidth).toBe('34rem')
    expect(typeStyle({ ...DEFAULT_PREFS, width: 'wide' }).maxWidth).toBe('44rem')
  })

  it('scales the title with the body size', () => {
    const a = typeStyle({ ...DEFAULT_PREFS, size: 'small' })
    const b = typeStyle({ ...DEFAULT_PREFS, size: 'xlarge' })
    expect(parseInt(b.titleSize)).toBeGreaterThan(parseInt(a.titleSize))
  })
})
