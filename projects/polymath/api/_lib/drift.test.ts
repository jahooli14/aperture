import { describe, it, expect } from 'vitest'
import { classifyDrift, isStalled } from './drift.js'

describe('classifyDrift', () => {
  it('is stable when drift is low, regardless of chatter', () => {
    expect(classifyDrift(0.1, true)).toBe('stable')
    expect(classifyDrift(0.1, false)).toBe('stable')
  })

  it('reshapes on high drift with adjacent chatter', () => {
    expect(classifyDrift(0.6, true)).toBe('reshape')
  })

  it('lets go on high drift with silence', () => {
    expect(classifyDrift(0.6, false)).toBe('let-go')
  })
})

describe('isStalled', () => {
  const now = new Date('2026-08-24T00:00:00Z')

  it('is not stalled with no empty slots, however old', () => {
    const project = { last_session_ended_at: '2020-01-01T00:00:00Z', slots: [{ filled: true }] }
    expect(isStalled(project, now)).toBe(false)
  })

  it('is stalled when never worked on and has an empty slot', () => {
    const project = { last_session_ended_at: null, slots: [{ filled: false }] }
    expect(isStalled(project, now)).toBe(true)
  })

  it('is not stalled with an empty slot but a recent session', () => {
    const project = { last_session_ended_at: '2026-08-20T00:00:00Z', slots: [{ filled: false }] }
    expect(isStalled(project, now)).toBe(false)
  })

  it('is stalled with an empty slot and a session 6+ weeks ago', () => {
    const project = { last_session_ended_at: '2026-07-01T00:00:00Z', slots: [{ filled: false }] }
    expect(isStalled(project, now)).toBe(true)
  })

  it('treats a mix of filled and empty slots as having an open question', () => {
    const project = {
      last_session_ended_at: '2026-07-01T00:00:00Z',
      slots: [{ filled: true }, { filled: false }],
    }
    expect(isStalled(project, now)).toBe(true)
  })

  it('is stalled with no slots at all -- unseeded is not the same as fully answered', () => {
    const project = { last_session_ended_at: '2026-07-01T00:00:00Z', slots: [] }
    expect(isStalled(project, now)).toBe(true)
  })
})

describe('a project that cannot be scored is never harvested', () => {
  it('classifyDrift only ever sees a real score', () => {
    // computeDriftScore returns null when a query fails, and drift-decay
    // does `if (!drift) continue`. This matters more than the other silent
    // reads in this channel: no embeddings means "maximal drift, no
    // chatter", which is the exact profile classifyDrift calls let-go. A
    // broken query used to look identical to an abandoned project, so it
    // would have quietly harvested live work.
    expect(classifyDrift(1, false)).toBe('let-go')
  })
})
