import { describe, it, expect, beforeEach } from 'vitest'
import {
  ticksKey,
  loadTicks,
  saveTicks,
  elapsedSeconds,
  partitionRunningShapes,
  closeoutDraft,
} from './sessionRunOps'
import type { SessionShape } from '../../stores/useSessionStore'

const shape = (text: string, source: SessionShape['source'] = 'shaped'): SessionShape => ({
  text,
  source,
  partial: false,
  taskId: null,
})

describe('ticks survive a remount', () => {
  beforeEach(() => sessionStorage.clear())

  it('comes back empty for a session that has never been ticked', () => {
    expect(loadTicks('s1').size).toBe(0)
  })

  it('round-trips what was ticked', () => {
    saveTicks('s1', new Set([0, 2]))
    expect([...loadTicks('s1')].sort()).toEqual([0, 2])
  })

  it('keeps sessions apart', () => {
    saveTicks('s1', new Set([1]))
    expect(loadTicks('s2').size).toBe(0)
  })

  it('ignores junk rather than throwing', () => {
    sessionStorage.setItem(ticksKey('s1'), 'not json')
    expect(loadTicks('s1').size).toBe(0)
    sessionStorage.setItem(ticksKey('s1'), '["a", 1]')
    expect([...loadTicks('s1')]).toEqual([1])
  })
})

describe('the clock is a wall clock', () => {
  const started = '2026-09-06T20:00:00.000Z'

  it('reads the real gap, not the number of ticks it managed to fire', () => {
    // The phone locked at 20:04 and came back at 21:02. An accumulating
    // timer reported four minutes; the session had really run an hour.
    expect(elapsedSeconds(started, Date.parse('2026-09-06T21:02:00.000Z'))).toBe(3720)
  })

  it('never goes backwards if the clock does', () => {
    expect(elapsedSeconds(started, Date.parse('2026-09-06T19:59:00.000Z'))).toBe(0)
  })

  it('is zero for an unparseable start', () => {
    expect(elapsedSeconds('not a date', Date.now())).toBe(0)
  })
})

describe('the spark stays a punt once the session starts', () => {
  it('comes out of the numbered work', () => {
    const shapes = [shape('Get the paints out', 'friction'), shape('Block in the sky'), shape('Chop a vocal', 'spark')]
    expect(partitionRunningShapes(shapes)).toEqual({ workIndexes: [0, 1], sparkIndex: 2 })
  })

  it('is never the thing you must do next, even when the work is done', () => {
    const shapes = [shape('Block in the sky'), shape('Chop a vocal', 'spark')]
    const { workIndexes, sparkIndex } = partitionRunningShapes(shapes)
    const ticked = new Set([0])
    // "Right now" walks the work only, so a finished list has nothing
    // current rather than promoting the punt.
    expect(workIndexes.find(i => !ticked.has(i))).toBeUndefined()
    expect(sparkIndex).toBe(1)
  })

  it('says there is no spark when there isn\'t one', () => {
    expect(partitionRunningShapes([shape('Block in the sky')])).toEqual({ workIndexes: [0], sparkIndex: -1 })
  })
})

describe('the close-out draft is what you did', () => {
  const shapes = [
    shape('Get the paints out.', 'friction'),
    shape('Block in the sky.'),
    shape('Wash the brushes.', 'friction'),
  ]

  it('leaves setup and pack-down out of it', () => {
    expect(closeoutDraft(shapes, new Set([0, 1, 2]))).toBe('Did: Block in the sky.')
  })

  it('is empty when only the bookends were ticked', () => {
    expect(closeoutDraft(shapes, new Set([0, 2]))).toBe('')
  })

  it('joins several without doubling up full stops', () => {
    const two = [shape('Bounce the vocal.'), shape('Re-do the transition.')]
    expect(closeoutDraft(two, new Set([0, 1]))).toBe('Did: Bounce the vocal. Re-do the transition.')
  })

  it('is empty when nothing was ticked', () => {
    expect(closeoutDraft(shapes, new Set())).toBe('')
  })
})
