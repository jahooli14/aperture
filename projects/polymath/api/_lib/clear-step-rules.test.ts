import { describe, it, expect } from 'vitest'
import { buildSpinePrompt } from './task-spine.js'
import { buildMovePrompt, buildEvidence, type MoveInput } from './next-move.js'
import { buildStuckPrompt } from './session-moves.js'
import { CLEAR_STEP_RULES, CREATIVE_MOVE_RULES } from './plain-english.js'

describe('CLEAR_STEP_RULES', () => {
  it('names the failure it exists to stop, with a worked example', () => {
    expect(CLEAR_STEP_RULES).toContain('without decoding it')
    expect(CLEAR_STEP_RULES).toContain('comp')
    expect(CLEAR_STEP_RULES).toContain('join the best bits together')
  })

  it('is carried, with the creative-move rules, by every prompt that writes an action', () => {
    const ev = [{ id: 'e1', label: 'x', text: 'Building a shelf out of ply' }]
    const spine = buildSpinePrompt({ title: 'The shelf', endGoal: 'A shelf on the wall', said: [], existingSteps: [] }, ev)
    const input: MoveInput = {
      title: 'The shelf', description: 'A shelf out of ply', endGoal: null, stage: 'going', daysAway: 0,
      note: 'Cut the sides. Next: the back panel.', did: [], lastMove: null, log: [], pastNotes: [],
      heading: [], captures: [], feedback: [], said: null, answering: null,
    }
    const move = buildMovePrompt(input, buildEvidence(input))
    const stuck = buildStuckPrompt({ title: 'The shelf', step: 'Cut the back panel', progressNote: null, said: null, evidence: ev })

    for (const p of [spine, move, stuck]) {
      expect(p).toContain('without decoding it')
      expect(p).toContain(CREATIVE_MOVE_RULES.slice(0, 40))
    }
  })
})
