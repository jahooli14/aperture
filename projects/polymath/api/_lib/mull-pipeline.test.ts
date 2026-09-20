/**
 * The whole channel, end to end, against a fake corpus and a stubbed
 * Gemini — one call, up to two questions, no subject search in between.
 *
 * Everything else tests a pure function. This is the one place that checks
 * the five corpus reads and the draft call actually fit together: that the
 * columns asked for exist in the shape the code reads, that provenance and
 * graveyard filtering apply to every table that needs them (not just the
 * obvious one), and that a quote resolves back to the real row it came
 * from so the gates can check the drafted question against that row's
 * FULL text rather than the short quote alone.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()
vi.mock('./gemini-chat.js', () => ({ generateText: (...a: unknown[]) => generateText(...a) }))

const { bakeMull, generateMull, loadEchoContext } = await import('./mull-generator.js')

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

/** A realistic small corpus: a live project, a graveyarded one, notes,
 *  fragments (one under each project), a list, an article, and one
 *  app-authored (spark-response) note that must never count. */
function corpus() {
  return {
    projects: [
      { user_id: 'u1', id: 'p-book', title: 'The book', description: 'A novel where characters get swapped out partway through', state: 'mull', status: 'active', created_at: ago(600), last_active: ago(20) },
      { user_id: 'u1', id: 'p-dead', title: 'Abandoned mural', description: 'A wall mural nobody finished', state: 'mull', status: 'abandoned', created_at: ago(500), last_active: ago(400) },
    ],
    memories: [
      { user_id: 'u1', id: 'm1', title: 'Dad', body: 'Ten more proper conversations with dad, probably, and we spend them on the greenhouse. It is the only tidy room in a messy house.', created_at: ago(280), tags: [], source_reference: null },
      { user_id: 'u1', id: 'm-spark', title: 'Answered', body: 'This whole reply only exists because the app asked me something.', created_at: ago(2), tags: ['spark-response'], source_reference: null },
    ],
    fragments: [
      { user_id: 'u1', id: 'f1', text: 'chapter nine needs to feel like arriving', created_at: ago(500), memory_id: null, project_id: 'p-book', projects: { title: 'The book', state: 'mull', status: 'active' } },
      { user_id: 'u1', id: 'f-dead', text: 'blue really should dominate the left third', created_at: ago(450), memory_id: null, project_id: 'p-dead', projects: { title: 'Abandoned mural', state: 'mull', status: 'abandoned' } },
    ],
    list_items: [
      { user_id: 'u1', id: 'l1', content: 'Learn to solder properly', user_rating: 4, status: 'active', created_at: ago(600), lists: { title: 'To do', type: 'skill' } },
    ],
    reading_queue: [
      { user_id: 'u1', id: 'r-good', title: 'On first takes', excerpt: '', content: 'The recording is not a document of the performance, it is the performance itself, and once you accept that the whole practice of fixing things afterwards starts to look like a mistake nobody questioned.', resonance: 'good', created_at: ago(400) },
      { user_id: 'u1', id: 'r-unvoted', title: 'Unread feed item', excerpt: '', content: 'Nobody has voted on this one yet so it must never appear.', resonance: null, created_at: ago(1) },
    ],
    sparks: [],
  }
}

type Row = Record<string, any>

/** Minimal PostgREST-shaped stub, same contract as the rest of this
 *  channel's tests: real predicates, so a wrong filter comes back empty
 *  here too rather than quietly passing. */
function fakeSupabase(data: Record<string, Row[]>) {
  const inserted: Row[] = []
  const builder = (table: string) => {
    let rows = [...(data[table] ?? [])]
    const columnsOf = (t: string) => new Set(Object.keys((data[t] ?? [{}])[0] ?? {}))
    const chain: any = {
      select: (cols?: string) => {
        const known = columnsOf(table)
        if (cols && known.size > 0) {
          const asked = cols.replace(/\([^)]*\)/g, '').split(',').map(c => c.trim()).filter(Boolean)
          const missing = asked.filter(c => c !== '*' && !known.has(c))
          if (missing.length > 0) {
            rows = []
            chain.__error = { message: `column ${table}.${missing[0]} does not exist` }
          }
        }
        return chain
      },
      eq: (c: string, v: unknown) => { rows = rows.filter(r => r[c] === v); return chain },
      neq: (c: string, v: unknown) => { rows = rows.filter(r => r[c] !== v && r[c] != null); return chain },
      in: (c: string, v: unknown[]) => { rows = rows.filter(r => v.includes(r[c])); return chain },
      gte: (c: string, v: string) => { rows = rows.filter(r => String(r[c]) >= v); return chain },
      lt: (c: string, v: string) => { rows = rows.filter(r => String(r[c]) < v); return chain },
      is: (c: string, v: null) => { rows = rows.filter(r => (v === null ? r[c] == null : r[c] === v)); return chain },
      not: (c: string, _op: string, v: null) => { rows = rows.filter(r => (v === null ? r[c] != null : true)); return chain },
      contains: (c: string, v: unknown[]) => { rows = rows.filter(r => Array.isArray(r[c]) && v.every(x => r[c].includes(x))); return chain },
      order: () => chain,
      limit: () => chain,
      insert: (payload: Row | Row[]) => { inserted.push(...(Array.isArray(payload) ? payload : [payload])); return chain },
      update: () => chain,
      __error: null as { message: string } | null,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) =>
        resolve(chain.__error ? { data: null, error: chain.__error } : { data: rows, error: null }),
    }
    return chain
  }
  return { client: { from: (table: string) => builder(table) } as any, inserted }
}

const draftJson = (questions: any[]) => JSON.stringify({ questions })

describe('the mull channel, end to end', () => {
  beforeEach(() => { generateText.mockReset() })

  it('turns a real corpus into a grounded question', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'ten more proper conversations with dad',
      spark: 'You wrote that you get ten more proper conversations with dad, probably, and you spend them on the greenhouse. What is the greenhouse standing in for?',
      stake: 'He picks a different room to have the next one in.',
      project: null,
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked).toHaveLength(1)
    expect(baked[0].text).toContain('ten more proper conversations with dad')
    expect(baked[0].subject_id).toBe('m1')
    expect(baked[0].subject_kind).toBe('memory')
  })

  it('resolves the model-named project to a real id, not a guess', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'characters get swapped out partway through',
      spark: 'Your book has characters get swapped out partway through. What has to stay the same for the swap to be believable?',
      stake: 'He writes down the one trait that cannot change.',
      project: 'The book',
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked[0].project_id).toBe('p-book')
  })

  it('never lets a hallucinated project title reach the column', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'ten more proper conversations with dad',
      spark: 'You wrote that you get ten more proper conversations with dad, and spend them on the greenhouse. What is the greenhouse standing in for?',
      stake: 'He picks a different room to have the next one in.',
      project: 'A project that does not exist',
    }]))
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked[0].project_id).toBeNull()
  })

  it('drops a question whose quote matches nothing in the corpus at all', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'a sentence that was never written by anyone in this corpus',
      spark: 'You wrote that a sentence that was never written by anyone in this corpus. What happens next?',
      stake: 'Something changes.',
      project: null,
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/whose quote matched nothing in the corpus/)
  })

  it('checks the drafted question against the FULL source row, not just the short quote', async () => {
    // The gap a live test found: a real quote with an invented detail
    // dressed around it in the question passes a quote-only check and
    // fails this one, because the invented word is nowhere in the row
    // the quote actually resolved to.
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'ten more proper conversations with dad',
      spark: 'You wrote that you get ten more proper conversations with dad, structured like a Penrose staircase in your dream journal. What happens after the tenth?',
      stake: 'He picks a different room to have the next one in.',
      project: null,
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/names something that is in neither the note nor the project/)
  })

  it('an app-authored note is never the subject of a question', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'this whole reply only exists because the app asked me something',
      spark: 'You wrote that this whole reply only exists because the app asked me something. What would you have said unprompted?',
      stake: 'He notices the app is leading him.',
      project: null,
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    // The quote is real text, but it lives on an app-authored row, which is
    // excluded from the corpus entirely -- so it resolves to nothing.
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/whose quote matched nothing in the corpus/)
  })

  it('a graveyarded project is excluded, and so is a fragment filed under it', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'blue really should dominate the left third',
      spark: 'You wrote that blue really should dominate the left third. Which wall gets it first?',
      stake: 'He picks the wall and mixes the colour today.',
      project: 'Abandoned mural',
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/whose quote matched nothing in the corpus/)
  })

  it('an unvoted article never enters the corpus', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'nobody has voted on this one yet',
      spark: 'You saved something where nobody has voted on this one yet. Why has it sat unread?',
      stake: 'He opens it tonight or deletes it.',
      project: null,
    }]))
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked).toEqual([])
  })

  it('a voted-good article is real corpus material', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'once you accept that the whole practice of fixing things afterwards starts to look like a mistake',
      spark: 'You read that once you accept that the whole practice of fixing things afterwards starts to look like a mistake, editing becomes a kind of lie. Where in your own work have you kept "fixing" something instead of leaving the first take?',
      stake: 'He picks one thing to leave alone this week.',
      project: null,
    }]))
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked).toHaveLength(1)
    expect(baked[0].subject_kind).toBe('article')
  })

  it('the model declining outright produces silence, not a manufactured question', async () => {
    generateText.mockResolvedValueOnce(draftJson([{ quote: '', spark: null, stake: '', project: null }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/1 declined by the model/)
  })

  it('a failed draft call says so in the trace instead of reading as an empty corpus', async () => {
    generateText.mockResolvedValueOnce('not json at all')
    const trace: string[] = []
    await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(trace.join('\n')).toMatch(/!! draft call FAILED/)
  })

  it('an empty corpus is reported, not silently read as a blank prompt', async () => {
    const trace: string[] = []
    const baked = await bakeMull(
      fakeSupabase({ projects: [], memories: [], fragments: [], list_items: [], reading_queue: [], sparks: [] }).client,
      'u1', undefined, trace,
    )
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/nothing to draw from/)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('banks the second question with a longer life than the first', async () => {
    generateText.mockResolvedValueOnce(draftJson([
      {
        quote: 'ten more proper conversations with dad',
        spark: 'You wrote that you get ten more proper conversations with dad, and spend them on the greenhouse. What is the greenhouse standing in for?',
        stake: 'He picks a different room to have the next one in.',
        project: null,
      },
      {
        quote: 'characters get swapped out partway through',
        spark: 'Your book has characters get swapped out partway through. What has to stay the same for the swap to be believable?',
        stake: 'He writes down the one trait that cannot change.',
        project: 'The book',
      },
    ]))
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked).toHaveLength(2)
    expect(baked[0].banked).toBeFalsy()
    expect(baked[1].banked).toBe(true)
    expect(new Date(baked[1].expires_at).getTime()).toBeGreaterThan(new Date(baked[0].expires_at).getTime())
  })

  it('two questions from the same run cannot share a subject', async () => {
    generateText.mockResolvedValueOnce(draftJson([
      {
        quote: 'ten more proper conversations with dad',
        spark: 'You wrote that you get ten more proper conversations with dad, and spend them on the greenhouse. What is the greenhouse standing in for?',
        stake: 'He picks a different room to have the next one in.',
        project: null,
      },
      {
        quote: 'ten more proper conversations with dad',
        spark: 'You wrote that you get ten more proper conversations with dad, and it is the tidiest room in the house. What does tidy mean to you there?',
        stake: 'He redefines what counts as tidy for himself.',
        project: null,
      },
    ]))
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked).toHaveLength(1)
  })
})

describe('creative mode ("get more creative")', () => {
  beforeEach(() => { generateText.mockReset() })

  it('drops the avoid-list so recently-covered material is eligible again', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'ten more proper conversations with dad',
      spark: 'You wrote that you get ten more proper conversations with dad, and spend them on the greenhouse. What is the greenhouse standing in for?',
      stake: 'He picks a different room to have the next one in.',
      project: null,
    }]))
    const data = corpus() as any
    data.sparks = [{
      user_id: 'u1', type: 'mull', text: 'An old question about the same note', dismissed_at: null,
      created_at: ago(1), subject_id: 'm1', project_id: null,
    }]
    const echo = await loadEchoContext(fakeSupabase(data).client, 'u1')
    const baked = await generateMull(fakeSupabase(data).client, 'u1', echo, [], true)
    expect(baked).toHaveLength(1)
    const prompt = generateText.mock.calls[0][0] as string
    expect(prompt).not.toMatch(/already covered/)
  })

  it('lets a decorative binary through that the strict pass would reject', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'ten more proper conversations with dad',
      spark: 'Do you have ten more proper conversations with dad, or does the greenhouse take them instead?',
      stake: 'Nothing changes either way.',
      project: null,
    }]))
    const baked = await generateMull(fakeSupabase(corpus()).client, 'u1', {
      recentTexts: [], avoid: '', resonance: '', corrections: '',
    }, [], true)
    expect(baked).toHaveLength(1)
  })

  it('still refuses a quote that matches nothing in the corpus -- grounding never relaxes', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'a sentence nobody in this corpus ever wrote',
      spark: 'You wrote that a sentence nobody in this corpus ever wrote. What happens next?',
      stake: 'Something changes.',
      project: null,
    }]))
    const baked = await generateMull(fakeSupabase(corpus()).client, 'u1', {
      recentTexts: [], avoid: '', resonance: '', corrections: '',
    }, [], true)
    expect(baked).toEqual([])
  })
})

describe('recentSubjectIds and recentProjectIds are named in the avoid-list by title', () => {
  beforeEach(() => { generateText.mockReset() })

  it('names a subject still in the corpus so the model can avoid it by identity, not just wording', async () => {
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'characters get swapped out partway through',
      spark: 'Your book has characters get swapped out partway through. What has to stay the same for the swap to be believable?',
      stake: 'He writes down the one trait that cannot change.',
      project: 'The book',
    }]))
    const echo = { recentTexts: [], recentSubjectIds: new Set(['m1']), avoid: '', resonance: '', corrections: '' }
    await generateMull(fakeSupabase(corpus()).client, 'u1', echo, [])
    const prompt = generateText.mock.calls[0][0] as string
    expect(prompt).toMatch(/already covered, whatever the wording.*Dad/)
  })
})

describe('a correction from the one follow-up reaches the next draft call', () => {
  beforeEach(() => { generateText.mockReset() })

  it('hands a spark-correction note to the prompt as plain context, not as corpus', async () => {
    const data = corpus() as any
    data.memories.push({
      user_id: 'u1', id: 'm-correction', title: 'Spark response',
      body: 'No, I never gave up on the mural -- it just moved to the someday list.',
      created_at: ago(1), tags: ['spark-response', 'spark-correction'],
      source_reference: { type: 'spark', id: 's-old', title: 'You gave up on the mural in June -- what happened?' },
    })
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'ten more proper conversations with dad',
      spark: 'You wrote that you get ten more proper conversations with dad. What is the greenhouse standing in for?',
      stake: 'He picks a different room to have the next one in.',
      project: null,
    }]))
    const echo = await loadEchoContext(fakeSupabase(data).client, 'u1')
    expect(echo.corrections).toContain('You gave up on the mural in June')
    expect(echo.corrections).toContain('it just moved to the someday list')

    await generateMull(fakeSupabase(data).client, 'u1', echo, [])
    const prompt = generateText.mock.calls[0][0] as string
    expect(prompt).toContain('THEY\'VE CORRECTED US BEFORE')
    expect(prompt).toContain('it just moved to the someday list')
  })

  it('never lets a correction note itself become quotable corpus material', async () => {
    const data = corpus() as any
    data.memories.push({
      user_id: 'u1', id: 'm-correction', title: 'Spark response',
      body: 'No, I never gave up on the mural -- it just moved to the someday list.',
      created_at: ago(1), tags: ['spark-response', 'spark-correction'],
      source_reference: { type: 'spark', id: 's-old', title: 'You gave up on the mural in June -- what happened?' },
    })
    generateText.mockResolvedValueOnce(draftJson([{
      quote: 'it just moved to the someday list',
      spark: 'You said it just moved to the someday list. What would bring it back onto the main one?',
      stake: 'It gets picked up again.',
      project: null,
    }]))
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(data).client, 'u1', undefined, trace)
    // The quote is real text (it's IN the corrections context handed to the
    // model), but it isn't a row in corpus.rows -- app-authored notes never
    // are (corpus-provenance.ts) -- so it can't resolve as a grounded source.
    expect(baked).toEqual([])
  })
})
