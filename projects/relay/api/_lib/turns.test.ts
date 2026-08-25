import { describe, expect, it } from 'vitest'
import { canWrite, nextInRotation, whoseTurn, type RotationMember } from './turns.js'

const dan = 'dan-id'
const ben = 'ben-id'
const cal = 'cal-id'

const pair: RotationMember[] = [
  { user_id: dan, turn_order: 0 },
  { user_id: ben, turn_order: 1 },
]

const trio: RotationMember[] = [...pair, { user_id: cal, turn_order: 2 }]

describe('nextInRotation', () => {
  it('moves to the next writer by turn order', () => {
    expect(nextInRotation(pair, dan)).toBe(ben)
    expect(nextInRotation(trio, ben)).toBe(cal)
  })

  it('wraps round at the end of the queue', () => {
    expect(nextInRotation(pair, ben)).toBe(dan)
    expect(nextInRotation(trio, cal)).toBe(dan)
  })

  it('starts at the top when there is no previous writer', () => {
    expect(nextInRotation(trio, null)).toBe(dan)
  })

  it('ignores gaps in turn order left by someone leaving', () => {
    const gappy: RotationMember[] = [
      { user_id: dan, turn_order: 0 },
      { user_id: cal, turn_order: 7 },
    ]
    expect(nextInRotation(gappy, dan)).toBe(cal)
    expect(nextInRotation(gappy, cal)).toBe(dan)
  })

  it('returns null for an empty story', () => {
    expect(nextInRotation([], dan)).toBeNull()
  })
})

describe('whoseTurn', () => {
  it('reports the stored next author in rotation mode', () => {
    expect(whoseTurn({ mode: 'rotation', members: pair, nextAuthorId: ben })).toBe(ben)
  })

  it('falls back to the top of the queue when the stored author has left', () => {
    expect(whoseTurn({ mode: 'rotation', members: pair, nextAuthorId: 'ghost' })).toBe(dan)
    expect(whoseTurn({ mode: 'rotation', members: pair, nextAuthorId: null })).toBe(dan)
  })

  it('names nobody in open mode', () => {
    expect(whoseTurn({ mode: 'open', members: trio, nextAuthorId: ben })).toBeNull()
  })
})

describe('canWrite', () => {
  const base = { members: pair, nextAuthorId: ben, lastAuthorId: dan }

  it('lets the writer whose turn it is post', () => {
    expect(canWrite({ ...base, mode: 'rotation', userId: ben })).toBe(true)
  })

  it('stops anyone else posting in rotation mode', () => {
    expect(canWrite({ ...base, mode: 'rotation', userId: dan })).toBe(false)
  })

  it('never lets a non-member post', () => {
    expect(canWrite({ ...base, mode: 'rotation', userId: 'stranger' })).toBe(false)
    expect(canWrite({ ...base, mode: 'open', userId: 'stranger' })).toBe(false)
  })

  it('lets a lone owner start a story before anyone is invited', () => {
    const solo = [{ user_id: dan, turn_order: 0 }]
    expect(canWrite({ mode: 'rotation', members: solo, nextAuthorId: dan, lastAuthorId: dan, userId: dan }))
      .toBe(true)
  })

  it('in open mode lets anyone but the last writer post', () => {
    expect(canWrite({ mode: 'open', members: trio, nextAuthorId: null, lastAuthorId: dan, userId: ben }))
      .toBe(true)
    expect(canWrite({ mode: 'open', members: trio, nextAuthorId: null, lastAuthorId: dan, userId: cal }))
      .toBe(true)
    expect(canWrite({ mode: 'open', members: trio, nextAuthorId: null, lastAuthorId: dan, userId: dan }))
      .toBe(false)
  })

  it('unblocks the story when the writer who was up has left', () => {
    // ben was next, then ben left. dan is the only member and must be able to carry on.
    const solo = [{ user_id: dan, turn_order: 0 }]
    expect(canWrite({ mode: 'rotation', members: solo, nextAuthorId: ben, lastAuthorId: dan, userId: dan }))
      .toBe(true)
  })
})
