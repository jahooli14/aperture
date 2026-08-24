/**
 * Battle-test the Focus chat's validation layer.
 *
 * These functions are the only thing standing between an AI response and a
 * real mutation call (setPriority, setUpNext, bury, task edits) — a
 * hallucinated or malformed proposal must be rejected here, not discovered
 * later as a confusing runtime error. Same reasoning as inlineGuideOps.test.
 */

import { describe, it, expect } from 'vitest'
import {
  type PortfolioProjectSummary,
  parsePortfolioAction,
  parsePortfolioTaskOp,
  parsePortfolioNewProject,
  isUpNextActionNoOp,
  isSetPriorityNoOp,
  buildOpeningLine,
} from './focusChatOps'

function makeSummary(partial: Partial<PortfolioProjectSummary> & { id: string; title: string }): PortfolioProjectSummary {
  return {
    status: 'active',
    is_priority: false,
    up_next_position: null,
    daysSinceActive: 0,
    progressPercent: 0,
    totalTasks: 0,
    completedTasks: 0,
    ...partial,
  }
}

describe('parsePortfolioAction', () => {
  const known = new Set(['p1', 'p2'])

  it('accepts a valid action', () => {
    const out = parsePortfolioAction(
      { type: 'start_session', projectId: 'p1', projectTitle: 'EP', reasoning: 'why' },
      known
    )
    expect(out).toEqual({ type: 'start_session', projectId: 'p1', projectTitle: 'EP', reasoning: 'why' })
  })

  it('rejects an unknown action type', () => {
    expect(parsePortfolioAction({ type: 'delete_forever', projectId: 'p1' }, known)).toBeNull()
  })

  it('rejects a projectId the model was never told about (hallucinated or stale)', () => {
    expect(parsePortfolioAction({ type: 'bury', projectId: 'p999' }, known)).toBeNull()
  })

  it('rejects malformed shapes', () => {
    expect(parsePortfolioAction(null, known)).toBeNull()
    expect(parsePortfolioAction('start_session', known)).toBeNull()
    expect(parsePortfolioAction({ type: 'start_session' }, known)).toBeNull()
  })

  it('falls back projectTitle to projectId when missing', () => {
    expect(parsePortfolioAction({ type: 'bury', projectId: 'p1' }, known)?.projectTitle).toBe('p1')
  })

  it('passes through minutesAvailable on start_session, clamped to a sane range', () => {
    expect(parsePortfolioAction({ type: 'start_session', projectId: 'p1', minutesAvailable: 20 }, known)?.minutesAvailable).toBe(20)
    expect(parsePortfolioAction({ type: 'start_session', projectId: 'p1', minutesAvailable: 2 }, known)?.minutesAvailable).toBe(5)
    expect(parsePortfolioAction({ type: 'start_session', projectId: 'p1', minutesAvailable: 999 }, known)?.minutesAvailable).toBe(180)
  })

  it('drops minutesAvailable on any action that is not start_session', () => {
    expect(parsePortfolioAction({ type: 'bury', projectId: 'p1', minutesAvailable: 20 }, known)?.minutesAvailable).toBeUndefined()
  })

  it('ignores a non-numeric minutesAvailable', () => {
    expect(parsePortfolioAction({ type: 'start_session', projectId: 'p1', minutesAvailable: 'soon' }, known)?.minutesAvailable).toBeUndefined()
  })
})

describe('parsePortfolioTaskOp', () => {
  const withNextTask = makeSummary({ id: 'p1', title: 'EP', nextTaskId: 't1', nextTaskText: 'mix vocals' })
  const withoutNextTask = makeSummary({ id: 'p2', title: 'Novel', totalTasks: 0 })
  // Legacy/malformed data: a real next task exists (text) but has no id —
  // can't be edited/completed, and "add" can't fix it either (see below).
  const idLessNextTask = makeSummary({ id: 'p3', title: 'Old Site', nextTaskText: 'some broken legacy task' })
  const known = new Map([['p1', withNextTask], ['p2', withoutNextTask], ['p3', idLessNextTask]])

  it('accepts a valid edit targeting the real next task', () => {
    const out = parsePortfolioTaskOp({ projectId: 'p1', action: 'edit', taskId: 't1', newText: 'master the track' }, known)
    expect(out).toMatchObject({ projectId: 'p1', projectTitle: 'EP', op: { action: 'edit', taskId: 't1', newText: 'master the track' } })
  })

  it('accepts a valid complete', () => {
    const out = parsePortfolioTaskOp({ projectId: 'p1', action: 'complete', taskId: 't1' }, known)
    expect(out?.op).toMatchObject({ action: 'complete', taskId: 't1' })
  })

  it('accepts add only when the project has no existing correctable next task', () => {
    const out = parsePortfolioTaskOp({ projectId: 'p2', action: 'add', newText: 'outline chapter 1' }, known)
    expect(out?.op).toMatchObject({ action: 'add', newText: 'outline chapter 1' })
  })

  it('rejects add when the project already has a real next task (it would never override which task surfaces next)', () => {
    expect(parsePortfolioTaskOp({ projectId: 'p1', action: 'add', newText: 'something else' }, known)).toBeNull()
  })

  it('rejects add even for an id-less legacy next task — add cannot fix that case either', () => {
    expect(parsePortfolioTaskOp({ projectId: 'p3', action: 'add', newText: 'the real next step' }, known)).toBeNull()
  })

  it('rejects edit/complete missing a taskId', () => {
    expect(parsePortfolioTaskOp({ projectId: 'p1', action: 'edit', newText: 'x' }, known)).toBeNull()
    expect(parsePortfolioTaskOp({ projectId: 'p1', action: 'complete' }, known)).toBeNull()
  })

  it('rejects edit/add missing newText', () => {
    expect(parsePortfolioTaskOp({ projectId: 'p1', action: 'edit', taskId: 't1' }, known)).toBeNull()
    expect(parsePortfolioTaskOp({ projectId: 'p2', action: 'add' }, known)).toBeNull()
  })

  it('rejects an unknown action (e.g. delete/uncomplete — outside this feature\'s narrower scope)', () => {
    expect(parsePortfolioTaskOp({ projectId: 'p1', action: 'delete', taskId: 't1' }, known)).toBeNull()
  })

  it('rejects a projectId the model was never told about', () => {
    expect(parsePortfolioTaskOp({ projectId: 'p999', action: 'edit', taskId: 't1', newText: 'x' }, known)).toBeNull()
  })

  it('rejects malformed shapes', () => {
    expect(parsePortfolioTaskOp(null, known)).toBeNull()
    expect(parsePortfolioTaskOp({}, known)).toBeNull()
  })
})

describe('isUpNextActionNoOp', () => {
  it('treats add_up_next as a no-op when already pinned', () => {
    expect(isUpNextActionNoOp(2, 'add_up_next')).toBe(true)
    expect(isUpNextActionNoOp(null, 'add_up_next')).toBe(false)
  })

  it('treats remove_up_next as a no-op when not pinned', () => {
    expect(isUpNextActionNoOp(null, 'remove_up_next')).toBe(true)
    expect(isUpNextActionNoOp(1, 'remove_up_next')).toBe(false)
  })

  it('is always false for unrelated action types', () => {
    expect(isUpNextActionNoOp(1, 'bury')).toBe(false)
    expect(isUpNextActionNoOp(null, 'start_session')).toBe(false)
  })
})

describe('isSetPriorityNoOp', () => {
  it('is a no-op only for set_priority on an already-priority project', () => {
    expect(isSetPriorityNoOp(true, 'set_priority')).toBe(true)
    expect(isSetPriorityNoOp(false, 'set_priority')).toBe(false)
    expect(isSetPriorityNoOp(true, 'bury')).toBe(false)
  })
})

describe('buildOpeningLine', () => {
  it('leads with the stalest non-priority project past 14 days, quoting its reason', () => {
    const line = buildOpeningLine([
      makeSummary({ id: 'a', title: 'Fresh', daysSinceActive: 2 }),
      makeSummary({ id: 'b', title: 'Old One', daysSinceActive: 40, heatReason: 'you mentioned it yesterday' }),
    ])
    expect(line).toContain('Old One')
    expect(line).toContain('40 days')
    expect(line).toContain('you mentioned it yesterday')
  })

  it('mentions a warmed connection when nothing is stale enough', () => {
    const line = buildOpeningLine([
      makeSummary({ id: 'a', title: 'Warm', daysSinceActive: 1, heatReason: 'connects to a new note' }),
    ])
    expect(line).toContain('Warm')
  })

  it('falls back to the priority project when nothing else stands out', () => {
    const line = buildOpeningLine([
      makeSummary({ id: 'a', title: 'The One', is_priority: true, daysSinceActive: 1 }),
    ])
    expect(line).toContain('The One')
  })

  it('never throws on an empty list', () => {
    expect(() => buildOpeningLine([])).not.toThrow()
  })
})

describe('parsePortfolioNewProject', () => {
  it('accepts a well-formed proposal', () => {
    const parsed = parsePortfolioNewProject({
      title: 'Modular patch a week',
      pitch: 'One finished patch every week. Done when there are four recordings.',
      firstStep: 'Patch a drone and record two minutes of it',
      reasoning: 'You keep coming back to synths in your notes',
    })
    expect(parsed?.title).toBe('Modular patch a week')
    expect(parsed?.firstStep).toContain('Patch a drone')
  })

  it('rejects a proposal missing a title or pitch — both reach a real createProject call', () => {
    expect(parsePortfolioNewProject({ pitch: 'no title here' })).toBeNull()
    expect(parsePortfolioNewProject({ title: 'no pitch here' })).toBeNull()
    expect(parsePortfolioNewProject({ title: '   ', pitch: '   ' })).toBeNull()
  })

  it('rejects non-objects rather than throwing', () => {
    expect(parsePortfolioNewProject(null)).toBeNull()
    expect(parsePortfolioNewProject('a string')).toBeNull()
    expect(parsePortfolioNewProject(undefined)).toBeNull()
  })

  it('drops blank optional fields instead of passing empty strings through', () => {
    const parsed = parsePortfolioNewProject({ title: 'T', pitch: 'P', firstStep: '  ', ideaId: '' })
    expect(parsed?.firstStep).toBeUndefined()
    expect(parsed?.ideaId).toBeUndefined()
  })

  it('keeps ideaId so an accepted queue idea can be cleared from the queue', () => {
    const parsed = parsePortfolioNewProject({ title: 'T', pitch: 'P', ideaId: 'idea-123' })
    expect(parsed?.ideaId).toBe('idea-123')
  })
})
