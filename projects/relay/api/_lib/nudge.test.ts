import { describe, expect, it } from 'vitest'
import { nudgeAllowed, nudgeRecipients, NUDGE_AGAIN_AFTER_MS } from './nudge'

const members = [
  { user_id: 'a', turn_order: 1 },
  { user_id: 'b', turn_order: 2 },
  { user_id: 'c', turn_order: 3 },
]

describe('nudgeRecipients', () => {
  it('reaches whoever is up in a rotation', () => {
    expect(
      nudgeRecipients({ mode: 'rotation', members, nextAuthorId: 'b', lastAuthorId: 'a', userId: 'a' })
    ).toEqual(['b'])
  })

  it('has no one to nudge when it is your own turn', () => {
    expect(
      nudgeRecipients({ mode: 'rotation', members, nextAuthorId: 'a', lastAuthorId: 'c', userId: 'a' })
    ).toEqual([])
  })

  it('reaches everyone else in an open story when you wrote last', () => {
    expect(
      nudgeRecipients({ mode: 'open', members, nextAuthorId: null, lastAuthorId: 'a', userId: 'a' })
    ).toEqual(['b', 'c'])
  })

  it('gives no button in an open story when you could write yourself', () => {
    expect(
      nudgeRecipients({ mode: 'open', members, nextAuthorId: null, lastAuthorId: 'b', userId: 'a' })
    ).toEqual([])
  })

  it('has no one to nudge in a solo story', () => {
    expect(
      nudgeRecipients({
        mode: 'rotation',
        members: [members[0]],
        nextAuthorId: 'a',
        lastAuthorId: null,
        userId: 'a',
      })
    ).toEqual([])
  })
})

describe('nudgeAllowed', () => {
  const now = '2026-10-01T12:00:00Z'
  const hourAgo = '2026-10-01T11:00:00Z'
  const twoHoursAgo = '2026-10-01T10:00:00Z'

  it('allows the first nudge', () => {
    expect(nudgeAllowed({ lastLineAt: hourAgo, lastNudgeAt: null, now })).toBe(true)
  })

  it('blocks a second nudge on the same turn', () => {
    expect(nudgeAllowed({ lastLineAt: twoHoursAgo, lastNudgeAt: hourAgo, now })).toBe(false)
  })

  it('allows a nudge once a new line has moved the turn on', () => {
    expect(nudgeAllowed({ lastLineAt: hourAgo, lastNudgeAt: twoHoursAgo, now })).toBe(true)
  })

  it('allows another nudge a day later', () => {
    const dayAgo = new Date(Date.parse(now) - NUDGE_AGAIN_AFTER_MS).toISOString()
    expect(nudgeAllowed({ lastLineAt: null, lastNudgeAt: dayAgo, now })).toBe(true)
  })
})
