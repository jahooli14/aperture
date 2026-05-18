import { describe, it, expect } from 'vitest'
import { diffWords } from './diff'
import { applyRewrite, locateSelection, passageContextWindow } from './rewrite'

// Build realistic prose of roughly `words` words.
function prose(words: number): string {
  const bank = 'the quick brown fox jumped over a lazy dog while the river ran cold and the village slept under a thin grey light'.split(' ')
  const out: string[] = []
  for (let i = 0; i < words; i++) {
    out.push(bank[i % bank.length])
    if (i % 18 === 17) out.push('.\n\n')
  }
  return out.join(' ')
}

// A "redrafted" variant: same length, ~15% of words changed.
function redraft(src: string): string {
  return src.split(' ').map((w, i) => (i % 7 === 0 ? w.toUpperCase() : w)).join(' ')
}

const ms = (fn: () => void) => {
  const t = performance.now()
  fn()
  return performance.now() - t
}

describe('redraft performance on book-scale input', () => {
  it('whole-scene word diff stays interactive for a long scene (~4k words)', () => {
    const before = prose(4000)
    const after = redraft(before)
    let parts: unknown[] = []
    const dur = ms(() => { parts = diffWords(before, after) })
    expect(parts.length).toBeGreaterThan(0)
    // Was ~1300ms with a full O(n*m) matrix (froze the UI, ~16M-cell alloc).
    // Bounded diff must keep a long-scene redraft within one interaction.
    // eslint-disable-next-line no-console
    console.log(`whole-scene (4k word) diff: ${dur.toFixed(1)}ms`)
    expect(dur).toBeLessThan(120)
  })

  it('paragraph-scale diff is effectively instant (~250 words)', () => {
    const before = prose(250)
    const after = redraft(before)
    const dur = ms(() => { diffWords(before, after) })
    expect(dur).toBeLessThan(20)
  })

  it('context windowing on a whole 90k-word book is instant', () => {
    const book = prose(90000)
    const passage = book.slice(60000, 60400)
    let ctx = ''
    const dur = ms(() => { ctx = passageContextWindow(book, passage) })
    expect(ctx.includes(passage)).toBe(true)
    expect(dur).toBeLessThan(15)
  })

  it('applyRewrite on a long scene is instant', () => {
    const base = prose(5000)
    const start = 10000
    const dur = ms(() => { applyRewrite(base, start, start + 200, 'a tightened replacement', '', false) })
    expect(dur).toBeLessThan(15)
  })

  it('locateSelection on a long scene is instant', () => {
    const base = prose(5000)
    const sel = base.slice(20000, 20120)
    const dur = ms(() => { locateSelection(base, sel) })
    expect(dur).toBeLessThan(15)
  })
})
