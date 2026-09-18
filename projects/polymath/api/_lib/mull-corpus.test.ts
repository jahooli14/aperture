import { describe, it, expect } from 'vitest'
import { findSource, normaliseTitle, isTransientError, type Corpus } from './mull-corpus.js'

describe('isTransientError', () => {
  it('recognises the failure actually seen in production', () => {
    expect(isTransientError('Gateway Timeout')).toBe(true)
    expect(isTransientError('upstream connect error or disconnect/reset before headers')).toBe(true)
    expect(isTransientError('ECONNRESET')).toBe(true)
  })

  it('does not retry a real rejection -- retrying that would just be slower', () => {
    expect(isTransientError('column memories.project_id does not exist')).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})

describe('normaliseTitle', () => {
  it('matches regardless of case or surrounding whitespace', () => {
    expect(normaliseTitle('  The Book  ')).toBe(normaliseTitle('the book'))
  })
})

describe('findSource', () => {
  const corpus: Corpus = {
    rows: [
      { kind: 'memory', id: 'm1', projectId: null, title: 'Dad', text: 'Ten more proper conversations with dad, probably.' },
      { kind: 'project', id: 'p1', projectId: 'p1', title: 'The book', text: 'A novel where characters get swapped out.' },
    ],
    projectIdByTitle: new Map([['the book', 'p1']]),
    text: '',
  }

  it('resolves a real quote to the row it came from', () => {
    expect(findSource(corpus, 'ten more proper conversations with dad')?.id).toBe('m1')
  })

  it('survives retyped punctuation and case', () => {
    expect(findSource(corpus, 'CHARACTERS GET SWAPPED OUT')?.id).toBe('p1')
  })

  it('returns null for a quote nothing in the corpus actually says', () => {
    expect(findSource(corpus, 'a sentence nobody in this corpus ever wrote')).toBeNull()
  })

  it('returns null for a quote too short to mean anything', () => {
    expect(findSource(corpus, 'dad')).toBeNull()
  })
})
