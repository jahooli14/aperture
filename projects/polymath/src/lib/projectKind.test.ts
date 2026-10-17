import { describe, it, expect } from 'vitest'
import { projectKind } from './projectThemes'

const lines = { themes: [{ text: 'every chapter in the new voice', at: '2026-10-01' }] }

describe('projectKind', () => {
  it('lines make it ongoing', () => {
    expect(projectKind({ metadata: lines, is_priority: false } as never, true)).toBe('ongoing')
  })
  it('a live project with no move yet is offered lines', () => {
    expect(projectKind({ metadata: {}, is_priority: true } as never, false)).toBe('ongoing')
  })
  it('a move and no lines is a one-off', () => {
    expect(projectKind({ metadata: {}, is_priority: true } as never, true)).toBe('one-off')
    expect(projectKind({ metadata: {}, is_priority: false } as never, false)).toBe('one-off')
  })
  it('what you chose at the start wins', () => {
    expect(projectKind({ metadata: { kind: 'ongoing' }, is_priority: false } as never, true)).toBe('ongoing')
    expect(projectKind({ metadata: { ...lines, kind: 'one-off' }, is_priority: true } as never, false)).toBe('one-off')
  })
})
