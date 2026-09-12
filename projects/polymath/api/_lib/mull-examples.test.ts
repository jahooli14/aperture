import { describe, it, expect } from 'vitest'
import { MULL_EXAMPLES, examplesBlock } from './mull-examples.js'
import { rejectionReason, MAX_MULL_WORDS } from './mull.js'

/**
 * An example the gates would reject teaches the model to write questions the
 * gates reject — and it does it silently, since the run just comes out empty.
 */
describe('the examples the prompt teaches from', () => {
  MULL_EXAMPLES.forEach((e, i) => {
    it(`#${i + 1} (${e.shape}) survives its own gates`, () => {
      expect(e.text.split(/\s+/).length).toBeLessThanOrEqual(MAX_MULL_WORDS)
      expect(rejectionReason({
        text: e.text,
        quote: e.quote,
        stake: e.stake,
        connectorText: `Earlier that year: ${e.quote}, and a good deal more besides.`,
      })).toBeNull()
    })
  })

  it('no two of them end the same way', () => {
    const closers = MULL_EXAMPLES.map(e => {
      const m = e.text.match(/[^.?!]*\?\s*$/)
      return (m?.[0] ?? '').trim().toLowerCase().replace(/[^a-z ]/g, '')
    })
    expect(new Set(closers).size).toBe(MULL_EXAMPLES.length)
  })

  it('renders every example into the prompt block', () => {
    const block = examplesBlock()
    for (const e of MULL_EXAMPLES) expect(block).toContain(e.text)
  })
})
