import { describe, it, expect } from 'vitest'
import { isOwnWords, pickWhere, sinceLastTime, moveRepeatsAThread, spokenPart } from './projectBrief'

describe('isOwnWords', () => {
  it('refuses the old close-out log the app wrote', () => {
    expect(isOwnWords('Did: Paste your directional rewrite comments into Claude AI. Done when they are in the chat box.')).toBe(false)
    expect(isOwnWords('Trimmed chapter two. Done when the scene reads clean.')).toBe(false)
  })
  it('keeps real notes and drops one-word acknowledgements', () => {
    expect(isOwnWords('Got through the first third of the trim, cut the pub scene')).toBe(true)
    expect(isOwnWords('Done.')).toBe(false)
    expect(isOwnWords(null)).toBe(false)
  })
})

describe('pickWhere', () => {
  const own = 'Got through the first third of the trim, cut the pub scene'
  it('uses the newer of their last Update and the summary', () => {
    expect(pickWhere({ summary: { text: 'Summary', at: '2026-10-01' }, closeout: { text: own, at: '2026-10-17' } })?.own).toBe(true)
    expect(pickWhere({ summary: { text: 'Summary', at: '2026-10-20' }, closeout: { text: own, at: '2026-10-17' } })?.own).toBe(false)
  })
  it('never picks app text, falls back to the summary', () => {
    const w = pickWhere({ summary: { text: 'Summary', at: '2026-10-01' }, closeout: { text: 'Did: x. Done when y happens to be true', at: '2026-10-17' } })
    expect(w?.text).toBe('Summary')
  })
  it('is null with nothing', () => {
    expect(pickWhere({})).toBeNull()
  })
})

describe('sinceLastTime', () => {
  const updates = [
    { text: 'New idea: open on the pay phone', at: '2026-10-20T10:00:00Z' },
    { text: 'Got through the first third of the trim', at: '2026-10-17T10:00:00Z' },
    { text: 'Older', at: '2026-10-01T10:00:00Z' },
  ]
  it('keeps only notes after where you are, and not that one', () => {
    expect(sinceLastTime(updates, '2026-10-17T10:00:00Z', 'Got through the first third of the trim').map(u => u.text))
      .toEqual(['New idea: open on the pay phone'])
  })
  it('says nothing without a date to measure from', () => {
    expect(sinceLastTime(updates, null, null)).toEqual([])
  })
})

describe('moveRepeatsAThread', () => {
  it('spots a move that says what a thread says', () => {
    expect(moveRepeatsAThread(
      ['Do the full trim', 'Check length and structure', 'Dictate everything in my voice'],
      'Dictate the opening scene into a recorder in your voice.',
    )).toBe(true)
  })
  it('leaves a different move alone', () => {
    expect(moveRepeatsAThread(['Do the full trim'], 'Phone the printer about the proof copy')).toBe(false)
    expect(moveRepeatsAThread(['A thing'], null)).toBe(false)
  })
})

describe('spokenPart', () => {
  it('shows what was said, not the generated title', () => {
    expect(spokenPart('Novel editing progress — Did some more trimming today')).toBe('Did some more trimming today')
    expect(spokenPart('Insomnia twist — Spark response, I am moving it to him not sleeping')).toBe('I am moving it to him not sleeping')
    expect(spokenPart('Just a note')).toBe('Just a note')
  })
})
