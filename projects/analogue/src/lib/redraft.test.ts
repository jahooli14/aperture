import { describe, it, expect } from 'vitest'
import { diffWords } from './diff'
import { applyRewrite, locateSelection, passageContextWindow } from './rewrite'
import { applyMask, getStorageText } from './mask'

const join = (parts: { type: string; value: string }[], skip: string) =>
  parts.filter(p => p.type !== skip).map(p => p.value).join('')

describe('diffWords', () => {
  it('reconstructs both sides exactly (no dropped or duplicated text)', () => {
    const before = 'The old man walked slowly into the quiet, empty room.'
    const after = 'The old man strode into the silent room.'
    const parts = diffWords(before, after)
    // Dropping additions yields the original; dropping deletions yields the rewrite.
    expect(join(parts, 'add')).toBe(before)
    expect(join(parts, 'del')).toBe(after)
  })

  it('marks everything same when unchanged', () => {
    const s = 'Nothing changes here at all.'
    expect(diffWords(s, s).every(p => p.type === 'same')).toBe(true)
  })

  it('handles pure insertion and pure deletion', () => {
    expect(join(diffWords('', 'brand new line'), 'add')).toBe('')
    expect(join(diffWords('about to vanish', ''), 'del')).toBe('')
  })
})

describe('applyRewrite', () => {
  it('preserves text outside the selection', () => {
    const base = 'Alpha beta gamma delta epsilon'
    const start = base.indexOf('gamma')
    const end = start + 'gamma'.length
    const { displayProse } = applyRewrite(base, start, end, 'GAMMA', '', false)
    expect(displayProse).toBe('Alpha beta GAMMA delta epsilon')
  })

  it('round-trips through mask mode: storage keeps the real name', () => {
    const realName = 'Sdebastian'
    const storage = 'Sebastian woke. Sebastian ran. Then he stopped.'
    const display = applyMask(storage, realName, true) // no match -> unchanged here
    // Use a name that is actually present:
    const storage2 = 'Sebastian woke. Sebastian ran.'
    const name = 'Sebastian'
    const display2 = applyMask(storage2, name, true)
    expect(display2).toBe('YYYY woke. YYYY ran.')
    const sel = display2.indexOf('ran')
    const { storageProse } = applyRewrite(
      display2, sel, sel + 3, 'sprinted', name, true
    )
    // The mask placeholder must be converted back to the real name on save.
    expect(storageProse).toBe('Sebastian woke. Sebastian sprinted.')
    expect(storageProse.includes('YYYY')).toBe(false)
    expect(display).toBe(storage) // sanity: applyMask no-ops without a match
  })

  it('clamps out-of-range offsets instead of corrupting text', () => {
    const base = 'short text'
    const { displayProse } = applyRewrite(base, 5, 999, ' replaced', '', false)
    expect(displayProse).toBe('short replaced')
  })
})

describe('locateSelection', () => {
  const prose = 'The harbor was cold. The harbor was loud. A gull cried over the long grey water.'

  it('rejects selections that are too short to be safe', () => {
    expect(locateSelection(prose, 'A')).toBeNull()
    expect(locateSelection(prose, 'gull')).not.toBeNull()
  })

  it('returns exact offsets for a unique selection', () => {
    const loc = locateSelection(prose, 'A gull cried over the long grey water.')
    expect(loc).not.toBeNull()
    expect(prose.slice(loc!.start, loc!.end)).toBe('A gull cried over the long grey water.')
  })

  it('refuses an ambiguous short selection but allows a long unique-enough one', () => {
    expect(locateSelection(prose, 'The harbor')).toBeNull() // appears twice, short
    const loc = locateSelection(prose, 'A gull cried over the long grey water.')
    expect(loc).not.toBeNull()
  })
})

describe('passageContextWindow', () => {
  it('returns the whole scene when it is short', () => {
    const s = 'A short scene that fits.'
    expect(passageContextWindow(s, 'short')).toBe(s)
  })

  it('centres the window on the passage for a long scene', () => {
    const lead = 'L'.repeat(3000)
    const tail = 'T'.repeat(3000)
    const passage = 'THE NEEDLE IN THE HAYSTACK'
    const full = lead + passage + tail
    const ctx = passageContextWindow(full, passage, 500)
    expect(ctx.includes(passage)).toBe(true)
    expect(ctx.length).toBeLessThan(full.length)
    expect(ctx.startsWith('…')).toBe(true)
    expect(ctx.endsWith('…')).toBe(true)
  })

  it('falls back to the head when the passage is not found', () => {
    const full = 'X'.repeat(5000)
    const ctx = passageContextWindow(full, 'not here', 500)
    expect(ctx.length).toBeLessThan(full.length)
    expect(ctx.endsWith('…')).toBe(true)
  })
})

describe('mask round-trip invariant', () => {
  it('getStorageText reverses applyMask when no literal placeholder exists', () => {
    const name = 'Marlowe'
    const storage = 'Marlowe lit a cigarette. Marlowe waited.'
    const display = applyMask(storage, name, true)
    expect(getStorageText(display, name, true)).toBe(storage)
  })

  it('is a no-op when masking is disabled', () => {
    const s = 'Marlowe stayed Marlowe.'
    expect(applyMask(s, 'Marlowe', false)).toBe(s)
    expect(getStorageText(s, 'Marlowe', false)).toBe(s)
  })
})
