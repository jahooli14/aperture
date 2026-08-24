import { describe, it, expect } from 'vitest'
import {
  normalizeTag,
  normalizeTags,
  collectVocabulary,
  MAX_TAGS_PER_PROJECT,
} from './project-tags.js'

describe('normalizeTag', () => {
  it('slugifies ordinary labels', () => {
    expect(normalizeTag('Music')).toBe('music')
    expect(normalizeTag('  Woodwork  ')).toBe('woodwork')
    expect(normalizeTag('Long Form Writing')).toBe('long-form-writing')
    expect(normalizeTag('long_form_writing')).toBe('long-form-writing')
  })

  it('strips punctuation and collapses separators', () => {
    expect(normalizeTag('sci-fi!!')).toBe('sci-fi')
    expect(normalizeTag('music // production')).toBe('music-production')
    expect(normalizeTag('--music--')).toBe('music')
  })

  it('rejects labels that would be useless as filters', () => {
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('   ')).toBeNull()
    expect(normalizeTag('a')).toBeNull()          // too short
    expect(normalizeTag('!!!')).toBeNull()        // nothing left after stripping
    expect(normalizeTag('x'.repeat(25))).toBeNull() // too long
  })

  it('rejects non-strings rather than coercing them', () => {
    expect(normalizeTag(null as unknown as string)).toBeNull()
    expect(normalizeTag(42 as unknown as string)).toBeNull()
  })
})

describe('normalizeTags', () => {
  it('dedupes labels that slugify to the same thing', () => {
    expect(normalizeTags(['Music', 'music', 'MUSIC'])).toEqual(['music'])
  })

  it('caps the number of labels per project', () => {
    const many = ['music', 'woodwork', 'writing', 'film', 'photography']
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS_PER_PROJECT)
  })

  it('drops junk entries but keeps the good ones', () => {
    expect(normalizeTags(['music', '', 'a', 'woodwork'])).toEqual(['music', 'woodwork'])
  })

  it('returns an empty array for anything that is not an array', () => {
    expect(normalizeTags(undefined)).toEqual([])
    expect(normalizeTags(null)).toEqual([])
    expect(normalizeTags('music')).toEqual([])
    expect(normalizeTags({ tags: ['music'] })).toEqual([])
  })
})

describe('collectVocabulary', () => {
  it('orders labels by how often they are already used', () => {
    const projects = [
      { metadata: { tags: ['music', 'electronics'] } },
      { metadata: { tags: ['music'] } },
      { metadata: { tags: ['music', 'woodwork'] } },
      { metadata: { tags: ['woodwork'] } },
    ]
    expect(collectVocabulary(projects)).toEqual(['music', 'woodwork', 'electronics'])
  })

  it('breaks ties alphabetically so the list is stable across calls', () => {
    const projects = [{ metadata: { tags: ['zither', 'anvil'] } }]
    expect(collectVocabulary(projects)).toEqual(['anvil', 'zither'])
  })

  it('ignores projects with no labels or no metadata', () => {
    const projects = [
      { metadata: { tags: ['music'] } },
      { metadata: {} },
      {},
      { metadata: { tags: [] } },
    ]
    expect(collectVocabulary(projects)).toEqual(['music'])
  })

  it('normalizes as it collects, so dirty stored data still groups', () => {
    const projects = [
      { metadata: { tags: ['Music'] } },
      { metadata: { tags: ['  music  '] } },
    ]
    expect(collectVocabulary(projects)).toEqual(['music'])
  })

  it('returns an empty vocabulary for an empty corpus', () => {
    expect(collectVocabulary([])).toEqual([])
  })
})
