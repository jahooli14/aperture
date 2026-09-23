import { describe, it, expect } from 'vitest'
import { normaliseTitle, isTransientError, readableDate } from './mull-corpus.js'

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

describe('readableDate', () => {
  it('writes a date the way a person says it', () => {
    expect(readableDate('2025-03-14T09:00:00Z')).toBe('14 March 2025')
  })
  it('is empty for a missing or broken date rather than "Invalid Date"', () => {
    expect(readableDate(null)).toBe('')
    expect(readableDate('not a date')).toBe('')
  })
})
