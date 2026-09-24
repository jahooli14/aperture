import { describe, it, expect } from 'vitest'
import {
  needsReentry, buildReentryPrompt, buildStuckPrompt, groundMove,
  REENTRY_AFTER_DAYS,
} from './session-moves.js'
import type { Evidence } from './session-grounding.js'

const evidence: Evidence[] = [
  { id: 'e1', label: 'from your last close-out', text: 'Bounced a rough of the Graham track. The drop is flat.' },
  { id: 'e2', label: 'already on the project', text: 'Fix the drop so it lands' },
]

describe('needsReentry', () => {
  it('fires after a month away with a plan to come back to', () => {
    expect(needsReentry(REENTRY_AFTER_DAYS, 3)).toBe(true)
    expect(needsReentry(90, 1)).toBe(true)
  })

  it('stays out of the way on a warm project', () => {
    expect(needsReentry(REENTRY_AFTER_DAYS - 1, 3)).toBe(false)
  })

  it('has nothing to re-enter when there is no plan', () => {
    expect(needsReentry(120, 0)).toBe(false)
  })
})

describe('buildReentryPrompt', () => {
  const prompt = buildReentryPrompt({
    title: 'Graham track',
    daysAway: 42,
    lastCloseout: 'The drop is flat',
    nextStep: 'Fix the drop so it lands',
    evidence,
  })

  it('says how long it has been, in weeks', () => {
    expect(prompt).toContain('about 6 weeks')
  })

  it('treats the old plan as cold rather than the place to start', () => {
    expect(prompt).toContain('probably cold now')
    expect(prompt).toContain("Don't pick up where the\nplan says")
  })

  it('asks to meet the work and say one sentence about it', () => {
    expect(prompt).toContain('say one sentence out loud')
    expect(prompt).toContain('Done when')
  })
})

describe('buildStuckPrompt', () => {
  const prompt = buildStuckPrompt({
    title: 'Graham track',
    step: 'Fix the drop so it lands',
    progressNote: null,
    said: null,
    evidence,
  })

  it('asks for one move on this step, not a new plan', () => {
    expect(prompt).toContain('THE STEP THEY\'RE ON: "Fix the drop so it lands"')
    expect(prompt).toContain('Not a new plan')
  })

  it('offers smaller, sideways or a constraint, and bans advice', () => {
    expect(prompt).toContain('Smaller:')
    expect(prompt).toContain('Sideways:')
    expect(prompt).toContain('A constraint:')
    expect(prompt).toContain('fresh eyes')
  })
})

describe('groundMove', () => {
  it('keeps a move that names only what the project already has', () => {
    expect(groundMove('Play the rough once and say what the drop needs. Done when you have said it.', evidence, 'Graham track'))
      .toBe('Play the rough once and say what the drop needs. Done when you have said it.')
  })

  it('drops a move that invents gear', () => {
    expect(groundMove('Load the drop into Serum and rebuild the bass', evidence, 'Graham track')).toBeNull()
  })

  it('drops admin dressed as a move', () => {
    expect(groundMove('Review your notes on the drop', evidence, 'Graham track')).toBeNull()
  })

  it('accepts specifics that come from the step itself', () => {
    expect(groundMove('Loop the Ableton drop once', [], 'Graham track', ['Fix the Ableton drop'])).not.toBeNull()
  })

  it('treats a non-string as nothing', () => {
    expect(groundMove(null, evidence, 'Graham track')).toBeNull()
  })
})
