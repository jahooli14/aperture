import { describe, it, expect } from 'vitest'
import { stripCitationTags, stripCitationTagsDeep } from './citation-tags'

describe('stripCitationTags', () => {
  it('removes a single tag and the space before it', () => {
    expect(stripCitationTags('a side table [e1]')).toBe('a side table')
  })

  it('removes a list of tags', () => {
    expect(stripCitationTags('Apply oil to the wood [e1, e2]')).toBe('Apply oil to the wood')
  })

  it('removes tags in the middle of a sentence', () => {
    expect(stripCitationTags('Cut the willow stump [e1] with a chainsaw [e2]')).toBe(
      'Cut the willow stump with a chainsaw',
    )
  })

  it('leaves ordinary brackets alone', () => {
    expect(stripCitationTags('Record the intro [take 2]')).toBe('Record the intro [take 2]')
  })

  it('leaves the mull channel refs alone', () => {
    expect(stripCitationTags('[N12] and [P3]')).toBe('[N12] and [P3]')
  })
})

describe('stripCitationTagsDeep', () => {
  it('cleans nested strings and keeps the evidence field intact', () => {
    const out = stripCitationTagsDeep({
      end_goal: 'a side table [e1]',
      steps: [{ text: 'Sand it [e2]', evidence: ['e2'], after: [] }],
    })
    expect(out.end_goal).toBe('a side table')
    expect(out.steps[0].text).toBe('Sand it')
    expect(out.steps[0].evidence).toEqual(['e2'])
  })
})
