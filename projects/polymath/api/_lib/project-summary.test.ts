import { describe, it, expect } from 'vitest'
import { readSummary, basisOf, checkSummary, summaryPrompt, type SummaryMaterial } from './project-summary.js'

const m: SummaryMaterial = {
  title: 'Going Analogue', description: 'A man drops off the internet', endGoal: null,
  said: [
    { at: '2026-10-17', text: 'about 14% through the edit, aiming for 42,000 words' },
    { at: '2026-09-27', text: 'moving it to him not being able to sleep, his sleep is forever', answer: 'What does he learn offline?' },
  ],
}

describe('project summary', () => {
  it('reads only a real paragraph, and keeps whose it is', () => {
    expect(readSummary({ summary: { text: 'Mine.', by: 'you', at: 'x' } })?.by).toBe('you')
    expect(readSummary({ summary: { text: 'Drafted.', by: 'anything' } })?.by).toBe('notes')
    expect(readSummary({ summary: { text: '  ' } })).toBeNull()
    expect(readSummary(null)).toBeNull()
  })
  it('changes its basis when something new is said', () => {
    expect(basisOf(m)).not.toBe(basisOf({ ...m, said: [{ at: '2026-11-01', text: 'new' }, ...m.said] }))
  })
  it('hands the model their answers, newest first, with the question they answered', () => {
    const p = summaryPrompt(m)
    expect(p.indexOf('2026-10-17')).toBeLessThan(p.indexOf('2026-09-27'))
    expect(p).toMatch(/answering "What does he learn offline\?"/)
  })
  it('refuses a paragraph that names something nobody said', () => {
    expect(checkSummary('Your book is about a man who cannot sleep, at 42,000 words.', m)).toBeNull()
    expect(checkSummary('Your book is set in Glasgow and runs to 90,000 words.', m)).toMatch(/nobody said/)
  })
})
