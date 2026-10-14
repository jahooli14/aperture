import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()
vi.mock('./gemini-chat.js', () => ({ generateText: (...a: unknown[]) => generateText(...a) }))
const { handleSeason } = await import('./season-routes.js')

type Row = Record<string, any>

/** Just enough PostgREST for this route: filters by eq/neq, update, select. */
function fakeDb(projects: Row[], failWritesOn: string | null = null) {
  const builder = () => {
    let rows = projects
    let patch: Row | null = null
    const chain: any = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (c: string, v: unknown) => { rows = rows.filter(r => r[c] === v); if (c === 'id') chain.__failIf = v as string; return chain },
      neq: (c: string, v: unknown) => { rows = rows.filter(r => r[c] !== v); return chain },
      update: (p: Row) => { patch = p; return chain },
      __failIf: null as string | null,
      single: async () => ({ data: rows[0] ? { ...rows[0] } : null, error: null }),
      then: (resolve: (v: { data: Row[] | null; error: { message: string } | null }) => unknown) => {
        if (patch && failWritesOn && chain.__failIf === failWritesOn && patch.metadata) {
          return resolve({ data: null, error: { message: 'write failed' } })
        }
        if (patch) rows.forEach(r => Object.assign(r, patch))
        return resolve({ data: rows.map(r => ({ ...r })), error: null })
      },
    }
    return chain
  }
  return { from: () => builder() } as any
}

const base = (over: Row & { id: string }): Row => ({
  user_id: 'u1', title: over.id, state: 'on-deck', status: 'active', is_priority: false, metadata: {}, ...over,
})
function call(db: any, body: Row) {
  let status = 200
  let json: any
  const res: any = { status: (s: number) => { status = s; return res }, json: (j: unknown) => { json = j; return res } }
  return handleSeason({ method: 'POST', body } as any, res, db, 'u1').then(() => ({ status, json }))
}

let projects: Row[]
beforeEach(() => {
  generateText.mockReset()
  projects = [
    base({ id: 'book', title: 'Going Analogue', state: 'live', is_priority: true, metadata: { tasks: [1] } }),
    base({ id: 'toy', title: "Oscar's toy" }),
    base({ id: 'paint', title: 'Paint pouring', metadata: { season: { role: 'also', until: '2999-01-01', label: 'Old' } } }),
    base({ id: 'dead', title: 'Dead', status: 'abandoned' }),
  ]
})

describe('small finishes', () => {
  it('saves size, what it waits on and a start day, and "got it" clears the wait', async () => {
    const db = fakeDb(projects)
    await call(db, {
      action: 'apply', main_id: 'book', until: '2999-12-25',
      also: [{ id: 'toy', size: 'weekend', waiting: 'the wood' }, { id: 'paint', size: 'hours', from: '2999-01-01' }],
    })
    const meta = (id: string) => projects.find(p => p.id === id)!.metadata.season
    expect(meta('toy')).toMatchObject({ role: 'also', size: 'weekend', waiting: 'the wood' })
    expect(meta('paint')).toMatchObject({ size: 'hours', from: '2999-01-01' })

    const { json } = await call(db, { action: 'unblock', project_id: 'toy' })
    expect(meta('toy')).toMatchObject({ waiting: null, from: null, size: 'weekend' })
    expect(json.season.also.find((a: any) => a.id === 'toy').blocked).toBe(false)
  })
  it('refuses to unblock something that is not in the season', async () => {
    const { status } = await call(fakeDb(projects), { action: 'unblock', project_id: 'toy' })
    expect(status).toBe(400)
  })
  it('drops a start day that is not a real date', async () => {
    await call(fakeDb(projects), { action: 'apply', main_id: 'book', also: [{ id: 'toy', from: '2026-02-31' }] })
    expect(projects.find(p => p.id === 'toy')!.metadata.season.from).toBeNull()
  })
})

describe('applying a season', () => {
  it('makes the main one live, tags the others, and clears the old season', async () => {
    const { json } = await call(fakeDb(projects), { action: 'apply', main_id: 'toy', also_ids: ['book'], until: '2999-12-25', label: 'Christmas' })
    const by = (id: string) => projects.find(p => p.id === id)!
    expect(by('toy').state).toBe('live')
    expect(by('toy').metadata.season).toEqual({ role: 'main', until: '2999-12-25', label: 'Christmas' })
    expect(by('book').state).toBe('on-deck')
    expect(by('book').metadata.season.role).toBe('also')
    expect(by('book').metadata.tasks).toEqual([1]) // nothing else on it is wiped
    expect(by('paint').metadata.season).toBeUndefined() // the old season is gone
    expect(json.season.main).toEqual({ id: 'toy', title: "Oscar's toy" })
    expect(json.season.also.map((a: { id: string }) => a.id)).toEqual(['book'])
  })

  it('refuses a main that is not one of your active projects', async () => {
    expect((await call(fakeDb(projects), { action: 'apply', main_id: 'dead' })).status).toBe(400)
    expect((await call(fakeDb(projects), { action: 'apply', main_id: 'nope' })).status).toBe(400)
  })

  it('drops unknown or repeated others and keeps two at most', async () => {
    await call(fakeDb(projects), { action: 'apply', main_id: 'book', also_ids: ['ghost', 'book', 'toy', 'toy', 'paint', 'dead', 'extra'], until: '2999-12-25' })
    const tagged = projects.filter(p => p.metadata.season?.role === 'also').map(p => p.id)
    expect(tagged).toEqual(['toy', 'paint'])
  })

  it('says so about a date that has passed or is not real, instead of quietly making it open-ended', async () => {
    const past = await call(fakeDb(projects), { action: 'apply', main_id: 'book', until: '2001-01-01' })
    expect(past.status).toBe(400)
    expect(past.json.error).toMatch(/passed/)
    const fake = await call(fakeDb(projects), { action: 'apply', main_id: 'book', until: '2026-02-31' })
    expect(fake.status).toBe(400)
    expect(projects.every(p => !p.metadata.season?.role || p.id === 'paint')).toBe(true) // nothing was written
  })

  it('a failed tag write says so instead of returning a half-written season', async () => {
    const { status, json } = await call(fakeDb(projects, 'toy'), { action: 'apply', main_id: 'book', also_ids: ['toy'], until: '2999-12-25' })
    expect(status).toBe(500)
    expect(json.error).toMatch(/Couldn't save/)
  })

  it('no date means open-ended, on purpose', async () => {
    await call(fakeDb(projects), { action: 'apply', main_id: 'book' })
    expect(projects.find(p => p.id === 'book')!.metadata.season.until).toBeNull()
  })

  it('clearing removes every tag and leaves the live project live', async () => {
    await call(fakeDb(projects), { action: 'clear' })
    expect(projects.every(p => !p.metadata.season)).toBe(true)
    expect(projects.find(p => p.id === 'book')!.state).toBe('live')
  })
})

describe('reading what they said', () => {
  it('matches what the model heard to real projects and saves nothing', async () => {
    generateText.mockResolvedValue(JSON.stringify({ main: 'Going Analogue', also: ["Oscar's toy", 'Invented'], until: '2999-12-25', label: 'Christmas' }))
    const { json } = await call(fakeDb(projects), { action: 'read', text: 'Until Christmas the book is main' })
    expect(json.proposal.main.id).toBe('book')
    expect(json.proposal.also.map((a: { id: string }) => a.id)).toEqual(['toy'])
    expect(projects.find(p => p.id === 'toy')!.metadata.season).toBeUndefined()
  })

  it('says nothing when the model fails', async () => {
    generateText.mockRejectedValue(new Error('timeout'))
    expect((await call(fakeDb(projects), { action: 'read', text: 'x' })).json.proposal).toBeNull()
  })
})
