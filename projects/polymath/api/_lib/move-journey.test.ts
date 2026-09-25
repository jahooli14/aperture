/**
 * One project walked through the move loop, the way a person uses it:
 * a question first, the answer writes the first move, a session does it,
 * the note at the end writes the next one. The model is replaced by what
 * it would plausibly say; everything between is production code.
 *
 * The gaps worth catching live between steps, not inside them: a move
 * that lands in the log with its "Done when" still attached, a fork that
 * comes back after work has started, a turned-down move offered again.
 */

import { describe, it, expect } from 'vitest'
import {
  buildEvidence, buildMovePrompt, parseMove, fallbackMove, addFeedback,
  stageFor, type MoveInput,
} from './next-move.js'
import { reconcileCloseout } from './session-closeout.js'

const fresh: MoveInput = {
  title: 'Telegraph pole',
  description: 'A sculpture of the telegraph pole outside the kitchen window, and its wires.',
  endGoal: null,
  stage: stageFor({ sessionsEver: 0, doneCount: 0, daysAway: 0 }),
  daysAway: 0,
  note: null,
  did: [],
  lastMove: null,
  log: [],
  pastNotes: [],
  heading: [],
  captures: [],
  feedback: [],
  said: null,
  answering: null,
}

describe('the move loop', () => {
  it('asks a brand-new project to decide, then turns the answer into the first move', () => {
    expect(fresh.stage).toBe('new')
    const ev = buildEvidence(fresh)
    expect(buildMovePrompt(fresh, ev)).toContain('IF NOTHING IS DECIDED YET')
    const fork = parseMove({ kind: 'fork', question: 'Is it about the pole, or the wires?' }, fresh, ev, 'start').move
    expect(fork?.kind).toBe('fork')

    const answering: MoveInput = { ...fresh, said: 'The wires. The way they sag between poles.', answering: fork!.text }
    const aev = buildEvidence(answering)
    const prompt = buildMovePrompt(answering, aev)
    expect(prompt).toContain('Write the first move from that answer')
    expect(prompt).not.toContain('IF NOTHING IS DECIDED YET')
    const first = parseMove({ kind: 'move', move: 'Sketch the wires sagging between two poles, three times', done_when: 'three sketches exist' }, answering, aev, 'answer').move
    expect(first?.text).toBe('Sketch the wires sagging between two poles, three times. Done when three sketches exist.')
  })

  it('logs the done move without its stopping rule, and writes the next one from the note', () => {
    const move = 'Sketch the wires sagging between two poles, three times. Done when three sketches exist.'
    const closed = reconcileCloseout({
      tasks: [],
      sessionItems: [{ text: move, taskId: 'pending-1', partial: false }],
      ticked: [{ text: move, taskId: 'pending-1', partial: false }],
      endedAt: new Date('2026-09-24T20:00:00Z'),
      windowMinutes: null,
      durationMinutes: 40,
      debrief: null,
    })
    const logged = closed.tasks.find(t => t.done)
    expect(logged?.text).toBe('Sketch the wires sagging between two poles, three times.')

    const next: MoveInput = {
      ...fresh,
      stage: 'going',
      note: 'Third sketch works. Next: try it in wire, not pencil. The sag keeps looking too neat.',
      did: [move],
      lastMove: move,
      log: [logged!.text],
    }
    const nev = buildEvidence(next)
    expect(nev[0].label).toBe('the note they left when they stopped')
    expect(buildMovePrompt(next, nev)).not.toContain('IF NOTHING IS DECIDED YET')
    // Work has started: a fork is refused even if the model tries one.
    expect(parseMove({ kind: 'fork', question: 'Pole or wires?' }, next, nev, 'closeout').move).toBeNull()
    const written = parseMove({ move: 'Bend one length of wire into the third sketch’s sag', done_when: 'it hangs by itself' }, next, nev, 'closeout').move
    expect(written?.text).toContain('Done when it hangs by itself.')
  })

  it('learns size from "too big", and never offers a turned-down move again', () => {
    const move = 'Bend one length of wire into the third sketch’s sag. Done when it hangs by itself.'
    let feedback = addFeedback([], 'too_big', move)
    feedback = addFeedback(feedback, 'too_big', 'Build the whole pole. Done when it stands.')
    const input: MoveInput = { ...fresh, stage: 'going', note: 'try it in wire', feedback, said: 'That one is too big to start on right now. Something smaller.' }
    const ev = buildEvidence(input)
    expect(buildMovePrompt(input, ev)).toContain('Go smaller than feels useful')
    expect(parseMove({ move: 'Bend one length of wire into the third sketch’s sag' }, input, ev, 'reshape').move).toBeNull()
  })

  it('never leaves a project without a move', () => {
    expect(fallbackMove(fresh).text).toContain('Telegraph pole')
    expect(fallbackMove(fresh, ['Try the sag in wire']).text).toBe('Try the sag in wire')
  })
})
