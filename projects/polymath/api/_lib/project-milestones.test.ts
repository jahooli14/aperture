import { describe, it, expect } from 'vitest'
import { readMilestones, appendMilestone, MILESTONE_HISTORY_LIMIT } from './project-milestones.js'

describe('readMilestones', () => {
  it('reads nothing for a project that predates this or never had one', () => {
    expect(readMilestones({})).toEqual([])
    expect(readMilestones(null)).toEqual([])
    expect(readMilestones({ milestones: 'not an array' })).toEqual([])
  })

  it('drops a malformed entry rather than letting it break the arc', () => {
    const metadata = { milestones: [{ n: 1, at: '2026-01-01T00:00:00.000Z', reached: false, reason: 'x', steps: ['a'] }, { n: 'two' }] }
    expect(readMilestones(metadata)).toHaveLength(1)
  })
})

describe('appendMilestone', () => {
  it('starts the arc at checkpoint 1 with everything done so far', () => {
    const result = appendMilestone({}, { reached: false, reason: 'Still needs a synopsis.' }, ['Draft act one', 'Draft act two'])
    expect(result).toEqual([
      { n: 1, at: expect.any(String), reached: false, reason: 'Still needs a synopsis.', steps: ['Draft act one', 'Draft act two'] },
    ])
  })

  it('only attributes NEW done tasks to the next checkpoint, not ones an earlier one already covered', () => {
    const afterFirst = appendMilestone({}, { reached: false, reason: 'Still drafting.' }, ['step 1', 'step 2'], new Date('2026-01-01'))
    const afterSecond = appendMilestone(
      { milestones: afterFirst },
      { reached: true, reason: 'The manuscript is finished.' },
      ['step 1', 'step 2', 'step 3', 'step 4'],
      new Date('2026-02-01'),
    )
    expect(afterSecond).toHaveLength(2)
    expect(afterSecond[1]).toEqual({
      n: 2, at: '2026-02-01T00:00:00.000Z', reached: true,
      reason: 'The manuscript is finished.', steps: ['step 3', 'step 4'],
    })
  })

  it('never double-counts the same done list across a retried request', () => {
    const once = appendMilestone({}, { reached: false, reason: 'x' }, ['a', 'b'])
    // Same call, same done list, run again as if the request were retried --
    // this SHOULD produce a fresh checkpoint 2 (that's the caller's job to
    // dedupe at a higher level, e.g. by not re-calling on a no-op request),
    // but the steps it attributes to checkpoint 2 must never re-list a or b.
    const twice = appendMilestone({ milestones: once }, { reached: false, reason: 'x' }, ['a', 'b'])
    expect(twice[1].steps).toEqual([])
  })

  it('caps the history so it cannot grow without bound', () => {
    let metadata: unknown = {}
    for (let i = 0; i < MILESTONE_HISTORY_LIMIT + 5; i++) {
      metadata = { milestones: appendMilestone(metadata, { reached: false, reason: `check ${i}` }, [`step ${i}`]) }
    }
    const final = readMilestones(metadata)
    expect(final).toHaveLength(MILESTONE_HISTORY_LIMIT)
    // The oldest ones fell off the front, so the tail is the most recent.
    expect(final[final.length - 1].reason).toBe(`check ${MILESTONE_HISTORY_LIMIT + 4}`)
  })
})
