import { describe, it, expect } from 'vitest'
import { buildShapingPrompt, questionFor } from './project-shaping.js'

const DUMP = "It's a song for Graham's 40th. Got a rough vocal down. Want it finished before the party in November."

describe('buildShapingPrompt', () => {
  it('extracts rather than interviews', () => {
    const p = buildShapingPrompt(DUMP, [])
    expect(p).toContain('Do not ask them anything')
    expect(p).toContain(DUMP)
  })

  it('refuses to invent a finish line, and says why', () => {
    const p = buildShapingPrompt(DUMP, [])
    expect(p).toContain('do not invent a finish line')
    expect(p).toContain('backwards from this')
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
    expect(buildShapingPrompt(DUMP, [])).toContain('No gear, brands, formats, people or places unless')
  })
})

describe('questionFor', () => {
  it('asks for the finish line when that is what is missing', () => {
    expect(questionFor('end_goal', 'Graham song')).toBe(
      'When Graham song is finished, what have you actually got?',
    )
  })

  it('asks nothing when the dump covered it', () => {
    expect(questionFor('nothing', 'Graham song')).toBeNull()
  })
})
