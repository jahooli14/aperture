import { describe, it, expect } from 'vitest'
import { pickWeekendProject, isSendTime, nudgeMessage, type NudgeProject } from './weekend-nudge'

const now = new Date('2026-10-17T10:30:00Z') // a Saturday
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

const p = (over: Partial<NudgeProject>): NudgeProject => ({
  id: 'x', title: 'X', status: 'active', state: null, is_priority: false, last_active: daysAgo(30), ...over,
})

describe('pickWeekendProject', () => {
  it('names the warmest of the projects that have gone quiet', () => {
    const pick = pickWeekendProject([
      p({ id: 'old', last_active: daysAgo(90) }),
      p({ id: 'warm', last_active: daysAgo(20) }),
      p({ id: 'fresh', last_active: daysAgo(3) }),
    ], null, now)
    expect(pick?.project.id).toBe('warm')
    expect(pick?.days).toBe(20)
  })

  it('never names the live project, a finished one, or last week\'s', () => {
    const pick = pickWeekendProject([
      p({ id: 'live', state: 'live' }),
      p({ id: 'star', is_priority: true }),
      p({ id: 'done', status: 'completed' }),
      p({ id: 'dead', state: 'harvested' }),
      p({ id: 'last', last_active: daysAgo(15) }),
      p({ id: 'ok', last_active: daysAgo(40) }),
    ], 'last', now)
    expect(pick?.project.id).toBe('ok')
  })

  it('says nothing when nothing is waiting', () => {
    expect(pickWeekendProject([p({ last_active: daysAgo(2) }), p({ last_active: daysAgo(500) })], null, now)).toBeNull()
  })
})

describe('isSendTime', () => {
  it('is Saturday from 10am in their own clock', () => {
    expect(isSendTime(new Date('2026-10-17T10:30:00Z'), 'Europe/London')).toBe(true) // 11:30 BST
    expect(isSendTime(new Date('2026-10-17T07:00:00Z'), 'Europe/London')).toBe(false) // 08:00
    expect(isSendTime(new Date('2026-10-18T12:00:00Z'), 'Europe/London')).toBe(false) // Sunday
  })
})

describe('nudgeMessage', () => {
  it('says how long in weeks, then months', () => {
    expect(nudgeMessage('Paint pouring', 35).body).toBe("Waiting 5 weeks. Here's where you got to.")
    expect(nudgeMessage('Paint pouring', 120).body).toBe("Waiting 4 months. Here's where you got to.")
  })
})
