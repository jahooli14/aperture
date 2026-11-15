import { describe, it, expect } from 'vitest'
import { readStep, threadPrompt } from './mull-thread.js'

describe('the thread', () => {
  it('carries every step and what they said back', () => {
    const p = threadPrompt(['zebras are like dazzle ships', 'horseflies cannot land on stripes'], 'so is it about flies, not lions?')
    expect(p).toMatch(/1\. zebras are like dazzle ships\n2\. horseflies/)
    expect(p).toMatch(/WHAT THEY SAID BACK[\s\S]*flies, not lions/)
  })
  it('reads a usable step and refuses an empty or rambling one', () => {
    const take = 'Horseflies find a host by the polarised light off a dark coat. Stripes break that light into bits. Are the stripes for the flies, not the lions?'
    expect(readStep({ take, outside: 'Horseflies find hosts by polarised light.' })).toEqual({ take, outside: 'Horseflies find hosts by polarised light.' })
    expect(readStep({ take: '' })).toBeNull()
    expect(readStep({ take: Array(80).fill('word').join(' ') })).toBeNull()
    expect(readStep(null)).toBeNull()
  })
})

describe('readStep, the fact left out', () => {
  it('refuses a bare claim whose fact went into "outside" only', () => {
    expect(readStep({ take: 'A loop has no room for an ending.', outside: 'Joyce ended Finnegans Wake mid-sentence.' })).toBeNull()
  })
})
