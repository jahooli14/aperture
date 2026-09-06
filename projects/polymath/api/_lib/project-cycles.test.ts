import { describe, it, expect } from 'vitest'
import {
  readCycleState, repeats, pluralise, cycleLabel, cycleCountLabel,
  rollToNextCycle, lastCycleSteps, CYCLE_HISTORY_LIMIT,
} from './project-cycles.js'

const now = new Date('2026-09-06T12:00:00Z')

const dj = {
  end_goal: 'a recorded mix',
  cycle: { unit: 'mix', done: 4, history: [{ n: 4, at: '2026-08-01T00:00:00Z', steps: ['Pick the tracks', 'Record it'] }] },
  tasks: [
    { id: 't1', text: 'Pick the tracks', done: true, order: 0 },
    { id: 't2', text: 'Record it', done: true, order: 1 },
    { id: 't3', text: 'Upload it', done: false, order: 2 },
  ],
}

describe('readCycleState', () => {
  it('reads a repeating project', () => {
    expect(readCycleState(dj)?.unit).toBe('mix')
    expect(readCycleState(dj)?.done).toBe(4)
  })

  it('is null for an ordinary project, which is almost all of them', () => {
    expect(readCycleState({ end_goal: 'a finished album' })).toBeNull()
    expect(readCycleState({})).toBeNull()
    expect(readCycleState(null)).toBeNull()
  })

  it('needs a real unit — a cycle with no noun to count is not a cycle', () => {
    expect(readCycleState({ cycle: { unit: '  ', done: 3 } })).toBeNull()
    expect(readCycleState({ cycle: { done: 3 } })).toBeNull()
  })

  it('tolerates a malformed count or history rather than throwing', () => {
    const s = readCycleState({ cycle: { unit: 'mix', done: -2, history: 'nope' } })
    expect(s?.done).toBe(0)
    expect(s?.history).toEqual([])
  })
})

describe('repeats', () => {
  it('is what every caller gates on', () => {
    expect(repeats(dj)).toBe(true)
    expect(repeats({ end_goal: 'a finished album' })).toBe(false)
  })
})

describe('labels', () => {
  it('counts the one just finished', () => {
    expect(cycleLabel('mix', 5)).toBe('Mix 5')
    expect(cycleLabel('sketch', 12)).toBe('Sketch 12')
  })

  it('pluralises the ordinary and the hissing cases', () => {
    expect(pluralise('mix', 2)).toBe('mixes')
    expect(pluralise('sketch', 3)).toBe('sketches')
    expect(pluralise('track', 4)).toBe('tracks')
    expect(pluralise('mix', 1)).toBe('mix')
  })

  it('says nothing at all before the first one lands', () => {
    // "0 mixes so far" is worse to read than no line.
    expect(cycleCountLabel({ unit: 'mix', done: 0, history: [] })).toBeNull()
    expect(cycleCountLabel({ unit: 'mix', done: 1, history: [] })).toBe('1 mix so far')
    expect(cycleCountLabel({ unit: 'mix', done: 5, history: [] })).toBe('5 mixes so far')
  })
})

describe('rollToNextCycle', () => {
  it('counts the finished one', () => {
    expect(readCycleState(rollToNextCycle(dj, { now }))?.done).toBe(5)
  })

  it('files the done steps as the shape the next one is planned from', () => {
    const next = readCycleState(rollToNextCycle(dj, { now }))
    const filed = next!.history[next!.history.length - 1]
    expect(filed.n).toBe(5)
    expect(filed.steps).toEqual(['Pick the tracks', 'Record it'])
  })

  it('clears the finished steps off the project so receipts stay readable', () => {
    const rolled = rollToNextCycle(dj, { now })
    expect(rolled.tasks.map((t: any) => t.id)).toEqual(['t3'])
  })

  it('carries anything still open into the next one', () => {
    const rolled = rollToNextCycle(dj, { now })
    expect(rolled.tasks.find((t: any) => t.id === 't3')).toBeTruthy()
  })

  it('keeps what was said at the end, so the next plan can read it', () => {
    const rolled = rollToNextCycle(dj, { closeout: 'levels were hot on track 3', now })
    const state = readCycleState(rolled)!
    expect(state.history[state.history.length - 1].closeout).toBe('levels were hot on track 3')
  })

  it('caps the history rather than growing forever', () => {
    let m: any = { cycle: { unit: 'mix', done: 0, history: [] }, tasks: [] }
    for (let i = 0; i < CYCLE_HISTORY_LIMIT + 4; i++) m = rollToNextCycle(m, { now })
    const state = readCycleState(m)!
    expect(state.done).toBe(CYCLE_HISTORY_LIMIT + 4)
    expect(state.history).toHaveLength(CYCLE_HISTORY_LIMIT)
    // the ones kept are the most recent
    expect(state.history[state.history.length - 1].n).toBe(CYCLE_HISTORY_LIMIT + 4)
  })

  it('leaves an ordinary project completely alone', () => {
    const ordinary = { end_goal: 'a finished album', tasks: [{ id: 't1', text: 'x', done: true }] }
    expect(rollToNextCycle(ordinary, { now })).toEqual(ordinary)
  })

  it('preserves the rest of metadata, including the unit-scoped finish line', () => {
    const rolled = rollToNextCycle(dj, { now })
    expect(rolled.end_goal).toBe('a recorded mix')
  })
})

describe('lastCycleSteps', () => {
  it('hands the planner the shape that already worked', () => {
    expect(lastCycleSteps(readCycleState(dj))).toEqual(['Pick the tracks', 'Record it'])
  })

  it('is empty for a first cycle or an ordinary project', () => {
    expect(lastCycleSteps(readCycleState({ cycle: { unit: 'mix', done: 0, history: [] } }))).toEqual([])
    expect(lastCycleSteps(null)).toEqual([])
  })
})

describe('the prompts that carry the concept', () => {
  it('tells the shaper a repeating unit is rare and must be volunteered', async () => {
    const { buildShapingPrompt } = await import('./project-shaping.js')
    const p = buildShapingPrompt('I want to DJ more', [], [{ id: 'e1', label: 'x', text: 'I want to DJ more' }])
    expect(p).toContain('repeat_unit')
    expect(p).toContain('record a mix, record a mix')
    // The guard that stops every project becoming a treadmill.
    expect(p).toContain('most projects do not')
    expect(p).toContain('into a treadmill')
  })

  it('plans the next one from the shape the last one took', async () => {
    const { buildSpinePrompt } = await import('./task-spine.js')
    const p = buildSpinePrompt(
      { title: 'DJ mixes', endGoal: 'a recorded mix', said: [], existingSteps: [], previousCycle: ['Pick the tracks', 'Record it'] },
      [{ id: 'e1', label: 'x', text: 'a recorded mix' }],
    )
    expect(p).toContain('THIS PROJECT REPEATS')
    expect(p).toContain('- Pick the tracks')
    expect(p).toContain('It already worked')
    // The point: a near-identical list is CORRECT here, not lazy.
    expect(p).toContain('same job again, not a new one')
  })

  it('says nothing about repeating for an ordinary project', async () => {
    const { buildSpinePrompt } = await import('./task-spine.js')
    const p = buildSpinePrompt(
      { title: 'The album', endGoal: 'a finished album', said: [], existingSteps: [] },
      [{ id: 'e1', label: 'x', text: 'a finished album' }],
    )
    expect(p).not.toContain('THIS PROJECT REPEATS')
  })
})
