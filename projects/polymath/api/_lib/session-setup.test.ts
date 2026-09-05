import { describe, it, expect } from 'vitest'
import { readStoredFriction, frictionChanged } from './session-shaper.js'
import { buildSplitPrompt } from './session-split.js'
import { buildTopupPrompt } from './session-topup.js'
import { buildSpinePrompt, buildFirstCutPrompt } from './task-spine.js'
import { CLEAR_STEP_RULES } from './plain-english.js'

describe('readStoredFriction', () => {
  it('reads a setup the project has already been observed to need', () => {
    expect(readStoredFriction({ text: 'Get the paint out', minutes: 10 }))
      .toEqual({ text: 'Get the paint out', minutes: 10 })
  })

  it('snaps a stray number onto the shared estimate ladder', () => {
    expect(readStoredFriction({ text: 'Get the paint out', minutes: 12 })?.minutes).toBe(10)
  })

  it('ignores a malformed or empty record rather than half-trusting it', () => {
    expect(readStoredFriction(null)).toBeNull()
    expect(readStoredFriction({ text: '', minutes: 10 })).toBeNull()
    expect(readStoredFriction({ text: 'Get the paint out' })).toBeNull()
    expect(readStoredFriction({ text: 'Get the paint out', minutes: 0 })).toBeNull()
  })
})

describe('frictionChanged', () => {
  it('is false when nothing moved, so a briefing does not write on every session', () => {
    const same = { text: 'Get the paint out', minutes: 10 }
    expect(frictionChanged(same, { text: 'Get the paint out', minutes: 10 })).toBe(false)
  })

  it('is false when the project never had one and still does not', () => {
    expect(frictionChanged(null, null)).toBe(false)
  })

  it('notices a first observation, a changed estimate and a dropped one', () => {
    expect(frictionChanged(null, { text: 'Get the paint out', minutes: 10 })).toBe(true)
    expect(frictionChanged({ text: 'Get the paint out', minutes: 10 }, { text: 'Get the paint out', minutes: 20 })).toBe(true)
    expect(frictionChanged({ text: 'Get the paint out', minutes: 10 }, null)).toBe(true)
  })
})

describe('CLEAR_STEP_RULES', () => {
  it('names the failure it exists to stop, with a worked example', () => {
    expect(CLEAR_STEP_RULES).toContain('without decoding it')
    expect(CLEAR_STEP_RULES).toContain('comp')
    expect(CLEAR_STEP_RULES).toContain('join the best bits together')
  })

  it('is carried by every prompt that writes an action, not just the new ones', () => {
    const split = buildSplitPrompt({
      title: 'The shelf',
      step: { id: 't1', text: 'Build the carcass', minutes: 60 },
      progressNote: null,
      windowMinutes: 30,
      evidence: [{ id: 'e1', label: 'x', text: 'Building a shelf out of ply' }],
    })
    const topup = buildTopupPrompt({
      title: 'The shelf',
      evidence: [{ id: 'e1', label: 'x', text: 'Building a shelf out of ply' }],
      currentItems: [],
      remainingMinutes: 20,
      maxItems: 2,
    })
    const ev = [{ id: 'e1', label: 'x', text: 'Building a shelf out of ply' }]
    const spine = buildSpinePrompt({ title: 'The shelf', endGoal: 'A shelf on the wall', said: [], existingSteps: [] }, ev)
    const firstCut = buildFirstCutPrompt({ title: 'The shelf', description: 'A shelf', said: [] }, ev)

    for (const p of [split, topup, spine, firstCut]) {
      expect(p).toContain('without decoding it')
    }
  })
})
