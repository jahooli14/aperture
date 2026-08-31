import { describe, it, expect } from 'vitest'
import { confidenceScore, confidenceFor, reasoningLicence } from './session-confidence.js'

const EMPTY = {
  endGoal: null, endGoalSource: null,
  lastCloseout: null, lastSessionEndedAt: null,
  movedSessionCount: 0, doneTaskCount: 0, openTaskCount: 0,
  recentFragmentCount: 0, shapingChatTurns: 0,
}
const NOW = new Date('2026-09-01T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('confidenceFor', () => {
  it('a project nobody has said anything about is thin', () => {
    expect(confidenceFor(EMPTY, NOW)).toBe('thin')
  })

  it('a freshly created project with one open task is still thin', () => {
    // The quick-add path (createProjectFromIdea) makes exactly this.
    expect(confidenceFor({ ...EMPTY, openTaskCount: 1 }, NOW)).toBe('thin')
  })

  it('the Graham song case — goal, recent close-out, motion — is known', () => {
    expect(confidenceFor({
      ...EMPTY,
      endGoal: 'Finished mix sent to Graham', endGoalSource: 'guide',
      lastCloseout: 'Next: fix the transition out of track two.',
      lastSessionEndedAt: daysAgo(3),
      movedSessionCount: 2,
      doneTaskCount: 1, openTaskCount: 2,
      recentFragmentCount: 1,
    }, NOW)).toBe('known')
  })

  it('a goal and an old close-out and nothing else is only partial', () => {
    expect(confidenceFor({
      ...EMPTY,
      endGoal: 'Finished mix', endGoalSource: 'guide',
      lastCloseout: 'Got the intro sorted.', lastSessionEndedAt: daysAgo(200),
    }, NOW)).toBe('partial')
  })

  it('a stale close-out counts for less than a fresh one', () => {
    const base = { ...EMPTY, lastCloseout: 'Got the intro sorted.' }
    const fresh = confidenceScore({ ...base, lastSessionEndedAt: daysAgo(3) }, NOW)
    const stale = confidenceScore({ ...base, lastSessionEndedAt: daysAgo(200) }, NOW)
    expect(fresh).toBeGreaterThan(stale)
  })

  it('a close-out with no recorded end date is treated as stale, not fresh', () => {
    expect(confidenceScore({ ...EMPTY, lastCloseout: 'something' }, NOW)).toBe(1)
  })

  it('a goal a person wrote counts for more than one that appeared on its own', () => {
    const written = confidenceScore({ ...EMPTY, endGoal: 'X', endGoalSource: 'guide' }, NOW)
    const bare = confidenceScore({ ...EMPTY, endGoal: 'X', endGoalSource: null }, NOW)
    expect(written).toBe(bare + 1)
  })

  it('ticked-off work counts for more than a list of intentions', () => {
    const motion = confidenceScore({ ...EMPTY, doneTaskCount: 3, openTaskCount: 2 }, NOW)
    const intentions = confidenceScore({ ...EMPTY, openTaskCount: 5 }, NOW)
    expect(motion).toBeGreaterThan(intentions)
  })

  it('does not let session history alone run away with the score', () => {
    expect(confidenceScore({ ...EMPTY, movedSessionCount: 40 }, NOW)).toBe(2)
  })
})

describe('reasoningLicence', () => {
  it('lets a well-known project reason from the finish line', () => {
    expect(reasoningLicence('known')).toContain('reason backwards from the finish line')
  })

  it('stops a partly-known project chaining evidence together', () => {
    expect(reasoningLicence('partial')).toContain('Do not chain')
  })

  it('forbids naming anything at all when it barely knows the project', () => {
    expect(reasoningLicence('thin')).toContain('Do not\nname anything specific')
  })
})
