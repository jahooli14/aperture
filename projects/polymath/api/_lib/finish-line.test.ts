import { describe, it, expect } from 'vitest'
import { buildFinishLinePrompt, sanitizeFinishLine, judgeFinishLine } from './finish-line.js'

describe('buildFinishLinePrompt', () => {
  const p = buildFinishLinePrompt({
    title: 'Paint pouring stencil',
    endGoal: 'A framed print on the hallway wall',
    doneTasks: ['Cut the stencil', 'Pour the paint'],
    closeouts: ['Poured it, looks good, needs to dry'],
  })

  it('quotes the finish line as the user wrote it', () => {
    expect(p).toContain('"A framed print on the hallway wall"')
  })

  it('lists what has been done and what was said', () => {
    expect(p).toContain('- Cut the stencil')
    expect(p).toContain('- "Poured it, looks good, needs to dry"')
  })

  it('tells the model a finished list is not a finished project', () => {
    expect(p).toContain('that ran out')
  })

  it('bans advice and encouragement in the reason', () => {
    expect(p).toContain('no encouragement, no\n  advice')
  })
})

describe('sanitizeFinishLine', () => {
  it('keeps a well-formed verdict', () => {
    expect(sanitizeFinishLine({ reached: false, reason: 'Nothing above shows the print was framed.' }))
      .toEqual({ reached: false, reason: 'Nothing above shows the print was framed.' })
  })

  it('rejects a verdict without a boolean or a reason', () => {
    expect(sanitizeFinishLine({ reached: 'yes', reason: 'x' })).toBeNull()
    expect(sanitizeFinishLine({ reached: true, reason: '' })).toBeNull()
    expect(sanitizeFinishLine(null)).toBeNull()
  })

  it('rejects an essay', () => {
    expect(sanitizeFinishLine({ reached: true, reason: 'x'.repeat(300) })).toBeNull()
  })
})

describe('judgeFinishLine', () => {
  it('stays quiet with no finish line to judge against', async () => {
    expect(await judgeFinishLine({ title: 'x', endGoal: '  ', doneTasks: [], closeouts: [] })).toBeNull()
  })

  it('stays quiet when the model is unreachable', async () => {
    // No GEMINI_API_KEY in the test env: a wrong "you're done" costs more
    // than saying nothing.
    expect(await judgeFinishLine({ title: 'x', endGoal: 'done', doneTasks: ['a'], closeouts: [] })).toBeNull()
  })
})
