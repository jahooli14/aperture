import { describe, it, expect } from 'vitest'
import { voiceReminderCopy } from './voice-reminder-copy'

describe('voiceReminderCopy', () => {
  it('quotes the unanswered take first', () => {
    const c = voiceReminderCopy({ take: 'I think your projects die the moment someone else could see them.', project: 'Book' })
    expect(c.title).toBe('Still thinking about this?')
    expect(c.body).toContain('I think your projects die')
  })

  it('cuts a long take at a word and adds an ellipsis', () => {
    const long = 'I think ' + 'every single one of your projects stalls right where it would have to be seen '.repeat(3)
    const c = voiceReminderCopy({ take: long })
    expect(c.body.length).toBeLessThan(130)
    expect(c.body).toContain('…')
  })

  it('falls back to the live project, then to a plain ask', () => {
    expect(voiceReminderCopy({ project: 'Going Analogue' }).title).toBe('Where are you with Going Analogue?')
    expect(voiceReminderCopy({}).title).toBe('What’s on your mind?')
    expect(voiceReminderCopy({ take: '  ', project: ' ' }).body).toContain('tomorrow')
  })

  it('never nags about a miss', () => {
    const all = [voiceReminderCopy({}), voiceReminderCopy({ project: 'X' }), voiceReminderCopy({ take: 'Y' })]
    for (const c of all) expect(`${c.title} ${c.body}`.toLowerCase()).not.toMatch(/streak|missed|don't forget|haven't/)
  })
})
