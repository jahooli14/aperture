import { describe, it, expect } from 'vitest'
import {
  fingerprintFor, isPrebakeFresh, readPrebake,
  PREBAKE_MAX_AGE_DAYS, type PrebakedSession,
} from './session-prebake.js'

const tasks = [
  { id: 't1', text: 'Glue and clamp the uprights', done: false },
  { id: 't2', text: 'Sand the front edges', done: false },
  { id: 't0', text: 'Cut the uprights', done: true },
]
const exitNote = 'Uprights are cut, need to glue them before the split gets worse'

const bake = (over: Partial<PrebakedSession> = {}): PrebakedSession => ({
  items: [{ text: 'Glue and clamp the uprights', source: 'already on the project', taskId: 't1' }],
  doneLooksLike: 'Uprights glued.',
  source: 'briefing',
  friction: null,
  packdown: null,
  truncatedCount: 0,
  builtAt: new Date().toISOString(),
  windowMinutes: 60,
  fingerprint: fingerprintFor(tasks, exitNote),
  ...over,
})

describe('fingerprintFor', () => {
  it('ignores finished steps -- they cannot change what the session plans', () => {
    const withoutDone = tasks.filter(t => !t.done)
    expect(fingerprintFor(tasks, exitNote)).toBe(fingerprintFor(withoutDone, exitNote))
  })

  it('changes when a step is ticked off, which is what makes a used bake stale', () => {
    const afterSession = tasks.map(t => (t.id === 't1' ? { ...t, done: true } : t))
    expect(fingerprintFor(afterSession, exitNote)).not.toBe(fingerprintFor(tasks, exitNote))
  })

  it('changes when a step is reworded, added or removed', () => {
    expect(fingerprintFor([{ id: 't1', text: 'Glue the uprights', done: false }], exitNote))
      .not.toBe(fingerprintFor(tasks, exitNote))
    expect(fingerprintFor([...tasks, { id: 't3', text: 'Wax it', done: false }], exitNote))
      .not.toBe(fingerprintFor(tasks, exitNote))
  })

  it('changes when a new close-out lands, since the exit note is the spine', () => {
    expect(fingerprintFor(tasks, 'Glued them, next is sanding')).not.toBe(fingerprintFor(tasks, exitNote))
  })

  it('survives a change that would not alter the plan at all', () => {
    // No title, heat or description in the fingerprint on purpose: throwing
    // a good bake away costs a model call at the worst possible moment.
    expect(fingerprintFor([...tasks], exitNote)).toBe(fingerprintFor(tasks, exitNote))
  })
})

describe('isPrebakeFresh', () => {
  it('serves a bake that still matches what it was built from', () => {
    expect(isPrebakeFresh(bake(), tasks, exitNote)).toBe(true)
  })

  it('refuses one built against a task list that has since moved', () => {
    const afterSession = tasks.map(t => (t.id === 't1' ? { ...t, done: true } : t))
    expect(isPrebakeFresh(bake(), afterSession, exitNote)).toBe(false)
  })

  it('refuses one built before the latest close-out', () => {
    expect(isPrebakeFresh(bake(), tasks, 'Glued them, next is sanding')).toBe(false)
  })

  it('expires on age even when nothing changed -- the week it drew on has', () => {
    const old = new Date(Date.now() - (PREBAKE_MAX_AGE_DAYS + 1) * 86_400_000).toISOString()
    expect(isPrebakeFresh(bake({ builtAt: old }), tasks, exitNote)).toBe(false)
  })

  it('is false for anything missing or malformed rather than half-trusted', () => {
    expect(isPrebakeFresh(null, tasks, exitNote)).toBe(false)
    expect(isPrebakeFresh(bake({ fingerprint: undefined as any }), tasks, exitNote)).toBe(false)
    expect(isPrebakeFresh(bake({ builtAt: '' }), tasks, exitNote)).toBe(false)
  })
})

describe('readPrebake', () => {
  it('reads a stored bake back', () => {
    expect(readPrebake({ session_prebake: bake() })?.source).toBe('briefing')
  })

  it('returns null for a project that has never been baked, or a malformed record', () => {
    expect(readPrebake({})).toBeNull()
    expect(readPrebake(null)).toBeNull()
    expect(readPrebake({ session_prebake: { items: 'nope' } })).toBeNull()
  })
})
