import { describe, it, expect } from 'vitest'
import {
  buildSplitPrompt, groundMoves, sanitizeDoneLooksLike, doneLineForSteps, MAX_SPLIT_MOVES,
} from './session-split.js'
import type { Evidence } from './session-grounding.js'

const step = { id: 't2', text: 'Design and cut the communist insignia stencil', minutes: 60 as const }
const evidence: Evidence[] = [
  { id: 'e1', label: 'the finish line you set', text: 'A paint-poured print with the stencil on it, framed' },
  { id: 'e2', label: 'from your last close-out', text: 'Rewatched the pouring video, got the card out' },
]

describe('buildSplitPrompt', () => {
  const prompt = buildSplitPrompt({ title: 'Paint pouring stencil', step, progressNote: null, windowMinutes: 20, evidence })

  it('hands over exactly one step and the window', () => {
    expect(prompt).toContain('THE STEP: "Design and cut the communist insignia stencil"')
    expect(prompt).toContain('20 minutes')
  })

  it('asks for the FIRST piece of that step, not a different task', () => {
    expect(prompt).toContain('FIRST part of this step')
    expect(prompt).toContain('Not a different task')
  })

  it('asks for a real stopping point and what exists at the end', () => {
    expect(prompt).toContain('real stopping point')
    expect(prompt).toContain('done_looks_like')
  })

  it('tells the model to start from where they got to last time', () => {
    const p = buildSplitPrompt({ title: 'x', step, progressNote: 'got the outline drawn', windowMinutes: 20, evidence })
    expect(p).toContain('WHERE THEY GOT TO LAST TIME: "got the outline drawn"')
    expect(p).toContain('start from there')
  })

  it('carries the no-invented-specifics rule with a concrete anti-example', () => {
    expect(prompt).toContain('no scalpel')
    expect(prompt).toContain('BAD:')
    expect(prompt).toContain('GOOD:')
  })

  it('tells the model to under-reach', () => {
    expect(prompt).toContain('Under-reach')
  })
})

describe('groundMoves', () => {
  it('keeps moves that name nothing the step or evidence does not', () => {
    const { kept } = groundMoves(
      [{ text: 'Draw the outline of the design on the card, actual size' }, { text: 'Cut the two biggest shapes out' }],
      step, evidence, 'Paint pouring stencil',
    )
    expect(kept.map(k => k.text)).toEqual([
      'Draw the outline of the design on the card, actual size',
      'Cut the two biggest shapes out',
    ])
  })

  it('does not require word overlap with the step -- a piece of a step often shares no distinctive word', () => {
    const { kept } = groundMoves([{ text: 'Trace the shape onto the card' }], step, evidence, 'x')
    expect(kept).toHaveLength(1)
  })

  it('drops a move that invents gear', () => {
    const { kept, rejected } = groundMoves(
      [{ text: 'Cut it out with the X-Acto knife on the Olfa mat' }, { text: 'Draw the outline' }],
      step, evidence, 'x',
    )
    expect(kept.map(k => k.text)).toEqual(['Draw the outline'])
    expect(rejected[0].reason).toContain('invented')
  })

  it('marks every move as a partial piece of the step, carrying its id', () => {
    const { kept } = groundMoves([{ text: 'Draw the outline' }], step, evidence, 'x')
    expect(kept[0]).toMatchObject({ taskId: 't2', partial: true })
    expect(kept[0].source).toContain('part of:')
  })

  it('drops admin moves and caps the count', () => {
    const many = ['Plan the cuts', 'Draw the outline', 'Cut shape one', 'Cut shape two', 'Cut shape three']
    const { kept } = groundMoves(many.map(text => ({ text })), step, evidence, 'x')
    expect(kept.map(k => k.text)).not.toContain('Plan the cuts')
    expect(kept.length).toBeLessThanOrEqual(MAX_SPLIT_MOVES)
  })
})

describe('sanitizeDoneLooksLike', () => {
  it('keeps a plain sentence grounded in the evidence', () => {
    expect(sanitizeDoneLooksLike('The outline is drawn and the big shapes are cut.', 'stencil card outline')).toBe(
      'The outline is drawn and the big shapes are cut.',
    )
  })

  it('drops one that invents a specific', () => {
    expect(sanitizeDoneLooksLike('The stencil is cut on the Olfa mat.', 'stencil card')).toBeNull()
  })

  it('drops junk and over-long text', () => {
    expect(sanitizeDoneLooksLike(null, 'x')).toBeNull()
    expect(sanitizeDoneLooksLike('x'.repeat(200), 'x')).toBeNull()
  })
})

describe('doneLineForSteps', () => {
  it('is null with no steps', () => {
    expect(doneLineForSteps([])).toBeNull()
  })

  it('names the one step when there is one', () => {
    expect(doneLineForSteps([{ text: 'Cut the stencil.' }])).toBe('"Cut the stencil" ticked off.')
  })

  it('names the last step when there are several', () => {
    expect(doneLineForSteps([{ text: 'Cut the stencil' }, { text: 'Pour the paint' }])).toBe('Through to "Pour the paint".')
  })
})
