import { describe, it, expect } from 'vitest'
import { buildShapingPrompt, evidenceFromDump, questionFor } from './project-shaping.js'

const DUMP = "It's a song for Graham's 40th. Got a rough vocal down. Want it finished before the party in November."

describe('evidenceFromDump', () => {
  it('cuts a voice note into citable sentences', () => {
    const ev = evidenceFromDump(DUMP)
    expect(ev.map(e => e.text)).toEqual([
      "It's a song for Graham's 40th.",
      'Got a rough vocal down.',
      'Want it finished before the party in November.',
    ])
    expect(ev[0].id).toBe('e1')
  })

  it('also splits on newlines and drops fragments', () => {
    expect(evidenceFromDump('a\nSecond line here\n\nok').map(e => e.text)).toEqual(['Second line here'])
  })
})

describe('buildShapingPrompt', () => {
  it('extracts rather than interviews', () => {
    const p = buildShapingPrompt(DUMP, [])
    expect(p).toContain('Do not ask')
    expect(p).toContain("[e1] It's a song for Graham's 40th.")
  })

  it('refuses to invent a finish line, and says an ongoing thing has none', () => {
    const p = buildShapingPrompt(DUMP, [])
    expect(p).toContain('do not invent a finish line')
    expect(p).toContain('An ongoing thing')
  })

  it('plans backwards when done is known and forwards when it is not, in one prompt', () => {
    const p = buildShapingPrompt(DUMP, [])
    expect(p).toContain('If end_goal is known: work BACKWARDS')
    expect(p).toContain('If end_goal is null:')
  })

  it('makes the order a rule, with the stencil anti-example', () => {
    const p = buildShapingPrompt(DUMP, [])
    expect(p).toContain('THE ORDER IS THE PLAN')
    expect(p).toContain('"after"')
  })

  it('prefers the labels the user already has over new near-synonyms', () => {
    const p = buildShapingPrompt(DUMP, ['music', 'woodwork'])
    expect(p).toContain('strongly prefer reusing one of these')
    expect(p).toContain('music, woodwork')
  })

  it('leaves the label block out when there are none yet', () => {
    expect(buildShapingPrompt(DUMP, [])).not.toContain('strongly prefer reusing')
  })

  it('holds the same no-invention line as everywhere else', () => {
    expect(buildShapingPrompt(DUMP, [])).toContain('this project has no guitar')
  })

  it('bans admin dressed as building', () => {
    const p = buildShapingPrompt(DUMP, [])
    for (const v of ['research', 'decide', 'brainstorm']) expect(p).toContain(v)
  })
})

describe('questionFor', () => {
  it('asks for the first real thing, never for a finish line', () => {
    expect(questionFor('Graham song')).toBe("What's the first thing that has to exist for Graham song?")
  })
})
