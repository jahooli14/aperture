import { describe, it, expect } from 'vitest'
import { resolveFocusProjectId, warmRow, queueRow } from './focusProjectOps'
import type { Project } from '../types'

const today = new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const project = (over: Partial<Project> & { id: string }): Project => ({
  user_id: 'u1',
  title: over.id,
  description: null,
  status: 'active',
  last_active: daysAgo(5),
  created_at: daysAgo(30),
  ...over,
} as Project)

const star = project({ id: 'star', is_priority: true, last_active: daysAgo(10) })
const warm = project({ id: 'warm', last_active: daysAgo(1) })
const older = project({ id: 'older', last_active: daysAgo(8) })

describe('resolveFocusProjectId', () => {
  it('falls back to the star when nothing more specific applies', () => {
    expect(resolveFocusProjectId([star, warm, older])).toBe('star')
  })

  it('prefers a session booked for today over the star', () => {
    const booked = project({ id: 'booked', booked_session_at: today })
    expect(resolveFocusProjectId([star, booked, warm])).toBe('booked')
  })

  it('ignores a booking on a project that has been harvested', () => {
    const booked = project({ id: 'booked', booked_session_at: today, state: 'harvested' } as any)
    expect(resolveFocusProjectId([star, booked])).toBe('star')
  })

  it('prefers a declared-live project over the star', () => {
    const live = project({ id: 'live', state: 'live' } as any)
    expect(resolveFocusProjectId([star, live])).toBe('live')
  })

  it('lets an override win over everything — this is what a play tap sets', () => {
    const live = project({ id: 'live', state: 'live' } as any)
    expect(resolveFocusProjectId([star, live, warm], 'warm')).toBe('warm')
  })

  it('ignores an override pointing at a project that is no longer eligible', () => {
    const dead = project({ id: 'dead', status: 'graveyard' })
    expect(resolveFocusProjectId([star, dead], 'dead')).toBe('star')
  })

  it('ignores an override for a project that no longer exists', () => {
    expect(resolveFocusProjectId([star, warm], 'deleted')).toBe('star')
  })

  it('falls back to the most recently touched when nothing is starred', () => {
    expect(resolveFocusProjectId([older, warm])).toBe('warm')
  })

  it('skips unshaped captures, which are not projects you can sit down to', () => {
    const unshaped = project({ id: 'unshaped', last_active: today, metadata: { is_shaped: false } } as any)
    expect(resolveFocusProjectId([unshaped, warm])).toBe('warm')
  })

  it('returns null when there is nothing to focus on', () => {
    expect(resolveFocusProjectId([])).toBeNull()
  })

  // The bug this whole resolver exists for: the row excluded the STAR while
  // the card could be showing something else entirely, so both surfaces
  // showed the same project at once.
  it('names the project the row has to exclude, not merely the starred one', () => {
    const live = project({ id: 'live', state: 'live' } as any)
    const focus = resolveFocusProjectId([star, live, warm])
    expect(focus).toBe('live')
    expect(focus).not.toBe('star')
  })

  it('swaps cleanly: playing a row card focuses it, freeing whatever was focused', () => {
    const shelf = [star, warm, older]
    expect(resolveFocusProjectId(shelf)).toBe('star')
    // ▶ on "warm" sets an override; the star is no longer the focus and so
    // is no longer the thing being excluded from the row.
    expect(resolveFocusProjectId(shelf, 'warm')).toBe('warm')
  })
})

describe('the "everything else" row shows nothing twice', () => {
  // The row is warm projects then queued ones. A project that is both has
  // to appear exactly once, and the two halves have to agree on which.
  const focus = project({ id: 'focus', is_priority: true })
  const a = project({ id: 'a', last_active: daysAgo(1) })
  const b = project({ id: 'b', last_active: daysAgo(2) })
  const queued = project({ id: 'queued', last_active: daysAgo(40), up_next_position: 1 } as any)

  it('drops a queued project from the queue half when it is warm enough to be shown', () => {
    const alsoWarm = project({ id: 'alsoWarm', last_active: daysAgo(1), up_next_position: 1 } as any)
    const all = [focus, alsoWarm, b]
    expect(warmRow(all, 'focus', null, 2).map(p => p.id)).toEqual(['alsoWarm', 'b'])
    expect(queueRow(all, 'focus', null, 2).map(p => p.id)).toEqual([])
  })

  it('keeps a queued project that the warm half did not have room for', () => {
    const all = [focus, a, b, queued]
    expect(warmRow(all, 'focus', null, 2).map(p => p.id)).toEqual(['a', 'b'])
    expect(queueRow(all, 'focus', null, 2).map(p => p.id)).toEqual(['queued'])
  })

  it('does not show a displaced focus in both halves at once', () => {
    // Play tapped on `a`, so `a` is the focus and `focus` was displaced
    // into the front of the warm row. `focus` is also pinned to Up Next,
    // and used to pass the queue filter because that half recomputed the
    // warm row without the displacement step.
    const pinnedFocus = project({ id: 'focus', is_priority: true, up_next_position: 1 } as any)
    const all = [pinnedFocus, a, b]
    const warm = warmRow(all, 'a', 'a', 2)
    const queue = queueRow(all, 'a', 'a', 2)
    expect(warm.map(p => p.id)).toEqual(['focus', 'b'])
    expect(queue.map(p => p.id)).toEqual([])
    const shown = [...warm, ...queue].map(p => p.id)
    expect(new Set(shown).size).toBe(shown.length)
  })

  it('never shows the focus project itself', () => {
    const all = [focus, a, b]
    expect(warmRow(all, 'focus', null, 2).map(p => p.id)).not.toContain('focus')
    expect(queueRow(all, 'focus', null, 2).map(p => p.id)).not.toContain('focus')
  })

  it('orders the queue by its position, not by recency', () => {
    const q1 = project({ id: 'q1', last_active: daysAgo(50), up_next_position: 1 } as any)
    const q2 = project({ id: 'q2', last_active: daysAgo(45), up_next_position: 2 } as any)
    const all = [focus, a, b, q2, q1]
    expect(queueRow(all, 'focus', null, 2).map(p => p.id)).toEqual(['q1', 'q2'])
  })
})
