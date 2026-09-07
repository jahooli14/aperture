import { describe, it, expect } from 'vitest'
import {
  tidyBullet,
  cleanBullets,
  cleanTopics,
  parseGistResponse,
  stripTags,
  wordCount,
} from './article-gist'

describe('tidyBullet', () => {
  it('strips list markers the model adds back in', () => {
    expect(tidyBullet('- Task composition beats one big prompt.')).toBe('Task composition beats one big prompt.')
    expect(tidyBullet('1. Two thirds of runs failed.')).toBe('Two thirds of runs failed.')
  })

  it('drops the "the author argues that" scaffolding and recapitalises', () => {
    expect(tidyBullet('The author argues that shared subtasks get reused.'))
      .toBe('Shared subtasks get reused.')
  })

  it('drops "this article covers" openers', () => {
    expect(tidyBullet('This article explores hybrid systems of people and software.'))
      .toBe('Hybrid systems of people and software.')
  })

  it('leaves a bullet that genuinely starts lowercase alone', () => {
    expect(tidyBullet('iPhone sales fell 12% in the quarter.'))
      .toBe('iPhone sales fell 12% in the quarter.')
  })

  it('caps a runaway bullet at a word boundary', () => {
    const long = 'word '.repeat(80)
    const out = tidyBullet(long)
    expect(out.length).toBeLessThanOrEqual(181)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('cleanBullets', () => {
  it('takes at most three', () => {
    expect(cleanBullets(['one bullet here', 'two bullet here', 'three bullet here', 'four bullet here']))
      .toHaveLength(3)
  })

  it('drops bullets that break the plain-English rules', () => {
    const out = cleanBullets([
      'Shared subtasks get reused across workflows.',
      'This unlocks transformative synergies for teams.',
    ])
    expect(out).toEqual(['Shared subtasks get reused across workflows.'])
  })

  it('drops near-duplicates and stubs', () => {
    expect(cleanBullets(['Same point made twice.', 'same point made twice', 'tiny'])).toEqual([
      'Same point made twice.',
    ])
  })

  it('returns nothing for a non-array', () => {
    expect(cleanBullets('not an array')).toEqual([])
    expect(cleanBullets(null)).toEqual([])
  })
})

describe('cleanTopics', () => {
  it('dedupes case-insensitively and caps at five', () => {
    expect(cleanTopics(['AI', 'ai', 'interfaces', 'coordination', 'design', 'systems', 'tools']))
      .toEqual(['AI', 'interfaces', 'coordination', 'design', 'systems'])
  })

  it('drops sentence-length "topics"', () => {
    expect(cleanTopics(['ok', 'a topic that is really an entire sentence about many different things']))
      .toEqual(['ok'])
  })
})

describe('parseGistResponse', () => {
  it('reads JSON out of a fenced response', () => {
    const text = '```json\n{"bullets":["First real point here.","Second real point here."],"topics":["ai"]}\n```'
    expect(parseGistResponse(text)).toEqual({
      bullets: ['First real point here.', 'Second real point here.'],
      topics: ['ai'],
    })
  })

  it('returns empties rather than throwing on junk', () => {
    expect(parseGistResponse('sorry, I cannot help')).toEqual({ bullets: [], topics: [] })
    expect(parseGistResponse('{not json at all}')).toEqual({ bullets: [], topics: [] })
  })
})

describe('stripTags / wordCount', () => {
  it('removes markup and decodes the common entities', () => {
    expect(stripTags('<p>Hello &amp; <strong>welcome</strong></p>')).toBe('Hello & welcome')
  })

  it('does not count script or style bodies as words', () => {
    expect(stripTags('<script>var a = 1;</script><p>two words</p>')).toBe('two words')
    expect(wordCount(stripTags('<p>two words</p>'))).toBe(2)
  })

  it('counts an empty document as zero', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('   ')).toBe(0)
  })
})
