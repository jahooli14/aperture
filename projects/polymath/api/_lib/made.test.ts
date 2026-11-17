import { describe, it, expect } from 'vitest'
import { cleanLink, oembedUrl, readOembed, readOpenGraph, madeOn, numberPieces, madeLine } from './made.js'

describe('cleanLink', () => {
  it('keeps https links, drops the rest', () => {
    expect(cleanLink('https://soundcloud.com/me/mix-7#t=1')).toBe('https://soundcloud.com/me/mix-7')
    expect(cleanLink('http://soundcloud.com/x')).toBeNull()
    expect(cleanLink('https://user:pw@site.com/')).toBeNull()
    expect(cleanLink('javascript:alert(1)')).toBeNull()
    expect(cleanLink('not a link')).toBeNull()
  })
})

describe('link previews', () => {
  it('knows SoundCloud and friends', () => {
    expect(oembedUrl('https://soundcloud.com/me/mix-7')).toMatch(/^https:\/\/soundcloud\.com\/oembed\?format=json&url=/)
    expect(oembedUrl('https://www.youtube.com/watch?v=x')).toMatch(/youtube\.com\/oembed/)
    expect(oembedUrl('https://docs.google.com/document/d/1')).toBeNull()
  })
  it('reads oEmbed and Open Graph, https images only', () => {
    expect(readOembed({ title: 'Zebra Crossing 7', thumbnail_url: 'https://i1.sndcdn.com/a.jpg', provider_name: 'SoundCloud' }))
      .toEqual({ title: 'Zebra Crossing 7', image: 'https://i1.sndcdn.com/a.jpg', site: 'SoundCloud' })
    expect(readOembed({ title: 'x', thumbnail_url: 'http://insecure.jpg' }).image).toBeUndefined()
    const html = '<head><meta property="og:title" content="Draft &amp; notes"><meta content="https://x.com/i.png" property="og:image"><title>Fallback</title></head>'
    expect(readOpenGraph(html)).toEqual({ title: 'Draft & notes', image: 'https://x.com/i.png', site: undefined })
    expect(readOpenGraph('<title>Only a title</title>').title).toBe('Only a title')
  })
})

describe('madeOn', () => {
  const today = new Date('2026-11-17T10:00:00Z')
  it('keeps a real past date, refuses the future and junk', () => {
    expect(madeOn('2019-05-02', today)).toBe('2019-05-02')
    expect(madeOn('2027-01-01', today)).toBe('2026-11-17')
    expect(madeOn('yesterday', today)).toBe('2026-11-17')
  })
})

describe('numberPieces', () => {
  it('numbers by the day made, whatever order they were added in', () => {
    const n = numberPieces([
      { id: 'c', made_on: '2024-01-01', created_at: '2026-11-17T10:00:00Z' },
      { id: 'a', made_on: '2019-05-02', created_at: '2026-11-17T10:02:00Z' },
      { id: 'b', made_on: null, created_at: '2026-11-17T10:01:00Z' },
    ])
    expect([n.get('a'), n.get('c'), n.get('b')]).toEqual([1, 2, 3])
  })
})

describe('madeLine', () => {
  it('names the piece and keeps their words', () => {
    expect(madeLine({ kind: 'link', link_meta: { title: 'Zebra Crossing 7' }, note: 'recorded at home, all vinyl', made_on: '2026-09-06' }))
      .toBe('2026-09-06: Zebra Crossing 7 — recorded at home, all vinyl')
    expect(madeLine({ kind: 'image', title: null, note: null })).toBe('a photo')
  })
})

import { madeSummary } from './made'
describe('madeSummary', () => {
  it('counts every piece and names the newest ones with words', () => {
    const s = madeSummary([
      { kind: 'image', made_on: '2019-03-01', created_at: '2026-11-17T00:00:00Z' },
      { kind: 'image', title: 'Harbour', note: 'for mum', made_on: '2026-10-01', created_at: '2026-11-17T00:00:00Z' },
      { kind: 'link', link_meta: { title: 'Mix 5' }, made_on: null, created_at: '2026-09-02T00:00:00Z' },
    ])
    expect(s).toBe('Made 3 pieces, the latest on 2026-10-01: 2026-10-01: Harbour — for mum; 2026-09-02: Mix 5.')
  })
  it('says nothing when nothing is made', () => {
    expect(madeSummary([])).toBe('')
  })
})

describe('readOpenGraph entities', () => {
  it('decodes &amp; in an image URL', async () => {
    const { readOpenGraph } = await import('./made')
    expect(readOpenGraph('<meta property="og:image" content="https://x.org/a.jpg?a=1&amp;b=2">').image).toBe('https://x.org/a.jpg?a=1&b=2')
  })
})
