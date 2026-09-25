import { describe, it, expect } from 'vitest'
import {
  stageFor, readMove, readFeedback, addFeedback, feedbackLines,
  buildEvidence, buildMovePrompt, parseMove, fallbackMove,
  RETURNING_AFTER_DAYS, FEEDBACK_LIMIT, type MoveInput,
} from './next-move.js'

const base: MoveInput = {
  title: 'Graham track',
  description: 'A track for Graham, built from a vocal chop.',
  endGoal: null,
  stage: 'going',
  daysAway: 0,
  note: 'Got the kick under the vocal chop. Next: bars 9-12 feel empty, the hiss is bugging me.',
  did: ['Loop bars 9-12 and program a kick. Done when it loops without wincing.'],
  lastMove: 'Loop bars 9-12 and program a kick. Done when it loops without wincing.',
  log: [],
  pastNotes: [],
  heading: ['Bounce a rough and send it to Graham'],
  captures: [],
  feedback: [],
  said: null,
  answering: null,
}

describe('stageFor', () => {
  it('is new when nothing has ever happened', () => {
    expect(stageFor({ sessionsEver: 0, doneCount: 0, daysAway: 0 })).toBe('new')
  })
  it('is returning after a month away', () => {
    expect(stageFor({ sessionsEver: 3, doneCount: 2, daysAway: RETURNING_AFTER_DAYS })).toBe('returning')
  })
  it('is going otherwise', () => {
    expect(stageFor({ sessionsEver: 1, doneCount: 0, daysAway: 3 })).toBe('going')
  })
})

describe('reading stored state', () => {
  it('reads a stored move and ignores junk', () => {
    expect(readMove({ next_move: { text: 'Play it once.', kind: 'move', from: 'closeout', written_at: '2026-09-01' } })?.text)
      .toBe('Play it once.')
    expect(readMove({ next_move: { text: '  ' } })).toBeNull()
    expect(readMove(null)).toBeNull()
  })

  it('keeps only well-formed feedback, capped', () => {
    expect(readFeedback({ move_feedback: [{ reason: 'too_big', move: 'x', at: 'y' }, { reason: 'meh' }] })).toHaveLength(1)
    let fb = readFeedback({})
    for (let i = 0; i < FEEDBACK_LIMIT + 5; i++) fb = addFeedback(fb, 'too_big', `m${i}`)
    expect(fb).toHaveLength(FEEDBACK_LIMIT)
  })
})

describe('feedbackLines', () => {
  it('turns repeated "too big" into an instruction to go smaller', () => {
    const fb = addFeedback(addFeedback([], 'too_big', 'a'), 'too_big', 'b')
    expect(feedbackLines(fb).join(' ')).toContain('Go smaller')
  })
  it('names turned-down moves so they are not offered again', () => {
    const fb = addFeedback([], 'wrong_thing', 'Record the vocals. Done when two takes exist.')
    expect(feedbackLines(fb).join(' ')).toContain('- Record the vocals.')
  })
})

describe('buildMovePrompt', () => {
  it('puts their note first and treats the old plan as background', () => {
    const ev = buildEvidence(base)
    const p = buildMovePrompt(base, ev)
    expect(ev[0].label).toBe('the note they left when they stopped')
    expect(p).toContain('Their own note comes first')
    expect(p).toContain('The old plan is background')
    expect(p).toContain('(on the old plan (where it was heading))')
  })

  it('offers a fork only to a brand-new project', () => {
    expect(buildMovePrompt(base, buildEvidence(base))).not.toContain('IF NOTHING IS DECIDED YET')
    const fresh = { ...base, stage: 'new' as const, note: null, did: [] }
    expect(buildMovePrompt(fresh, buildEvidence(fresh))).toContain('IF NOTHING IS DECIDED YET')
  })

  it('meets the work again after a long break', () => {
    const away = { ...base, stage: 'returning' as const, daysAway: 42 }
    expect(buildMovePrompt(away, buildEvidence(away))).toContain('about 6 weeks')
  })

  it('asks about the finish line only when there is one', () => {
    expect(buildMovePrompt(base, buildEvidence(base))).toContain('"finish": null')
    const goal = { ...base, endGoal: 'A finished mix sent to Graham' }
    expect(buildMovePrompt(goal, buildEvidence(goal))).toContain('They said it ends with')
  })
})

describe('parseMove', () => {
  const ev = buildEvidence(base)

  it('joins the move and its stopping point', () => {
    const { move } = parseMove({ kind: 'move', move: 'Mute the hiss track and play bars 9-12', done_when: 'you can hear the gap' }, base, ev, 'closeout')
    expect(move?.text).toBe('Mute the hiss track and play bars 9-12. Done when you can hear the gap.')
    expect(move?.kind).toBe('move')
  })

  it('refuses admin and invented gear', () => {
    expect(parseMove({ move: 'Research hiss removal plugins' }, base, ev, 'closeout').move).toBeNull()
    expect(parseMove({ move: 'Run the vocal through Serum' }, base, ev, 'closeout').move).toBeNull()
  })

  it('will not hand back a move they just turned down', () => {
    const input = { ...base, feedback: addFeedback([], 'wrong_thing', 'Bounce a rough and send it to Graham') }
    expect(parseMove({ move: 'Bounce a rough and send it to Graham' }, input, buildEvidence(input), 'reshape').move).toBeNull()
  })

  it('accepts a fork only for a new project, as a question', () => {
    const fresh = { ...base, stage: 'new' as const, description: 'A sculpture of a telegraph pole and its wires.' }
    const fev = buildEvidence(fresh)
    expect(parseMove({ kind: 'fork', question: 'Is it about the pole, or the wires?' }, fresh, fev, 'start').move?.kind).toBe('fork')
    expect(parseMove({ kind: 'fork', question: 'Is it about the pole, or the wires?' }, base, ev, 'start').move).toBeNull()
  })

  it('keeps a finish verdict only when there is a finish line', () => {
    const goal = { ...base, endGoal: 'A finished mix' }
    const r = parseMove({ move: 'Play the rough once', finish: { reached: false, reason: 'Still needs the last verse.' } }, goal, buildEvidence(goal), 'closeout')
    expect(r.finish).toEqual({ reached: false, reason: 'Still needs the last verse.' })
    expect(parseMove({ move: 'Play the rough once', finish: { reached: true, reason: 'x' } }, base, ev, 'closeout').finish).toBeNull()
  })
})

describe('fallbackMove', () => {
  it('prefers the note’s own next step, then the old plan, then looking at the work', () => {
    expect(fallbackMove(base, ['Fill bars 9-12']).text).toBe('Fill bars 9-12')
    expect(fallbackMove(base).text).toBe('Bounce a rough and send it to Graham')
    expect(fallbackMove({ ...base, heading: [] }).text).toContain('look at the last thing you made')
  })
})
