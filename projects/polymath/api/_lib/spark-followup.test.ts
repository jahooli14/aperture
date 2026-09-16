import { describe, it, expect } from 'vitest'
import {
  worthFollowingUp, buildFollowUpPrompt, readFollowUp, joinTurns, MIN_ANSWER_CHARS,
} from './spark-followup.js'

describe('worthFollowingUp', () => {
  it('follows up on a real answer', () => {
    expect(worthFollowingUp("I gave up because the printer quote came back at 400 quid")).toBe(true)
  })

  it('leaves a shrug alone', () => {
    // A follow-up to "yeah" is the app being needy. One question a day.
    expect(worthFollowingUp('yeah')).toBe(false)
    expect(worthFollowingUp('not sure')).toBe(false)
    expect(worthFollowingUp('   ')).toBe(false)
    expect(MIN_ANSWER_CHARS).toBeGreaterThan(10)
  })
})

describe('buildFollowUpPrompt', () => {
  const p = buildFollowUpPrompt({
    question: 'You gave up on custom t-shirts in January. Which name goes on the first tag?',
    answer: 'Actually I never gave up, I just moved it to the other list.',
  })

  it('hands over both turns verbatim', () => {
    expect(p).toContain('Which name goes on the first tag?')
    expect(p).toContain('I just moved it to the other list')
  })

  it('goes looking for the correction first', () => {
    // The whole reason this exists: people correct you politely and move
    // on, and the app's model of them stays exactly as wrong as it was.
    expect(p).toMatch(/PREMISE WAS OFF/)
    expect(p).toContain('NONE')
  })

  it('carries the house voice rules', () => {
    expect(p).toMatch(/sounds like/)
    expect(p.length).toBeGreaterThan(400)
  })
})

describe('readFollowUp', () => {
  it('takes a short question', () => {
    expect(readFollowUp('Which list did it move to?')).toBe('Which list did it move to?')
  })

  it('strips quotes the model wraps around it', () => {
    expect(readFollowUp('"Which list did it move to?"')).toBe('Which list did it move to?')
  })

  it('reads NONE as nothing worth asking', () => {
    expect(readFollowUp('NONE')).toBeNull()
    expect(readFollowUp(' none ')).toBeNull()
    expect(readFollowUp('')).toBeNull()
  })

  it('refuses a statement — that is the model narrating, not asking', () => {
    expect(readFollowUp('It sounds like you moved it to another list.')).toBeNull()
  })

  it('refuses a speech rather than a question', () => {
    const long = 'What do you think it was about that particular project that made you want to set it down and then come back to it again later on in the year?'
    expect(readFollowUp(long)).toBeNull()
  })
})

describe('joinTurns', () => {
  it('reads as one thing they said, with no labels', () => {
    const note = joinTurns(['I never gave up on it.', 'It moved to the maybe list in March.'])
    expect(note).toBe('I never gave up on it.\n\nIt moved to the maybe list in March.')
    expect(note).not.toMatch(/Q:|A:|Answer|Follow/)
  })

  it('drops empty turns', () => {
    expect(joinTurns(['Only this.', '', '  '])).toBe('Only this.')
  })
})
