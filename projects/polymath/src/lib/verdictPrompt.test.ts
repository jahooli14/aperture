import { describe, it, expect } from 'vitest'
import { shouldAskVerdict, ENOUGH_READ_PERCENT } from './verdictPrompt'

const base = { resonance: null, progress: 80, alreadyAsked: false }

describe('shouldAskVerdict', () => {
  it('asks someone who read it and never said what they thought', () => {
    // The live case: 297 articles, zero verdicts, because the buttons are
    // at the end of the article and nobody gets to the end.
    expect(shouldAskVerdict(base)).toBe(true)
  })

  it('never asks twice', () => {
    expect(shouldAskVerdict({ ...base, alreadyAsked: true })).toBe(false)
  })

  it('never asks someone who already answered', () => {
    expect(shouldAskVerdict({ ...base, resonance: 'good' })).toBe(false)
    expect(shouldAskVerdict({ ...base, resonance: 'not_for_me' })).toBe(false)
  })

  it('leaves alone anyone who bounced off it', () => {
    // Opening something and closing it is not an opinion about it.
    expect(shouldAskVerdict({ ...base, progress: 0 })).toBe(false)
    expect(shouldAskVerdict({ ...base, progress: 5 })).toBe(false)
    expect(ENOUGH_READ_PERCENT).toBeGreaterThan(10)
    expect(ENOUGH_READ_PERCENT).toBeLessThan(60)
  })

  it('asks right at the threshold', () => {
    expect(shouldAskVerdict({ ...base, progress: ENOUGH_READ_PERCENT })).toBe(true)
  })
})
