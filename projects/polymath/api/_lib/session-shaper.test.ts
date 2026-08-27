import { describe, it, expect } from 'vitest'
import {
  itemCountForWindow,
  isAdminItem,
  sanitizeItems,
  buildShapePrompt,
} from './session-shaper.js'

describe('itemCountForWindow', () => {
  it('gives a short window a short list', () => {
    expect(itemCountForWindow(20)).toBe(3)
  })

  it('scales up with the window, capped at 6', () => {
    expect(itemCountForWindow(60)).toBe(5)
    expect(itemCountForWindow(120)).toBe(6)
    expect(itemCountForWindow(600)).toBe(6)
  })

  it('assumes a middling session when the window is unknown', () => {
    expect(itemCountForWindow(null)).toBe(4)
  })

  it('stays in the 3-6 band for every window', () => {
    for (const m of [1, 5, 20, 21, 45, 46, 75, 76, 180]) {
      const n = itemCountForWindow(m)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
    }
  })
})

describe('isAdminItem', () => {
  it('catches admin disguised as build', () => {
    expect(isAdminItem('Research venues for the launch')).toBe(true)
    expect(isAdminItem('Decide on the running order')).toBe(true)
    expect(isAdminItem('Think about the ending')).toBe(true)
  })

  it('sees through bullet and number prefixes', () => {
    expect(isAdminItem('3. Plan the second half')).toBe(true)
    expect(isAdminItem('- review the mix notes')).toBe(true)
  })

  it('leaves real moves alone', () => {
    expect(isAdminItem('Bounce the vocal at -3dB')).toBe(false)
    expect(isAdminItem('Phone the venue and ask for a date')).toBe(false)
  })

  it('does not flag a real verb that merely contains an admin word', () => {
    expect(isAdminItem('Listen back on the phone speaker')).toBe(false)
    expect(isAdminItem('Replant the seedlings')).toBe(false)
  })
})

describe('sanitizeItems', () => {
  it('strips bullets and numbering', () => {
    expect(sanitizeItems(['1. Open the file', '- Cut the intro'], 4))
      .toEqual(['Open the file', 'Cut the intro'])
  })

  it('drops admin items, blanks and over-long lines', () => {
    expect(sanitizeItems(
      ['Open the file', '', 'Plan the release', 'x'.repeat(200), 'Cut the intro'],
      6,
    )).toEqual(['Open the file', 'Cut the intro'])
  })

  it('drops near-duplicates that differ only in punctuation or case', () => {
    expect(sanitizeItems(['Cut the intro', 'cut the intro.'], 4)).toEqual(['Cut the intro'])
  })

  it('caps at the window count', () => {
    expect(sanitizeItems(['a move', 'b move', 'c move', 'd move'], 2))
      .toEqual(['a move', 'b move'])
  })

  it('survives anything that is not an array of strings', () => {
    expect(sanitizeItems(null, 4)).toEqual([])
    expect(sanitizeItems('nope', 4)).toEqual([])
    expect(sanitizeItems([1, {}, null], 4)).toEqual([])
  })
})

describe('buildShapePrompt', () => {
  const base = {
    title: 'Graham song',
    goal: null,
    windowMinutes: 60,
    lastCloseout: null,
    openTasks: [],
    fragments: [],
    slots: [],
  }

  it('states the exact item count the window allows', () => {
    expect(buildShapePrompt(base)).toContain('exactly 5 things')
    expect(buildShapePrompt({ ...base, windowMinutes: 20 })).toContain('exactly 3 things')
  })

  it('names the window in minutes so the list is sized to it', () => {
    expect(buildShapePrompt({ ...base, windowMinutes: 120 })).toContain('120 minutes')
  })

  it('says plainly when there is no session history yet', () => {
    expect(buildShapePrompt(base)).toContain('have not had a session')
  })

  it('quotes the last close-out back when there is one', () => {
    const p = buildShapePrompt({ ...base, lastCloseout: 'Next: fix the transition' })
    expect(p).toContain('fix the transition')
  })

  it('carries the reshape instruction and the list it applies to', () => {
    const p = buildShapePrompt({
      ...base,
      instruction: 'too much admin',
      currentItems: ['Plan the mix', 'Cut the intro'],
    })
    expect(p).toContain('too much admin')
    expect(p).toContain('1. Plan the mix')
    expect(p).toContain("don't\nthrow out items they didn't complain about")
  })

  it('leaves the reshape block out entirely on a first pass', () => {
    expect(buildShapePrompt(base)).not.toContain('The user says:')
  })

  it('bans the admin verbs in the prompt, not just in the checker', () => {
    const p = buildShapePrompt(base)
    for (const v of ['research', 'decide', 'think about', 'brainstorm']) {
      expect(p).toContain(v)
    }
  })

  it('carries the plain-English rules and a concrete anti-example', () => {
    const p = buildShapePrompt(base)
    expect(p).toContain('Bad:')
    expect(p).toContain('Good:')
    expect(p.toLowerCase()).toContain('plain english')
  })
})
