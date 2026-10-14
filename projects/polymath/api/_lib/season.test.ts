import { describe, it, expect } from 'vitest'
import { readSeason, readSeasonTag, inSeason, isRealDate, leadsWithFun, parseSeasonProposal, MAX_ALSO, type SeasonProject } from './season'
import { orderBySlots, slotOf } from './mull'
import type { CorpusRow } from './mull-corpus'

const now = new Date('2026-10-14T12:00:00Z')
const p = (over: Partial<SeasonProject> & { id: string }): SeasonProject =>
  ({ title: over.id, status: 'active', state: 'on-deck', is_priority: false, metadata: {}, ...over })
const also = (until: string | null) => ({ season: { role: 'also', until, label: null } })

describe('readSeason', () => {
  it('the main project is the live one, the others are tagged and in date', () => {
    const s = readSeason([
      p({ id: 'book', title: 'Going Analogue', state: 'live', metadata: { season: { role: 'main', until: '2026-12-25', label: 'Christmas' } } }),
      p({ id: 'toy', title: "Oscar's toy", metadata: also('2026-12-25') }),
      p({ id: 'paint', metadata: {} }),
    ], now)
    expect(s.main).toEqual({ id: 'book', title: 'Going Analogue' })
    expect(s.also).toEqual([{ id: 'toy', title: "Oscar's toy" }])
    expect(s.until).toBe('2026-12-25')
    expect(s.label).toBe('Christmas')
  })

  it('drops the others, and the date, once the season has ended', () => {
    const s = readSeason([
      p({ id: 'book', state: 'live', metadata: { season: { role: 'main', until: '2026-10-01', label: 'Autumn' } } }),
      p({ id: 'toy', metadata: also('2026-10-01') }),
    ], now)
    expect(s.main?.id).toBe('book')
    expect(s.also).toEqual([])
    expect(s.until).toBeNull()
  })

  it('an open-ended tag keeps counting, and only two others ever do', () => {
    const s = readSeason([
      p({ id: 'book', state: 'live' }),
      p({ id: 'a', metadata: also(null) }), p({ id: 'b', metadata: also(null) }), p({ id: 'c', metadata: also(null) }),
    ], now)
    expect(s.also).toHaveLength(MAX_ALSO)
  })

  it('skips finished projects and has no main without a live one', () => {
    expect(readSeason([p({ id: 'x', status: 'completed', state: 'live' })], now).main).toBeNull()
    expect(readSeason([p({ id: 'book', state: 'live' }), p({ id: 'old', status: 'abandoned', metadata: also(null) })], now).also).toEqual([])
  })

  it('a live project with no season is not a season', () => {
    expect(readSeason([p({ id: 'book', state: 'live' })], now).active).toBe(false)
    expect(readSeason([p({ id: 'book', state: 'live', metadata: { season: { role: 'main', until: '2026-10-01', label: null } } })], now).active).toBe(false)
  })

  it('is active once the main has an in-date tag, or others are tagged', () => {
    expect(readSeason([p({ id: 'book', state: 'live', metadata: { season: { role: 'main', until: '2026-12-25', label: null } } })], now).active).toBe(true)
    expect(readSeason([p({ id: 'book', state: 'live' }), p({ id: 'toy', metadata: also('2026-12-25') })], now).active).toBe(true)
  })

  it('falls back to the starred project when none is live', () => {
    expect(readSeason([p({ id: 'star', is_priority: true })], now).main?.id).toBe('star')
  })
})

describe('tags and days', () => {
  it('reads only a well-formed tag', () => {
    expect(readSeasonTag({ season: { role: 'main', until: 'soon', label: ' Xmas ' } })).toEqual({ role: 'main', until: null, label: 'Xmas' })
    expect(readSeasonTag({ season: { role: 'boss' } })).toBeNull()
    expect(readSeasonTag(null)).toBeNull()
  })
  it('a season runs through its last day, with a grace for timezones', () => {
    expect(inSeason({ role: 'also', until: '2026-10-14', label: null }, now)).toBe(true)
    // 22:00 on the 13th somewhere in the Pacific: still the last day there.
    expect(inSeason({ role: 'also', until: '2026-10-13', label: null }, now)).toBe(true)
    expect(inSeason({ role: 'also', until: '2026-10-12', label: null }, now)).toBe(false)
  })
  it('only a real calendar date counts', () => {
    expect(isRealDate('2026-12-25')).toBe(true)
    expect(isRealDate('2026-02-31')).toBe(false)
    expect(isRealDate('2999-99-99')).toBe(false)
    expect(isRealDate('Christmas')).toBe(false)
  })
  it('leads with something fun about one day in three', () => {
    const days = Array.from({ length: 30 }, (_, i) => leadsWithFun(new Date(Date.UTC(2026, 9, 1 + i, 9)))).filter(Boolean)
    expect(days.length).toBe(10)
  })
})

describe('saying it out loud', () => {
  const projects = [{ id: 'book', title: 'Going Analogue' }, { id: 'toy', title: "Oscar's toy" }, { id: 'paint', title: 'Paint pouring' }]
  const ok = (o: object) => parseSeasonProposal(JSON.stringify(o), projects, '2026-10-14')

  it('keeps titles that match, a date that holds and a short label', () => {
    expect(ok({ main: 'Going Analogue', also: ["oscar's toy"], until: '2026-12-25', label: 'Christmas' })).toEqual({
      main: { id: 'book', title: 'Going Analogue' }, also: [{ id: 'toy', title: "Oscar's toy" }], until: '2026-12-25', label: 'Christmas',
    })
  })
  it('drops a title that is not a project, a date that has passed, and a repeat of the main', () => {
    const r = ok({ main: 'Going Analogue', also: ['A film script', 'Going Analogue', 'Paint pouring'], until: '2026-01-01', label: '' })
    expect(r?.also).toEqual([{ id: 'paint', title: 'Paint pouring' }])
    expect(r?.until).toBeNull()
    expect(r?.label).toBeNull()
  })
  it('says nothing when nothing it heard is real', () => {
    expect(ok({ main: 'Imaginary', also: [] })).toBeNull()
    expect(parseSeasonProposal('not json', projects, '2026-10-14')).toBeNull()
  })
})

describe('slots', () => {
  const row = (ref: string, over: Partial<CorpusRow> = {}): CorpusRow =>
    ({ kind: 'memory', id: ref, captureId: ref, ref, projectId: null, title: '', text: 'x', meta: '', ...over })
  it('main if it leans on the main project, also if on another, else wild', () => {
    expect(slotOf([row('F1', { kind: 'fragment', projectId: 'book' }), row('N1')], 'book', ['toy']).slot).toBe('main')
    expect(slotOf([row('F2', { kind: 'fragment', projectId: 'toy' }), row('N1')], 'book', ['toy'])).toEqual({ slot: 'also', projectId: 'toy' })
    expect(slotOf([row('N1'), row('N2')], 'book', ['toy']).slot).toBe('wild')
  })
  it('the declared project counts when the rows alone do not show it', () => {
    expect(slotOf([row('N1'), row('N2')], 'book', ['toy'], 'toy')).toEqual({ slot: 'also', projectId: 'toy' })
    expect(slotOf([row('N1')], 'book', ['toy'], 'book').slot).toBe('main')
    expect(slotOf([row('N1')], 'book', ['toy'], 'mural').slot).toBe('wild')
  })
  it('never puts a weak take ahead of a far better one just for its slot', () => {
    const items = [{ n: 'wild', s: 'wild', r: 50 }, { n: 'main', s: 'main', r: 20 }, { n: 'also', s: 'also', r: 45 }] as const
    const out = orderBySlots([...items], t => t.s, false, t => t.r)
    expect(out.map(t => t.n)).toEqual(['also', 'wild', 'main'])
    // Close enough, and the slot order holds.
    const close = [{ n: 'wild', s: 'wild', r: 50 }, { n: 'main', s: 'main', r: 42 }] as const
    expect(orderBySlots([...close], t => t.s, false, t => t.r).map(t => t.n)).toEqual(['main', 'wild'])
  })
  it('orders main, also, wild, also; or wild first; and skips a slot nobody filled', () => {
    const items = [{ n: 'w', s: 'wild' }, { n: 'a', s: 'also' }, { n: 'm', s: 'main' }, { n: 'm2', s: 'main' }] as const
    const slot = (t: (typeof items)[number]) => t.s
    expect(orderBySlots([...items], slot, false).map(t => t.n)).toEqual(['m', 'a', 'w', 'm2'])
    const two: { n: string; s: 'main' | 'also' | 'wild' }[] = [...items, { n: 'a2', s: 'also' }]
    expect(orderBySlots(two, t => t.s, false).map(t => t.n)).toEqual(['m', 'a', 'w', 'a2', 'm2'])
    expect(orderBySlots([...items], slot, true).map(t => t.n)).toEqual(['w', 'm', 'a', 'm2'])
    expect(orderBySlots([items[2], items[3]], slot, false).map(t => t.n)).toEqual(['m', 'm2'])
  })
})
