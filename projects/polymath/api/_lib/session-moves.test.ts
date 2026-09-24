import { describe, it, expect } from 'vitest'
import {
  buildStuckPrompt, groundMove,
} from './session-moves.js'
import type { Evidence } from './session-grounding.js'

const evidence: Evidence[] = [
  { id: 'e1', label: 'from your last close-out', text: 'Bounced a rough of the Graham track. The drop is flat.' },
  { id: 'e2', label: 'already on the project', text: 'Fix the drop so it lands' },
]

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

describe('stripDoneWhen', () => {
  it('drops the stopping rule so the log reads as what was done', async () => {
    const { stripDoneWhen } = await import('./session-items.js')
    expect(stripDoneWhen('Sketch the pole three times. Done when three sketches exist.'))
      .toBe('Sketch the pole three times.')
    expect(stripDoneWhen('Record verse two')).toBe('Record verse two')
  })
})
