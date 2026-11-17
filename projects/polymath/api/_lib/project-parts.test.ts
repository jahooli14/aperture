import { describe, it, expect } from 'vitest'
import { partsFromSaid, withLabels, partsLine, readParts, type Part } from './project-parts.js'

const book: Part[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 1}`, label: `Chapter ${i + 1}`, done: i === 0 })),
  { id: 'p13', label: 'Final pass', done: false },
]
const ticks = (s: string) => partsFromSaid(s, book).map(id => book.find(p => p.id === id)!.label)

describe('partsFromSaid', () => {
  it('ticks a chapter said to be done, in digits or words', () => {
    expect(ticks('Finished chapter 4 tonight')).toEqual(['Chapter 4'])
    expect(ticks('chapter four is done, in my voice now')).toEqual(['Chapter 4'])
    expect(ticks('Rewrote chapter 12.')).toEqual(['Chapter 12'])
  })
  it('only ticks the clause that says done', () => {
    expect(ticks('Finished chapter 4, starting chapter 5 tomorrow')).toEqual(['Chapter 4'])
    expect(ticks('Halfway through chapter 6')).toEqual([])
    expect(ticks("Haven't finished chapter 3 yet")).toEqual([])
  })
  it('handles ranges and pairs', () => {
    expect(ticks('Got through chapters 2 to 4 this weekend')).toEqual(['Chapter 2', 'Chapter 3', 'Chapter 4'])
    expect(ticks('Rewrote chapters 5 and 7')).toEqual(['Chapter 5', 'Chapter 7'])
  })
  it('ticks a named part, and never re-ticks what is done', () => {
    expect(ticks('Final pass is done!')).toEqual(['Final pass'])
    expect(ticks('finished chapter 1 again')).toEqual([])
  })
})

describe('withLabels', () => {
  it('keeps ticks on labels that stay, adds new ones undone', () => {
    const next = withLabels(book.slice(0, 2), ['Chapter 1', 'Chapter 2', 'Final pass'])
    expect(next.map(p => [p.label, p.done])).toEqual([['Chapter 1', true], ['Chapter 2', false], ['Final pass', false]])
    expect(new Set(next.map(p => p.id)).size).toBe(3)
  })
})

describe('partsLine / readParts', () => {
  it('says what is done and what is not', () => {
    expect(partsLine(book)).toMatch(/^Done: Chapter 1\. Still to do: Chapter 2, .*Final pass\.$/)
    expect(partsLine([])).toBe('')
  })
  it('reads junk as nothing', () => {
    expect(readParts({ parts: [{ id: 'p1', label: 'x', done: 1 }, { nope: true }] })).toEqual([{ id: 'p1', label: 'x', done: true }])
    expect(readParts(null)).toEqual([])
  })
})
