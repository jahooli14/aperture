import { describe, it, expect } from 'vitest'
import { rankCrossingPairs, pickCrossingPair, type CrossingProject } from './spark-crossing.js'

const song: CrossingProject = { id: 'p1', title: 'Graham song', tags: ['music'], fragmentCount: 5 }
const album: CrossingProject = { id: 'p2', title: 'The album', tags: ['music'], fragmentCount: 4 }
const shelf: CrossingProject = { id: 'p3', title: 'The shelf', tags: ['woodwork'], fragmentCount: 3 }
const untagged: CrossingProject = { id: 'p4', title: 'Something new', tags: [], fragmentCount: 2 }

describe('rankCrossingPairs', () => {
  it('puts a pair that crosses disciplines above one that does not', () => {
    const ranked = rankCrossingPairs([song, album, shelf])
    expect(ranked[0].crossesDisciplines).toBe(true)
    // music -> music is the safe, obvious pairing and must never win
    const musicToMusic = ranked.findIndex(p => p.from.id === 'p1' && p.to.id === 'p2')
    const musicToWood = ranked.findIndex(p => p.from.id === 'p1' && p.to.id === 'p3')
    expect(musicToWood).toBeLessThan(musicToMusic)
  })

  it('never carries a rule out of a project with nothing captured about it', () => {
    const silent: CrossingProject = { ...shelf, fragmentCount: 0 }
    const ranked = rankCrossingPairs([song, silent])
    expect(ranked.every(p => p.from.id !== silent.id)).toBe(true)
  })

  it('prefers the side with more material as the source, all else equal', () => {
    const ranked = rankCrossingPairs([song, shelf])
    expect(ranked[0].from.id).toBe('p1')
    expect(ranked[0].to.id).toBe('p3')
  })

  it('treats an untagged project as crossing rather than assuming adjacency', () => {
    // Assuming "no labels means related" would quietly rebuild the safe
    // same-discipline pairing this exists to avoid.
    const ranked = rankCrossingPairs([song, untagged])
    expect(ranked[0].crossesDisciplines).toBe(true)
  })

  it('reports what the two actually share, so the prompt can be honest about the distance', () => {
    const both: CrossingProject = { id: 'p5', title: 'Mixtape', tags: ['music', 'art'], fragmentCount: 1 }
    const pair = rankCrossingPairs([song, both]).find(p => p.from.id === 'p1' && p.to.id === 'p5')
    expect(pair?.sharedTags).toEqual(['music'])
    expect(pair?.crossesDisciplines).toBe(false)
  })

  it('ranks ordered pairs, since which direction to carry the rule matters', () => {
    const ranked = rankCrossingPairs([song, shelf])
    expect(ranked).toHaveLength(2)
    expect(ranked.map(p => `${p.from.id}->${p.to.id}`).sort()).toEqual(['p1->p3', 'p3->p1'])
  })
})

describe('pickCrossingPair', () => {
  it('returns nothing when there is only one project to work with', () => {
    expect(pickCrossingPair([song])).toBeNull()
  })

  it('returns nothing rather than forcing a connection when everything is silent', () => {
    expect(pickCrossingPair([{ ...song, fragmentCount: 0 }, { ...shelf, fragmentCount: 0 }])).toBeNull()
  })

  it('skips a project that was already the subject recently', () => {
    const picked = pickCrossingPair([song, album, shelf], ['p3'])
    expect(picked?.to.id).not.toBe('p3')
  })

  it('applies the cooldown to the project being carried INTO, not the source', () => {
    // The source can keep supplying rules; it's the subject that shouldn't
    // repeat, because that's what the user is asked to think about.
    const picked = pickCrossingPair([song, shelf], ['p3'])
    expect(picked?.from.id).toBe('p3')
    expect(picked?.to.id).toBe('p1')
  })

  it('picks a cross-discipline pair over a same-discipline one', () => {
    expect(pickCrossingPair([song, album, shelf])?.crossesDisciplines).toBe(true)
  })
})
