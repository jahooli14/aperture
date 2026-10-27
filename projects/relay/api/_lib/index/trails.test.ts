import { describe, expect, it } from 'vitest'
import { appearsIn, chapterList, quietAfter, trailFor, withTrails } from './trails.js'

const lines = [
  { position: 1, body: 'Pasco knew he was in trouble.' },
  { position: 2, body: 'A fox burst into the room.' },
  { position: 3, body: 'The emperor carved a fig.', chapter_title: 'III: When in Rome' },
  { position: 4, body: 'Years later Johnny carved fruit too.' },
  { position: 5, body: 'The fox melted into the fog.' },
  { position: 6, body: 'Nothing about animals here.' },
]

describe('appearsIn', () => {
  it('matches whole words and plurals, not substrings', () => {
    expect(appearsIn('The fox ran', 'Fox')).toBe(true)
    expect(appearsIn('Peanuts everywhere', 'peanut')).toBe(true)
    expect(appearsIn('A great product', 'Rod')).toBe(false)
  })

  it('lets one distinctive word stand for a longer name', () => {
    expect(appearsIn('Mister Stewart sang', 'Rod Stewart')).toBe(true)
    expect(appearsIn('Rod waved', 'Rod Stewart')).toBe(false)
  })
})

describe('trailFor', () => {
  it('finds every line, the last one, and how long ago it was', () => {
    const trail = trailFor('fox', lines, 6)
    expect(trail?.count).toBe(2)
    expect(trail?.last).toBe(5)
    expect(trail?.ago).toBe(1)
  })

  it('groups appearances under the chapter they fall in', () => {
    const trail = trailFor('fox', lines, 6)
    expect(trail?.chapters).toEqual([
      { title: null, lines: [2] },
      { title: 'III: When in Rome', lines: [5] },
    ])
  })

  it('returns null for a name that is nowhere', () => {
    expect(trailFor('walrus', lines, 6)).toBeNull()
  })
})

describe('withTrails', () => {
  it('falls back to the cited lines when the scan finds nothing', () => {
    const out = withTrails(
      { people: [{ name: 'The Weasel', note: '', lines: [2] }], places: [], threads: [] },
      lines
    )
    expect(out.people[0].trail.last).toBe(2)
    expect(out.people[0].trail.ago).toBe(4)
  })
})

describe('quietAfter', () => {
  it('scales with the story but never gets twitchy', () => {
    expect(quietAfter(20)).toBe(12)
    expect(quietAfter(150)).toBe(30)
  })
})

describe('chapterList', () => {
  it('includes an unnamed opening', () => {
    expect(chapterList(lines)).toEqual([
      { position: 1, title: null },
      { position: 3, title: 'III: When in Rome' },
    ])
  })
})
