/**
 * The whole channel, end to end, against a fake corpus.
 *
 * Everything else here tests a pure function. Nothing tested that the five
 * subject gatherers, nine vector searches and two model calls actually fit
 * together — that the columns asked for exist in the shape the code reads,
 * that a silent step declines instead of throwing, and that a realistic
 * corpus produces a question at all. Those are the failures that would only
 * have shown up as an empty slot in production, which is silent by design.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()
// Each query gets a vector that encodes its index, so the fake vector
// search can answer per-subject instead of per-call-order — the real
// searches run concurrently and arrive in no fixed order.
const batchGenerateEmbeddings = vi.fn(async (texts: string[]) => texts.map((_, i) => [i, 0, 0]))

vi.mock('./gemini-chat.js', () => ({ generateText: (...a: unknown[]) => generateText(...a) }))
vi.mock('./gemini-embeddings.js', () => ({
  batchGenerateEmbeddings: (t: string[]) => batchGenerateEmbeddings(t),
  generateEmbedding: async () => [0.1, 0.2, 0.3],
  cosineSimilarity: () => 0.6,
}))

const { bakeMull } = await import('./mull-generator.js')
const { gatherSubjects } = await import('./mull-subjects.js')

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

/** Two years of a real-shaped corpus: a conviction never built, a project
 *  with a rhythm, notes filed against both, lists, and reading. */
function corpus() {
  const fragments = [
    // Said across two years, never became a project. The strongest shape.
    { user_id: 'u1', id: 'f1', text: 'it only works if it is one take', created_at: ago(760), project_id: null, memory_id: null, projects: null },
    { user_id: 'u1', id: 'f2', text: 'the good mixes were always the first pass', created_at: ago(420), project_id: null, memory_id: null, projects: null },
    { user_id: 'u1', id: 'f3', text: 'one take or it is not honest', created_at: ago(90), project_id: null, memory_id: null, projects: null },
    // A project with captures spread over a year.
    { user_id: 'u1', id: 'f4', text: 'chapter nine needs to feel like arriving', created_at: ago(500), project_id: 'p-book', memory_id: null, projects: { title: 'The book' } },
    { user_id: 'u1', id: 'f5', text: 'rewrote chapter three again', created_at: ago(300), project_id: 'p-book', memory_id: null, projects: { title: 'The book' } },
    { user_id: 'u1', id: 'f6', text: 'four passes on chapter three now', created_at: ago(120), project_id: 'p-book', memory_id: null, projects: { title: 'The book' } },
    { user_id: 'u1', id: 'f7', text: 'cut the mitres at 5am', created_at: ago(450), project_id: 'p-deck', memory_id: null, projects: { title: 'Deck stand' } },
    { user_id: 'u1', id: 'f8', text: 'the stand is square at last', created_at: ago(200), project_id: 'p-deck', memory_id: null, projects: { title: 'Deck stand' } },
  ]
  return {
    fragments,
    memories: [
      { user_id: 'u1', id: 'm1', title: 'Dad', body: 'Ten more proper conversations with dad, probably, and we spend them on the greenhouse. It is the only tidy room in a messy house and I do not know why that matters to me but it does.', created_at: ago(280) },
      { user_id: 'u1', id: 'm2', title: 'Mixing', body: 'Kept the first take of the whole side even though the drop is late. It breathes. Every version I tightened afterwards was worse and I deleted them all.', created_at: ago(150) },
    ],
    projects: [
      { user_id: 'u1', id: 'p-book', title: 'The book', description: 'A novel where characters get swapped out partway through', metadata: { end_goal: 'a finished manuscript' }, last_closeout_text: 'Got through the chapter nine rewrite', created_at: ago(600), last_active: ago(120), last_session_ended_at: ago(120), state: 'mull', status: 'active' },
      { user_id: 'u1', id: 'p-deck', title: 'Deck stand', description: 'A stand for the decks, out of oak offcuts', metadata: {}, last_closeout_text: null, created_at: ago(500), last_active: ago(400), last_session_ended_at: null, state: 'mull', status: 'dormant' },
    ],
    joints: [{ user_id: 'u1', id: 'j1', text: 'it only works if it is one take', fragment_ids: ['f1', 'f2', 'f3'], occurrence_count: 3, last_seen_at: ago(90) }],
    list_items: [
      { user_id: 'u1', id: 'l1', content: 'Burden of Dreams', user_rating: 5, status: 'active', created_at: ago(500), lists: { title: 'Films', type: 'film' } },
      { user_id: 'u1', id: 'l2', content: 'Learn to solder properly', user_rating: null, status: 'active', created_at: ago(600), lists: { title: 'To do', type: 'skill' } },
    ],
    reading_queue: [
      { user_id: 'u1', id: 'r1', title: 'On first takes', excerpt: 'The recording is not a document of the performance, it is the performance. Once you accept that, editing becomes a different kind of lie, and the whole practice of fixing things afterwards starts to look strange.', content: null, resonance: 'good', tags: [], created_at: ago(400) },
      // A feed item as the ingest actually stores one: excerpt capped at
      // 100 characters, the real text in `content`. Every article in
      // production looked like this, and the gatherer wanted 120 chars of
      // excerpt -- a threshold the ingest can never produce.
      { user_id: 'u1', id: 'r2', title: 'The long way round', excerpt: 'A short feed blurb, cut at a hundred characters by the ingest, which is all any RSS row ev', content: '<p>People who take the long way round are not being slow. They are refusing to accept that the shortest path is the same as the best one, and that refusal costs them years and buys them something nobody has named.</p>', resonance: 'good', tags: ['rss'], created_at: ago(300) },
    ],
    sparks: [],
  }
}

type Row = Record<string, any>

/** Minimal PostgREST-shaped stub: real predicates, so a query that filters
 *  wrongly comes back empty here too rather than quietly passing. */
function fakeSupabase(data: Record<string, Row[]>) {
  const rpcCalls: string[] = []
  const inserted: Row[] = []

  const builder = (table: string) => {
    let rows = [...(data[table] ?? [])]
    // PostgREST rejects a select naming a column the table does not have,
    // and an unchecked `data` then reads as an empty table. A stub that
    // answers any column hides exactly the bug that cost a day.
    const columnsOf = (t: string) => new Set(Object.keys((data[t] ?? [{}])[0] ?? {}))
    const chain: any = {
      select: (cols?: string) => {
        const known = columnsOf(table)
        if (cols && known.size > 0) {
          const asked = cols
            .replace(/\([^)]*\)/g, '')   // drop embeds: lists(title, type) -> lists
            .split(',').map(c => c.trim()).filter(Boolean)
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
      gt: (c: string, v: string) => { rows = rows.filter(r => String(r[c]) > v); return chain },
      is: (c: string, v: null) => { rows = rows.filter(r => (v === null ? r[c] == null : r[c] === v)); return chain },
      not: (c: string, _op: string, v: null) => { rows = rows.filter(r => (v === null ? r[c] != null : true)); return chain },
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      insert: (payload: Row | Row[]) => {
        inserted.push(...(Array.isArray(payload) ? payload : [payload]))
        return chain
      },
      update: () => chain,
      __error: null as { message: string } | null,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) =>
        resolve(chain.__error ? { data: null, error: chain.__error } : { data: rows, error: null }),
    }
    return chain
  }

  return {
    client: {
      from: (table: string) => builder(table),
      rpc: async (name: string, args: Row) => {
        rpcCalls.push(name)
        // The connector: a note in a different vocabulary, inside the band.
        if (name === 'match_memories') {
          // A different note per blind spot, chosen by the query vector
          // rather than by call order -- the real searches run
          // concurrently and arrive in no fixed order. One note for every
          // search would be right to refuse: rankPairs will not build two
          // questions on the same lens.
          const which = Number(String(args.query_embedding).replace('[', '').split(',')[0]) || 0
          const note = data.memories[which % data.memories.length]
          return {
            data: [{ id: note.id, title: note.title, body: note.body, similarity: 0.58 }],
            error: null,
          }
        }
        return { data: [], error: null }
      },
    } as any,
    rpcCalls,
    inserted,
  }
}

const BLIND_SPOTS = JSON.stringify({
  subjects: [
    { n: 1, blind_spot: 'It assumes a first take is honest because it is unedited, and never says what honesty costs.', search_query: 'whether doing a thing once and leaving it alone is braver than getting it right, or just easier' },
    { n: 2, blind_spot: 'It assumes the chapter can be fixed by rewriting, and has never tested leaving one alone.', search_query: 'when trying again makes a thing worse instead of better' },
    { n: 3, blind_spot: null, search_query: '' },
  ],
})

const DRAFTS = JSON.stringify({
  pairs: [
    {
      n: 1,
      spark: 'You wrote that you get maybe ten more proper conversations with dad, and you spend them on the greenhouse. You have said since 2023 that it only works if it is one take. What are you doing twice?',
      quote: 'ten more proper conversations with dad',
      stake: 'He stops re-recording and keeps the next first pass.',
    },
    {
      n: 2,
      spark: 'You kept the first take of the whole side even though the drop is late. Chapter three has had four passes and chapter nine has had one. Which one are you going to leave alone?',
      quote: 'Kept the first take of the whole side even though the drop is late',
      stake: 'He leaves chapter nine alone and ships it.',
    },
  ],
})

describe('the mull channel, end to end', () => {
  beforeEach(() => {
    generateText.mockReset()
    batchGenerateEmbeddings.mockClear()
  })

  it('turns two years of corpus into two questions', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const { client, rpcCalls } = fakeSupabase(corpus() as any)

    const baked = await bakeMull(client, 'u1')

    expect(baked).toHaveLength(2)
    expect(baked[0].type).toBe('mull')
    expect(baked[0].text).toContain('ten more proper conversations with dad')
    // Exactly two model calls, whatever the corpus looks like.
    expect(generateText).toHaveBeenCalledTimes(2)
    expect(batchGenerateEmbeddings).toHaveBeenCalledTimes(1)
    // All three searches ran, not one.
    expect(rpcCalls.filter(n => n === 'match_memories').length).toBeGreaterThan(1)
  })

  it('asks about every subject in one call, and the dates are real', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    await bakeMull(fakeSupabase(corpus() as any).client, 'u1')

    const blindSpotPrompt = generateText.mock.calls[0][0] as string
    expect(blindSpotPrompt).toMatch(/SUBJECT 1/)
    expect(blindSpotPrompt).toMatch(/SUBJECT 2/)
    // A dated fact computed from the corpus, not a model invention.
    expect(blindSpotPrompt).toMatch(/since \w+ 20\d\d/)
    // Lists reach the prompt as register.
    expect(blindSpotPrompt).toContain('Burden of Dreams')
  })

  it('banks the second question with a longer life, so it cannot expire unseen', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const baked = await bakeMull(fakeSupabase(corpus() as any).client, 'u1')

    expect(new Date(baked[1].expires_at).getTime())
      .toBeGreaterThan(new Date(baked[0].expires_at).getTime())
  })

  it('stays silent rather than shipping an ungrounded question', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(JSON.stringify({
      pairs: [{
        n: 1,
        spark: 'Your love of first takes connects to your reading about impermanence. What might that unlock?',
        quote: 'ten more summers with dad',
        stake: 'A deeper sense of his practice.',
      }],
    }))
    const baked = await bakeMull(fakeSupabase(corpus() as any).client, 'u1')
    expect(baked.filter(s => s.type === 'mull')).toHaveLength(0)
  })

  it('says which step declined, so silence is diagnosable', async () => {
    generateText.mockResolvedValue(JSON.stringify({ subjects: [] }))
    const trace: string[] = []
    await bakeMull(fakeSupabase(corpus() as any).client, 'u1', undefined, trace)

    // Not "it was quiet" — which of the four steps, with its numbers.
    expect(trace.join('\n')).toMatch(/subjects: \w+\//)
    expect(trace.join('\n')).toMatch(/blind spots: none/)
  })

  it('reports the search numbers, not just a verdict', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const trace: string[] = []
    await bakeMull(fakeSupabase(corpus() as any).client, 'u1', undefined, trace)

    // An empty search and a search whose every hit was a restatement look
    // identical from outside and need opposite fixes.
    expect(trace.join('\n')).toMatch(/search \[\w+\]: \d+ candidates, best [\d.]+, band/)
  })

  it('never resurfaces a project on elapsed time alone', async () => {
    generateText.mockResolvedValue('not json at all')
    const baked = await bakeMull(fakeSupabase(corpus() as any).client, 'u1')
    expect(baked).toEqual([])
  })

  it('declines quietly on an empty corpus instead of throwing', async () => {
    generateText.mockResolvedValue(JSON.stringify({ subjects: [] }))
    const empty = { fragments: [], memories: [], projects: [], joints: [], list_items: [], reading_queue: [], sparks: [] }
    await expect(bakeMull(fakeSupabase(empty).client, 'u1')).resolves.toEqual([])
  })

  it('shows nothing rather than a calendar fact when the model is useless', async () => {
    // There used to be a consolation prize here: "you set down <project> N
    // months ago". Elapsed time is not insight, and as the FALLBACK it only
    // ever appeared when the channel had found none — so it was a card that
    // by construction carried none. An empty slot is the honest answer and
    // the home surface renders nothing for it.
    generateText.mockResolvedValue('not json at all')
    const baked = await bakeMull(fakeSupabase(corpus() as any).client, 'u1')
    expect(baked).toEqual([])
  })
})

describe('the funnel is wide enough that one rejection is not fatal', () => {
  it('carries several connectors per blind spot, not just the best one', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const data = corpus() as any
    const { client } = fakeSupabase(data)
    const trace: string[] = []
    await bakeMull(client, 'u1', undefined, trace)
    // "40 candidates -> 1 pair -> 1 draft -> 1 rejection -> nothing" was the
    // production failure. Depth before the quality bar, not instead of it.
    expect(trace.join('\n')).toMatch(/pairs: \d+ found, \d+ sent to draft/)
  })

  it('still ships a question when the first draft is rejected', async () => {
    const twoDrafts = JSON.stringify({
      pairs: [
        // Ungrounded: nothing of the note in it. Must be refused.
        { n: 1, spark: 'What is the book really about, underneath?', quote: 'invented words entirely', stake: 'He rewrites the opening.' },
        // Sound, and built on a different subject.
        {
          n: 2,
          spark: 'You wrote that you get maybe ten more proper conversations with dad and you spend them on the greenhouse. What are those chapters for?',
          quote: 'ten more proper conversations with dad',
          stake: 'Chapters nine to twelve come out.',
        },
      ],
    })
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(twoDrafts)
    // One note in the corpus, so every pair is built on it and the second
    // draft's quote is checkable whichever pair it landed on.
    const data = corpus() as any
    data.memories = [data.memories[0]]
    const baked = await bakeMull(fakeSupabase(data).client, 'u1')
    expect(baked.map(s => s.type)).toContain('mull')
  })
})

describe('what the three subjects are allowed to be', () => {
  /** A corpus whose joints alone could fill every slot: three recurring
   *  things, each with a different temporal shape. */
  function jointHeavy() {
    const c = corpus() as any
    c.fragments.push(
      // A conviction: years of mentions, still alive, filed to a project.
      { user_id: 'u1', id: 'g1', text: 'the room has to be the subject not the setting', created_at: ago(780), project_id: 'p-book', memory_id: null, projects: { title: 'The book' } },
      { user_id: 'u1', id: 'g2', text: 'the room is the subject', created_at: ago(400), project_id: 'p-book', memory_id: null, projects: { title: 'The book' } },
      { user_id: 'u1', id: 'g3', text: 'make the room the subject', created_at: ago(40), project_id: 'p-book', memory_id: null, projects: { title: 'The book' } },
      // A return: dropped for a year, back last month.
      { user_id: 'u1', id: 'h1', text: 'learn to bind a book by hand', created_at: ago(800), project_id: null, memory_id: null, projects: null },
      { user_id: 'u1', id: 'h2', text: 'binding again, the thread matters', created_at: ago(760), project_id: null, memory_id: null, projects: null },
      { user_id: 'u1', id: 'h3', text: 'bought linen thread for binding', created_at: ago(25), project_id: null, memory_id: null, projects: null },
    )
    c.joints.push(
      { user_id: 'u1', id: 'j2', text: 'the room has to be the subject', fragment_ids: ['g1', 'g2', 'g3'], occurrence_count: 3 },
      { user_id: 'u1', id: 'j3', text: 'learn to bind a book by hand', fragment_ids: ['h1', 'h2', 'h3'], occurrence_count: 3 },
    )
    return c
  }

  it('never spends all three slots on one kind of subject', async () => {
    const subjects = await gatherSubjects(fakeSupabase(jointHeavy()).client, 'u1')
    const joints = subjects.filter(s => s.kind === 'joint')
    expect(subjects.length).toBeGreaterThan(1)
    expect(joints.length).toBeLessThanOrEqual(2)
  })

  it('keeps a slot for reading, which on strength alone would never win', async () => {
    // An article has no temporal shape, so it scores lowest by definition.
    // A corpus-only channel can only ever recombine the user.
    const subjects = await gatherSubjects(fakeSupabase(jointHeavy()).client, 'u1')
    expect(subjects.map(s => s.kind)).toContain('article')
  })

  it('links a thought to its project through fragments, not a column that does not exist', async () => {
    // memories has no project_id; fragments (memory_id + project_id) is the
    // link table. Selecting the missing column made every thought vanish.
    const data = corpus() as any
    data.fragments[0].memory_id = 'm1'
    const trace: string[] = []
    await gatherSubjects(fakeSupabase(data).client, 'u1', trace)
    expect(trace.join('\n')).not.toMatch(/FAILED/)
    expect(trace.join('\n')).toMatch(/memories: \d+ rows/)
  })

  it('puts a rejected query in the trace instead of reading it as an empty corpus', async () => {
    const data = corpus() as any
    // Simulate the real failure: the column simply is not there.
    data.memories = data.memories.map(({ ...m }: any) => { delete m.created_at; return m })
    const trace: string[] = []
    await gatherSubjects(fakeSupabase(data).client, 'u1', trace)
    expect(trace.join('\n')).toMatch(/!! memories query FAILED/)
  })

  it('asks about an old thought nobody ever filed', async () => {
    const data = corpus() as any
    data.joints = []
    data.fragments = []
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1')
    expect(subjects.some(s => s.shape === 'unfiled')).toBe(true)
  })
})

describe('the draft call cannot collide a project with itself', () => {
  beforeEach(() => {
    generateText.mockReset()
    batchGenerateEmbeddings.mockClear()
  })

  it('gets one dated line per subject, not every fragment it has', async () => {
    // A project block quotes every fragment. Handed that, the model picks
    // two and sets them against each other -- which is what produced "You
    // wanted to map all 198 countries... Yet you left your painted coasters
    // sitting for eleven months after writing down the Esqui ice saga":
    // three fragments of one project, collided, connector absent.
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    await bakeMull(fakeSupabase(corpus() as any).client, 'u1')

    const blindSpotPrompt = generateText.mock.calls[0][0] as string
    const draftPrompt = generateText.mock.calls[1][0] as string

    // The blind-spot call still needs the whole history to find an assumption.
    expect(blindSpotPrompt).toContain('rewrote chapter three again')
    expect(blindSpotPrompt).toContain('four passes on chapter three now')

    // The draft call gets the project named and dated, and nothing to collide.
    expect(draftPrompt).toContain('The book')
    expect(draftPrompt).not.toContain('rewrote chapter three again')
    expect(draftPrompt).not.toContain('four passes on chapter three now')
    expect(draftPrompt).not.toContain('cut the mitres at 5am')
  })
})

describe('a feed article can be a subject', () => {
  it('uses the stored text when the excerpt is the ingest-capped 100 chars', async () => {
    // 198 reading rows produced 0 article subjects in production. The RSS
    // ingest caps excerpt at 100 characters and this gatherer required
    // 120, so no feed item could ever qualify however the user rated it.
    const data = corpus() as any
    data.reading_queue = data.reading_queue.filter((r: any) => r.id === 'r2')
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1')
    const article = subjects.find(s => s.kind === 'article')
    expect(article).toBeDefined()
    expect(article!.block).toContain('refusing to accept that the shortest path')
    // And the HTML is stripped, not handed to the model as markup.
    expect(article!.block).not.toContain('<p>')
  })
})

describe('article text is real text, not markup with entities left in it', () => {
  it('decodes entities and strips tags instead of leaving them raw', async () => {
    // A regex tag-strip leaves "isn&#8217;t" in the text handed to the
    // model. The model then writes the decoded form ("isn't") in its
    // quote, quoteIsReal does a plain substring compare against the
    // stored text, and a correctly grounded quote fails to match --
    // exactly the failure this whole session has been chasing, just
    // moved one step earlier in the pipeline.
    const data = corpus() as any
    data.reading_queue = [
      {
        user_id: 'u1', id: 'r3', title: 'On not finishing', excerpt: 'a'.repeat(101),
        content: '<p>He said it isn&#8217;t about talent &amp; never was, and that the room agreed with him more readily than anyone expected for a claim that direct.</p><script>trackEvent(\'view\')</script><style>.x{color:red}</style>',
        resonance: 'good', tags: ['rss'], created_at: ago(300),
      },
    ]
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1')
    const article = subjects.find(s => s.kind === 'article')
    expect(article).toBeDefined()
    expect(article!.block).toContain('isn’t about talent & never was')
    expect(article!.block).not.toContain('&#8217;')
    expect(article!.block).not.toContain('&amp;')
    expect(article!.block).not.toContain('trackEvent')
    expect(article!.block).not.toContain('color:red')
  })
})

describe('the identity block query reports its own failures', () => {
  beforeEach(() => {
    generateText.mockReset()
    batchGenerateEmbeddings.mockClear()
  })

  it('a rejected list_items query lands in bakeMull\'s trace, not just an empty identity block', async () => {
    // identityBlock takes a trace parameter (mull-subjects.ts), but nothing
    // called it with one until this fix -- loadEchoContext and bakeMull
    // both discarded it, so a rejected query here was silent even after
    // the same class of bug was fixed everywhere else in this file.
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const data = corpus() as any
    data.list_items = data.list_items.map(({ ...i }: any) => { delete i.created_at; return i })
    const trace: string[] = []
    await bakeMull(fakeSupabase(data).client, 'u1', undefined, trace)
    expect(trace.join('\n')).toMatch(/identity-list-items query FAILED/)
  })
})
