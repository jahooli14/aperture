import { describe, it, expect } from 'vitest'
import {
  worthFollowingUp, buildFollowUpPrompt, readFollowUp, readFollowUpReason, joinTurns, MIN_ANSWER_CHARS,
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
    expect(p).toContain('"correction"')
    expect(p).toContain('"none"')
  })

  it('carries the house voice rules', () => {
    expect(p).toMatch(/sounds like/)
    expect(p.length).toBeGreaterThan(400)
  })
})

const asked = (reason: string, question: string | null) =>
  JSON.stringify({ reason, question })

describe('readFollowUp', () => {
  it('takes a question the model gave a reason for', () => {
    expect(readFollowUp(asked('correction', 'Which list did it move to?')))
      .toBe('Which list did it move to?')
    expect(readFollowUp(asked('next_step', 'What needs to happen to start it?')))
      .toBe('What needs to happen to start it?')
  })

  it('refuses a question with no reason behind it', () => {
    // The model has to name what is in their answer before it may ask.
    // Asked in prose it invented one: on "Ben's, I'll print his this
    // weekend, the design is done" — settled — it came back with "Wait,
    // you didn't give up on custom t-shirts in January?", disputing a
    // premise the user had never disputed. Twice.
    expect(readFollowUp(asked('none', 'Wait, you gave that up in January?'))).toBeNull()
    expect(readFollowUp(asked('none', null))).toBeNull()
    expect(readFollowUp(asked('vibes', 'Something?'))).toBeNull()
  })

  it('still reads a bare question, for a model that ignores the format', () => {
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

  it('refuses a binary, the same as the questions themselves', () => {
    // Two of four live follow-ups were binaries even with the prompt
    // banning them, so it is checked rather than asked for.
    expect(readFollowUp(asked('correction', 'Is it the same design, or did restarting change it?'))).toBeNull()
  })

  it('refuses a statement — that is the model narrating, not asking', () => {
    expect(readFollowUp('It sounds like you moved it to another list.')).toBeNull()
  })

  it('refuses a speech rather than a question', () => {
    const long = 'What do you think it was about that particular project that made you want to set it down and then come back to it again later on in the year?'
    expect(readFollowUp(long)).toBeNull()
  })
})

describe('readFollowUpReason', () => {
  it('reads which reason the model gave', () => {
    expect(readFollowUpReason(asked('correction', 'Which list did it move to?'))).toBe('correction')
    expect(readFollowUpReason(asked('next_step', 'What needs to happen to start it?'))).toBe('next_step')
  })

  it('is null for none, junk, or a bare question with no JSON shape', () => {
    expect(readFollowUpReason(asked('none', null))).toBeNull()
    expect(readFollowUpReason(asked('vibes', 'Something?'))).toBeNull()
    expect(readFollowUpReason('Which list did it move to?')).toBeNull()
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
