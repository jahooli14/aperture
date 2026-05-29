/**
 * Tests for classifyIdeaOutcome — the read-side derivation that closes the
 * loop on built ideas. "built" is only the user's tap; the outcome is what
 * actually became of the project the idea spawned (linked via
 * project.metadata.from_idea). The generator feeds these outcomes back in so
 * it repeats shapes that ship and backs off shapes that stall.
 */

import { describe, it, expect } from 'vitest'
import { classifyIdeaOutcome } from './gather'

const NOW = Date.now()
const hours = (n: number) => new Date(NOW - n * 3_600_000).toISOString()

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

  it('reads an active project with progress as worked', () => {
    expect(classifyIdeaOutcome({ status: 'active', metadata: { progress: 25 } })).toBe('worked')
  })

  it('reads an active project with a completed task as worked', () => {
    const project = { status: 'active', metadata: { tasks: [{ text: 'a', done: true }, { text: 'b' }] } }
    expect(classifyIdeaOutcome(project)).toBe('worked')
  })

  it('reads an active project touched well after creation as worked', () => {
    const project = { status: 'active', created_at: hours(72), last_active: hours(2) }
    expect(classifyIdeaOutcome(project)).toBe('worked')
  })

  it('reads an active, untouched project as merely claimed', () => {
    // Created and last touched in the same sitting (within the grace window),
    // no progress, no tasks — the user spun it up but never moved it.
    const project = { status: 'active', created_at: hours(48), last_active: hours(48), metadata: { progress: 0 } }
    expect(classifyIdeaOutcome(project)).toBe('claimed')
  })

  it('does not count spin-up edits inside the grace window as work', () => {
    // last_active only ~1h after creation — that's the shaping pass, not work.
    const project = { status: 'active', created_at: hours(49), last_active: hours(48) }
    expect(classifyIdeaOutcome(project)).toBe('claimed')
  })

  it('prefers a real status over a stale last_active (completed wins)', () => {
    const project = { status: 'completed', created_at: hours(48), last_active: hours(48) }
    expect(classifyIdeaOutcome(project)).toBe('shipped')
  })
})
