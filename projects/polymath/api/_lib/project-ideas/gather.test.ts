/**
 * Tests for classifyIdeaOutcome — the read-side derivation that closes the
 * loop on built ideas. "built" is only the user's tap; the outcome is what
 * actually became of the project the idea spawned (linked via
 * project.metadata.from_idea). The generator feeds these outcomes back in so
 * it repeats shapes that ship and backs off shapes that stall.
 */

import { describe, it, expect } from 'vitest'
import { classifyIdeaOutcome } from './gather'

describe('classifyIdeaOutcome', () => {
  it('treats a missing project as a stall (built, never became anything)', () => {
    expect(classifyIdeaOutcome(undefined)).toBe('stalled')
  })

  it('reads a completed project as shipped — the platinum outcome', () => {
    expect(classifyIdeaOutcome({ status: 'completed' })).toBe('shipped')
  })

  it.each(['dormant', 'on-hold', 'archived', 'abandoned'])(
    'reads a %s project as stalled',
    (status) => {
      expect(classifyIdeaOutcome({ status })).toBe('stalled')
    },
  )

  it('reads an active project with a task crossed off (done flag) as worked', () => {
    const project = { status: 'active', metadata: { tasks: [{ text: 'a', done: true }, { text: 'b' }] } }
    expect(classifyIdeaOutcome(project)).toBe('worked')
  })

  it('reads an active project with a task crossed off (completed_at) as worked', () => {
    const project = { status: 'active', metadata: { tasks: [{ text: 'a', completed_at: '2026-05-01T00:00:00Z' }] } }
    expect(classifyIdeaOutcome(project)).toBe('worked')
  })

  it('reads an active project with recorded progress as worked', () => {
    expect(classifyIdeaOutcome({ status: 'active', metadata: { progress: 25 } })).toBe('worked')
  })

  it('reads an active project with no tasks crossed off as merely claimed', () => {
    const project = { status: 'active', metadata: { progress: 0, tasks: [{ text: 'a' }, { text: 'b' }] } }
    expect(classifyIdeaOutcome(project)).toBe('claimed')
  })

  it('reads an active project with no task list at all as claimed', () => {
    expect(classifyIdeaOutcome({ status: 'active', metadata: {} })).toBe('claimed')
  })

  it('prefers a terminal status over task state (completed wins)', () => {
    const project = { status: 'completed', metadata: { tasks: [{ text: 'a' }] } }
    expect(classifyIdeaOutcome(project)).toBe('shipped')
  })
})
