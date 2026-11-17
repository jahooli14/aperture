import { describe, it, expect } from 'vitest'
import { projectShape, shapeMetadata, nextShape, nextPart, allPartsDone } from './projectShape'

const p = (metadata: Record<string, unknown>, is_priority = false) => ({ metadata, is_priority }) as never

describe('projectShape', () => {
  it('uses the shape chosen', () => {
    expect(projectShape(p({ shape: 'big' }))).toBe('big')
    expect(projectShape(p({ shape: 'quick', themes: [{ text: 'x' }] }))).toBe('quick')
  })
  it('works out older projects from what they carry', () => {
    expect(projectShape(p({ cycle: { unit: 'mix' } }))).toBe('ongoing')
    expect(projectShape(p({ parts: [{ id: 'p1', label: 'Chapter 1', done: true }] }))).toBe('big')
    // The novel: threads plus a finish line.
    expect(projectShape(p({ themes: [{ text: 'Do the full trim' }], end_goal: 'A manuscript ready for agents' }))).toBe('big')
    expect(projectShape(p({ themes: [{ text: 'every set warmer than the last' }] }))).toBe('ongoing')
    expect(projectShape(p({ kind: 'one-off' }))).toBe('quick')
    expect(projectShape(p({}))).toBe('quick')
    expect(projectShape({ metadata: {}, is_priority: false, title: 'Memory house book idea' } as never)).toBe('big')
    expect(projectShape({ metadata: {}, is_priority: false, title: 'Create custom t-shirts for friends' } as never)).toBe('quick')
  })
  it('stores kind alongside for older code, and the pill cycles all three', () => {
    expect(shapeMetadata('big')).toEqual({ shape: 'big', kind: 'ongoing' })
    expect(shapeMetadata('quick')).toEqual({ shape: 'quick', kind: 'one-off' })
    expect([nextShape('quick'), nextShape('big'), nextShape('ongoing')]).toEqual(['big', 'ongoing', 'quick'])
  })
})

describe('parts on the card', () => {
  const parts = [{ id: 'p1', label: 'Chapter 1', done: true }, { id: 'p2', label: 'Chapter 2', done: false }]
  it('names the first row not ticked, and knows when all are', () => {
    expect(nextPart({ parts })).toBe('Chapter 2')
    expect(allPartsDone({ parts })).toBe(false)
    expect(allPartsDone({ parts: parts.map(x => ({ ...x, done: true })) })).toBe(true)
    expect(allPartsDone({})).toBe(false)
  })
})
