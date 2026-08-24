import { describe, it, expect } from 'vitest'
import { getTheme, PROJECT_COLORS } from './projectTheme'

describe('getTheme — colour comes from the label first', () => {
  it('uses a label that has its own palette entry', () => {
    expect(getTheme('creative', 'The Album', ['music']).rgb).toBe(PROJECT_COLORS.music)
  })

  it('prefers the label over the legacy type, which says nothing', () => {
    // Every project in this app is "creative" — the label is the real signal.
    const labelled = getTheme('creative', 'The Album', ['music'])
    const unlabelled = getTheme('creative', 'The Album')
    expect(labelled.rgb).toBe(PROJECT_COLORS.music)
    expect(labelled.rgb).not.toBe(unlabelled.rgb)
  })

  it('scans past labels with no palette entry to find one that has it', () => {
    expect(getTheme('', 'Speaker Cabinet', ['woodwork', 'music']).rgb).toBe(PROJECT_COLORS.music)
  })

  it('is case and whitespace tolerant, since labels arrive from the model', () => {
    expect(getTheme('', 'x', ['  Music  ']).rgb).toBe(PROJECT_COLORS.music)
  })
})

describe('getTheme — labels with no palette entry', () => {
  it('gives every project sharing a label the same colour', () => {
    const a = getTheme('', 'Oak Bench', ['woodwork'])
    const b = getTheme('', 'Walnut Shelf', ['woodwork'])
    expect(a.rgb).toBe(b.rgb)
  })

  it('separates different labels, so the page reads as groups', () => {
    const wood = getTheme('', 'Same Title', ['woodwork'])
    const ceramics = getTheme('', 'Same Title', ['ceramics'])
    expect(wood.rgb).not.toBe(ceramics.rgb)
  })

  it('never resolves to the grey default', () => {
    expect(getTheme('', 'Oak Bench', ['woodwork']).rgb).not.toBe(PROJECT_COLORS.default)
  })
})

describe('getTheme — falling back when there are no labels', () => {
  it('uses the legacy type when it maps to a palette entry', () => {
    expect(getTheme('tech', 'Some Tool').rgb).toBe(PROJECT_COLORS.tech)
  })

  it('hashes the title when neither label nor type helps', () => {
    const a = getTheme('', 'Consistent Title')
    const b = getTheme('', 'Consistent Title')
    expect(a.rgb).toBe(b.rgb)
    expect(a.rgb).toBeTruthy()
  })

  it('tolerates an empty label array rather than treating it as a label', () => {
    expect(getTheme('tech', 'Some Tool', []).rgb).toBe(PROJECT_COLORS.tech)
  })

  it('still returns a usable theme with no type and no labels', () => {
    const theme = getTheme('', 'Untitled')
    expect(theme.rgb).toBeTruthy()
    expect(theme.text).toMatch(/^rgb\(/)
  })
})
