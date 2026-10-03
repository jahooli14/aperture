import { describe, it, expect } from 'vitest'
import { sourcesOf } from './mull-generator'
import type { CorpusRow } from './mull-corpus'

const row = (id: string, captureId: string, title: string): CorpusRow =>
  ({ kind: 'memory', id, ref: id, captureId, projectId: null, title, text: `${title} text`, meta: '' })

describe('sourcesOf', () => {
  it('lists each distinct capture once, by title', () => {
    expect(sourcesOf([row('a', 'c1', 'Willow stump'), row('b', 'c1', 'Willow stump'), row('c', 'c2', 'Oscar')]))
      .toEqual([{ kind: 'memory', title: 'Willow stump' }, { kind: 'memory', title: 'Oscar' }])
  })
  it('falls back to the text when there is no title', () => {
    expect(sourcesOf([row('a', 'c1', '')])[0].title).toBe('text')
  })
})
