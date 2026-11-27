import { describe, it, expect } from 'vitest'
import { readStep, readSteps, threadPrompt } from './mull-thread.js'

describe('the thread', () => {
  it('carries every step and what they said back', () => {
    const p = threadPrompt(['zebras are like dazzle ships', 'horseflies cannot land on stripes'], 'so is it about flies, not lions?')
    expect(p).toMatch(/1\. zebras are like dazzle ships\n2\. horseflies/)
    expect(p).toMatch(/WHAT THEY SAID BACK[\s\S]*flies, not lions/)
  })
  it('reads a usable step and refuses an empty or rambling one', () => {
    const take = 'Horseflies crash into the stripes and cannot land.'
    expect(readStep({ take, outside: 'Horseflies find hosts by polarised light.' })).toEqual({ take, outside: 'Horseflies find hosts by polarised light.' })
    expect(readStep({ take: '' })).toBeNull()
    expect(readStep({ take: Array(30).fill('word').join(' ') })).toBeNull()
    expect(readStep(null)).toBeNull()
  })

  it('asks for three candidates and not to answer the last line', () => {
    const p = threadPrompt(['Readers miss word changes in a sentence'])
    expect(p).toContain('THREE different candidates')
    expect(p).toContain('Do NOT answer the question')
  })

  it('reads three candidates, or the old single step, and drops the unusable', () => {
    const ok = 'Horseflies crash into the stripes and cannot land.'
    expect(readSteps({ steps: [{ take: ok, outside: 'x' }, { take: '' }, { take: ok + ' Again here.', outside: 'y' }] })).toHaveLength(2)
    expect(readSteps({ take: ok, outside: 'x' })).toHaveLength(1)
    expect(readSteps(null)).toEqual([])
  })
})
