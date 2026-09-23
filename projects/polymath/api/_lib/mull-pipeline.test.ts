/**
 * The whole channel, end to end, against a fake corpus and a stubbed
 * Gemini: the draft, the honesty gates, the judge.
 *
 * Everything else tests a pure function. This is the one place that checks
 * the five corpus reads, the draft calls and the judge fit together: that
 * the columns asked for exist in the shape the code reads, that provenance
 * and graveyard filtering apply to every table that needs them, that cited
 * evidence resolves to real rows, and that nothing ships without the
 * judge's say-so.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()
vi.mock('./gemini-chat.js', () => ({ generateText: (...a: unknown[]) => generateText(...a) }))

const { bakeMull, generateMull, loadEchoContext } = await import('./mull-generator.js')

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

/** A realistic small corpus: a live project, a graveyarded one, notes,
 *  fragments (one under each project), a list, an article, and one
 *  app-authored (spark-response) note that must never count. Refs, in
 *  load order: P1 the book; N1 dad, N2 one take; F1 chapter nine;
 *  L1 solder; A1 first takes. */
function corpus() {
  return {
    projects: [
      { user_id: 'u1', id: 'p-book', title: 'The book', description: 'A novel where characters get swapped out partway through', state: 'mull', status: 'active', created_at: ago(600), last_active: ago(20) },
      { user_id: 'u1', id: 'p-dead', title: 'Abandoned mural', description: 'A wall mural nobody finished', state: 'mull', status: 'abandoned', created_at: ago(500), last_active: ago(400) },
    ],
    memories: [
      { user_id: 'u1', id: 'm1', title: 'Dad', body: 'Ten more proper conversations with dad, probably, and we spend them on the greenhouse. It is the only tidy room in a messy house.', created_at: ago(280), tags: [], source_reference: null },
      { user_id: 'u1', id: 'm2', title: 'Recording', body: 'It only works if it is one take. The second take is always worse.', created_at: ago(90), tags: [], source_reference: null },
      { user_id: 'u1', id: 'm-spark', title: 'Answered', body: 'This whole reply only exists because the app asked me something.', created_at: ago(2), tags: ['spark-response'], source_reference: null },
    ],
    fragments: [
      { user_id: 'u1', id: 'f1', text: 'rewrote chapter nine for the fourth time', created_at: ago(40), memory_id: null, project_id: 'p-book', projects: { title: 'The book', state: 'mull', status: 'active' } },
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


/** A good candidate: two rows, verbatim, nothing invented. */
const ONE_TAKE = {
  noticing: 'Recording has to be one take; the book gets rewritten endlessly.',
  doubt: 'Music and prose may just work differently for them.',
  evidence: [
    { ref: 'N2', quote: 'It only works if it is one take' },
    { ref: 'F1', quote: 'rewrote chapter nine for the fourth time' },
  ],
  question: "You said a recording only works if it is one take. You rewrote chapter nine for the fourth time. What would the book look like written in one take?",
  stake: 'Chapter ten gets drafted in one sitting and left alone.',
  project: 'The book',
}

const GREENHOUSE = {
  noticing: 'The tidy room holds the conversations that matter.',
  doubt: 'Maybe the greenhouse is just where dad likes to be.',
  evidence: [
    { ref: 'N1', quote: 'we spend them on the greenhouse' },
    { ref: 'L1', quote: 'Learn to solder properly' },
  ],
  question: "You spend the conversations with dad on the greenhouse. Learning to solder properly has sat on your list for years. Who would you learn it from?",
  stake: 'They ask dad to teach them in the greenhouse.',
  project: null,
}

const ship = (n: number, extra: Partial<Record<string, unknown>> = {}) =>
  ({ n, revelation: 8, truth: 9, specific: 8, answerable: 8, verdict: 'ship', reason: 'lands', ...extra })

/** Route the stub by call: the judge prompt is recognisable. */
function respond(opts: { draft?: unknown[] | Error; judge?: unknown[] | Error }) {
  generateText.mockImplementation(async (prompt: string) => {
    const pick = prompt.includes('You are the last check') ? opts.judge ?? [] : opts.draft ?? []
    if (pick instanceof Error) throw pick
    return JSON.stringify(prompt.includes('You are the last check') ? { scores: pick } : { candidates: pick })
  })
}

const draftPromptSent = () =>
  generateText.mock.calls.map(c => c[0] as string).find(p => !p.includes('You are the last check')) ?? ''

const noEcho = { recentTexts: [], resonance: '', corrections: '' }

describe('the mull channel, end to end', () => {
  beforeEach(() => { generateText.mockReset() })

  it('ships a question built on two real rows once the judge says so', async () => {
    respond({ draft: [ONE_TAKE], judge: [ship(1)] })
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked).toHaveLength(1)
    expect(baked[0].text).toBe(ONE_TAKE.question)
    expect(baked[0].project_id).toBe('p-book')
    expect(baked[0].subject_id).toBe('m2')
    expect(baked[0].subject_kind).toBe('memory')
    expect(baked[0].stake).toBe(ONE_TAKE.stake)
    expect(trace.join('\n')).toMatch(/judge SHIP r8 t9/)
  })

  it('refuses a question built on one row -- that is a summary, not a pattern', async () => {
    respond({ draft: [{ ...ONE_TAKE, evidence: [ONE_TAKE.evidence[0]] }], judge: [ship(1)] })
    const trace: string[] = []
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)).toEqual([])
    expect(trace.join('\n')).toMatch(/needs 2 real rows of evidence, has 1/)
  })

  it('a fragment and the note it was cut from are one capture, not two', async () => {
    const data = corpus() as any
    data.fragments.push({ user_id: 'u1', id: 'f-cut', text: 'the second take is always worse', created_at: ago(90), memory_id: 'm2', project_id: 'p-book', projects: { title: 'The book', state: 'mull', status: 'active' } })
    respond({ draft: [{ ...ONE_TAKE, evidence: [ONE_TAKE.evidence[0], { ref: 'F1', quote: 'the second take is always worse' }] }], judge: [ship(1)] })
    const trace: string[] = []
    expect(await bakeMull(fakeSupabase(data).client, 'u1', undefined, trace)).toEqual([])
    expect(trace.join('\n')).toMatch(/needs 2 real rows of evidence, has 1/)
  })

  it('refuses a quote that is in no row, and says which', async () => {
    respond({ draft: [{ ...ONE_TAKE, evidence: [ONE_TAKE.evidence[0], { ref: 'F1', quote: 'a sentence nobody ever wrote down' }] }], judge: [ship(1)] })
    const trace: string[] = []
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)).toEqual([])
    expect(trace.join('\n')).toMatch(/not in the corpus: F1 "a sentence nobody ever wrote down"/)
  })

  it('forgives a wrong ref when the quote is real somewhere else', async () => {
    respond({ draft: [{ ...ONE_TAKE, evidence: [{ ref: 'P1', quote: 'It only works if it is one take' }, ONE_TAKE.evidence[1]] }], judge: [ship(1)] })
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked[0]?.subject_id).toBe('m2')
  })

  it('checks the question against the FULL cited rows -- a real quote with an invented detail fails', async () => {
    respond({ draft: [{ ...ONE_TAKE, question: 'You said a recording only works if it is one take. You rewrote chapter nine at Abbey Road. What would one take look like?' }], judge: [ship(1)] })
    const trace: string[] = []
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)).toEqual([])
    expect(trace.join('\n')).toMatch(/names something its evidence doesn't: abbey, road/)
  })

  it('refuses a yes/no question', async () => {
    respond({ draft: [{ ...ONE_TAKE, question: 'You said a recording only works if it is one take. You rewrote chapter nine for the fourth time. Should the book be one take too?' }], judge: [ship(1)] })
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1')).toEqual([])
  })

  it('ships nothing the judge kills, however honest', async () => {
    respond({ draft: [ONE_TAKE], judge: [ship(1, { verdict: 'kill', reason: 'they already know this' })] })
    const trace: string[] = []
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)).toEqual([])
    expect(trace.join('\n')).toMatch(/judge KILL .*they already know this/)
  })

  it('ships nothing the judge calls untrue, even with a ship verdict', async () => {
    respond({ draft: [ONE_TAKE], judge: [ship(1, { truth: 4 })] })
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1')).toEqual([])
  })

  it('orders by the judge, not by the drafter', async () => {
    respond({ draft: [GREENHOUSE, ONE_TAKE], judge: [ship(1, { revelation: 7 }), ship(2, { revelation: 10 })] })
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked.map(b => b.text)).toEqual([ONE_TAKE.question, GREENHOUSE.question])
    expect(baked[1].banked).toBe(true)
    expect(new Date(baked[1].expires_at).getTime()).toBeGreaterThan(new Date(baked[0].expires_at).getTime())
  })

  it('without a judge, ships only the first honest candidate', async () => {
    respond({ draft: [ONE_TAKE, GREENHOUSE], judge: new Error('timeout') })
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)
    expect(baked.map(b => b.text)).toEqual([ONE_TAKE.question])
    expect(trace.join('\n')).toMatch(/judge FAILED/)
  })

  it('a failed draft call says so in the trace', async () => {
    respond({ draft: new Error('Request timed out') })
    const trace: string[] = []
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)).toEqual([])
    expect(trace.join('\n')).toMatch(/draft FAILED/)
  })

  it('drops a question written twice in one response', async () => {
    respond({ draft: [ONE_TAKE, ONE_TAKE, GREENHOUSE], judge: [ship(1), ship(2)] })
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked).toHaveLength(2)
    const judgePrompt = generateText.mock.calls.map(c => c[0] as string).find(p => p.includes('You are the last check'))!
    expect(judgePrompt.match(/QUESTION:/g)).toHaveLength(2)
  })

  it('never uses Pro', async () => {
    respond({ draft: [ONE_TAKE], judge: [ship(1)] })
    await bakeMull(fakeSupabase(corpus()).client, 'u1')
    for (const call of generateText.mock.calls) expect(call[1].model).toBe('gemini-flash-latest')
  })

  it('two shipped questions never share a row', async () => {
    const sameRow = { ...GREENHOUSE, evidence: [ONE_TAKE.evidence[0], GREENHOUSE.evidence[1]] }
    respond({ draft: [ONE_TAKE, sameRow], judge: [ship(1), ship(2)] })
    expect(await bakeMull(fakeSupabase(corpus()).client, 'u1')).toHaveLength(1)
  })

  it('never lets a hallucinated project title reach the column', async () => {
    respond({ draft: [{ ...GREENHOUSE, project: 'A project that does not exist' }], judge: [ship(1)] })
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1')
    expect(baked[0].project_id).toBeNull()
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
})

describe('what the corpus lets in', () => {
  beforeEach(() => { generateText.mockReset() })

  it('keeps out app-authored notes, graveyarded projects and their fragments, and unvoted articles', async () => {
    respond({ draft: [] })
    await bakeMull(fakeSupabase(corpus()).client, 'u1')
    const prompt = draftPromptSent()
    expect(prompt).not.toContain('only exists because the app asked me')
    expect(prompt).not.toContain('Abandoned mural')
    expect(prompt).not.toContain('blue really should dominate')
    expect(prompt).not.toContain('Nobody has voted on this one')
  })

  it('lets in a voted-good article, dated, with refs the model can cite', async () => {
    respond({ draft: [] })
    await bakeMull(fakeSupabase(corpus()).client, 'u1')
    const prompt = draftPromptSent()
    expect(prompt).toContain('[A1] "On first takes"')
    expect(prompt).toMatch(/\[N2\] "Recording" \(\d{1,2} \w+ \d{4}\): It only works/)
  })

  it('never lets a correction note become quotable evidence', async () => {
    const data = corpus() as any
    data.memories.push({
      user_id: 'u1', id: 'm-correction', title: 'Spark response',
      body: 'No, I never gave up on the mural -- it just moved to the someday list.',
      created_at: ago(1), tags: ['spark-response', 'spark-correction'],
      source_reference: { type: 'spark', id: 's-old', title: 'You gave up on the mural in June -- what happened?' },
    })
    respond({ draft: [{ ...GREENHOUSE, evidence: [GREENHOUSE.evidence[0], { ref: 'N3', quote: 'it just moved to the someday list' }] }], judge: [ship(1)] })
    const echo = await loadEchoContext(fakeSupabase(data).client, 'u1')
    expect(echo.corrections).toContain('it just moved to the someday list')
    const baked = await generateMull(fakeSupabase(data).client, 'u1', echo, [])
    expect(draftPromptSent()).toContain("THEY'VE CORRECTED US BEFORE")
    expect(baked).toEqual([])
  })
})

describe('recent questions', () => {
  beforeEach(() => { generateText.mockReset() })

  it('names the rows recent questions used, and drops a candidate built on one', async () => {
    respond({ draft: [ONE_TAKE], judge: [ship(1)] })
    const trace: string[] = []
    const baked = await generateMull(fakeSupabase(corpus()).client, 'u1', { ...noEcho, recentSubjectIds: new Set(['m2']) }, trace)
    expect(draftPromptSent()).toMatch(/Recent questions were built on N2/)
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/built on a row a recent question used/)
  })
})

describe('creative mode ("get more creative")', () => {
  beforeEach(() => { generateText.mockReset() })

  it('lets recent ground and a yes/no shape through, on the loose judge bar', async () => {
    const closed = { ...ONE_TAKE, question: 'You said a recording only works if it is one take. You rewrote chapter nine for the fourth time. Should the book be one take too?' }
    respond({ draft: [closed], judge: [ship(1, { verdict: 'kill', revelation: 4, truth: 7, answerable: 6 })] })
    const baked = await generateMull(fakeSupabase(corpus()).client, 'u1', { ...noEcho, recentSubjectIds: new Set(['m2']) }, [], true)
    expect(baked).toHaveLength(1)
    expect(draftPromptSent()).not.toMatch(/Recent questions were built on/)
  })

  it('still refuses invented evidence -- honesty never relaxes', async () => {
    respond({ draft: [{ ...ONE_TAKE, evidence: [ONE_TAKE.evidence[0], { ref: 'F1', quote: 'a sentence nobody ever wrote down' }] }], judge: [ship(1)] })
    expect(await generateMull(fakeSupabase(corpus()).client, 'u1', noEcho, [], true)).toEqual([])
  })

  it('still refuses what the judge calls untrue', async () => {
    respond({ draft: [ONE_TAKE], judge: [ship(1, { truth: 3 })] })
    expect(await generateMull(fakeSupabase(corpus()).client, 'u1', noEcho, [], true)).toEqual([])
  })
})
