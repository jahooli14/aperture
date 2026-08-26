import { describe, expect, it } from 'vitest'
import { groundIndex, mentions, normalise, type SourceLine } from './ground.js'

// Real lines from the story, so the checks are tested against real prose.
const lines: SourceLine[] = [
  { position: 1, body: "Pasco knew he was in trouble when he realised he'd never eaten a peanut before." },
  { position: 5, body: 'Out of nowhere, a wild fox burst into the room and garrotted his faux pet echidna' },
  { position: 24, body: 'Detroit, Detroit. Industrial grit pounds to the drum of a house baseline.' },
  { position: 28, body: "Jimmy was moulded in the blasting furnaces of Motor City. His father, John P Pasco, was a steel company man." },
  { position: 45, body: 'The emperor had been growing bored with the monotony or running an empire.' },
]

describe('normalise', () => {
  it('strips punctuation and case', () => {
    expect(normalise('Detroit, Detroit.')).toBe('detroit detroit')
  })
  it('strips accents', () => {
    expect(normalise('Café')).toBe('cafe')
  })
})

describe('mentions', () => {
  it('finds a plain name', () => {
    expect(mentions(lines[0].body, 'Pasco')).toBe(true)
  })

  it('finds a full name from a partial mention', () => {
    expect(mentions(lines[3].body, 'John P Pasco')).toBe(true)
    expect(mentions(lines[3].body, 'Jimmy Pasco')).toBe(true)
  })

  it('matches across singular and plural', () => {
    expect(mentions('a pile of bin bags', 'bin bag')).toBe(true)
    expect(mentions(lines[0].body, 'peanuts')).toBe(true)
  })

  it('will not match a short word inside a longer one', () => {
    expect(mentions('Roderick was back in the USSR', 'Rome')).toBe(false)
  })

  it('rejects a name that simply is not there', () => {
    expect(mentions(lines[2].body, 'Livia')).toBe(false)
  })
})

describe('groundIndex', () => {
  it('keeps an entry whose name really appears in a cited line', () => {
    const result = groundIndex({ people: [{ name: 'Pasco', note: 'A fox.', lines: [1] }] }, lines)
    expect(result.people).toEqual([{ name: 'Pasco', note: 'A fox.', lines: [1] }])
  })

  it('drops an invented character', () => {
    const result = groundIndex(
      { people: [{ name: 'Captain Aldridge', note: 'The ship’s captain.', lines: [1, 5] }] },
      lines
    )
    expect(result.people).toEqual([])
  })

  it('drops citations to lines that do not exist', () => {
    const result = groundIndex({ places: [{ name: 'Detroit', note: '', lines: [24, 999] }] }, lines)
    expect(result.places[0].lines).toEqual([24])
  })

  it('drops an entry citing only lines that do not exist', () => {
    const result = groundIndex({ places: [{ name: 'Detroit', note: '', lines: [900] }] }, lines)
    expect(result.places).toEqual([])
  })

  it('drops a note written in critic voice but keeps the entry', () => {
    const result = groundIndex(
      {
        people: [
          { name: 'Pasco', note: 'A poignant meditation on displacement.', lines: [1] },
          { name: 'Detroit', note: 'Detroit serves as a symbolic crucible.', lines: [24] },
        ],
      },
      lines
    )
    expect(result.people.map((p) => [p.name, p.note])).toEqual([
      ['Pasco', ''],
      ['Detroit', ''],
    ])
  })

  it('orders entries by where they first appear', () => {
    const result = groundIndex(
      {
        places: [
          { name: 'Detroit', note: '', lines: [24] },
          { name: 'peanut', note: '', lines: [1] },
        ],
      },
      lines
    )
    expect(result.places.map((p) => p.name)).toEqual(['peanut', 'Detroit'])
  })

  it('removes duplicates that differ only by case or punctuation', () => {
    const result = groundIndex(
      {
        people: [
          { name: 'Pasco', note: '', lines: [1] },
          { name: 'pasco.', note: '', lines: [1] },
        ],
      },
      lines
    )
    expect(result.people).toHaveLength(1)
  })

  it('deduplicates repeated citations', () => {
    const result = groundIndex({ places: [{ name: 'Detroit', note: '', lines: [24, 24, 24] }] }, lines)
    expect(result.places[0].lines).toEqual([24])
  })

  it('caps each section so the sheet stays readable', () => {
    const many = Array.from({ length: 30 }, () => ({ name: 'Pasco', note: '', lines: [1] }))
    expect(groundIndex({ people: many }, lines).people.length).toBeLessThanOrEqual(12)
  })

  it('survives a malformed response without throwing', () => {
    expect(groundIndex({}, lines)).toEqual({ people: [], places: [], threads: [] })
    expect(groundIndex({ people: [{ name: '', note: '', lines: [] }] }, lines).people).toEqual([])
  })
})
