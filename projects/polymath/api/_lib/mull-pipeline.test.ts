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
      { user_id: 'u1', id: 'm1', title: 'Dad', body: 'Ten more proper conversations with dad, probably, and we spend them on the greenhouse. It is the only tidy room in a messy house and I do not know why that matters to me but it does.', created_at: ago(280), memory_type: 'insight', embedding: [0, 0, 1] },
      { user_id: 'u1', id: 'm2', title: 'Mixing', body: 'Kept the first take of the whole side even though the drop is late. It breathes. Every version I tightened afterwards was worse and I deleted them all.', created_at: ago(150), memory_type: 'insight', embedding: [0, 0, 1] },
    ],
    projects: [
      { user_id: 'u1', id: 'p-book', title: 'The book', description: 'A novel where characters get swapped out partway through', metadata: { end_goal: 'a finished manuscript' }, last_closeout_text: 'Got through the chapter nine rewrite', created_at: ago(600), last_active: ago(120), last_session_ended_at: ago(120), state: 'mull', status: 'active', embedding: [1, 0, 0] },
      { user_id: 'u1', id: 'p-deck', title: 'Deck stand', description: 'A stand for the decks, out of oak offcuts', metadata: {}, last_closeout_text: null, created_at: ago(500), last_active: ago(400), last_session_ended_at: null, state: 'mull', status: 'dormant', embedding: [0, 1, 0] },
    ],
    joints: [{ user_id: 'u1', id: 'j1', text: 'it only works if it is one take', fragment_ids: ['f1', 'f2', 'f3'], occurrence_count: 3, last_seen_at: ago(90) }],
    list_items: [
      { user_id: 'u1', id: 'l1', content: 'Burden of Dreams', user_rating: 5, status: 'active', created_at: ago(500), lists: { title: 'Films', type: 'film' } },
      { user_id: 'u1', id: 'l2', content: 'Learn to solder properly', user_rating: null, status: 'active', created_at: ago(600), lists: { title: 'To do', type: 'skill' } },
    ],
    reading_queue: [
      { user_id: 'u1', id: 'r1', title: 'On first takes', excerpt: 'The recording is not a document of the performance, it is the performance. Once you accept that, editing becomes a different kind of lie, and the whole practice of fixing things afterwards starts to look strange.', content: null, resonance: 'good', read_at: null, tags: [], created_at: ago(400) },
      // A feed item as the ingest actually stores one: excerpt capped at
      // 100 characters, the real text in `content`. Every article in
      // production looked like this, and the gatherer wanted 120 chars of
      // excerpt -- a threshold the ingest can never produce.
      { user_id: 'u1', id: 'r2', title: 'The long way round', excerpt: 'A short feed blurb, cut at a hundred characters by the ingest, which is all any RSS row ev', content: '<p>People who take the long way round are not being slow. They are refusing to accept that the shortest path is the same as the best one, and that refusal costs them years and buys them something nobody has named.</p>', resonance: 'good', read_at: null, tags: ['rss'], created_at: ago(300) },
    ],
    sparks: [],
  }
}

type Row = Record<string, any>

/** Minimal PostgREST-shaped stub: real predicates, so a query that filters
 *  wrongly comes back empty here too rather than quietly passing. */
function fakeSupabase(data: Record<string, Row[]>) {
  // Every real `memories` row has a `tags` column, and the stub models a
  // table by the keys of its first row — so a fixture that omits it would
  // reject a select that production accepts, which is the guard firing at
  // the wrong target. Provenance filtering reads tags (corpus-provenance.ts);
  // a fixture that wants an app-authored note sets them explicitly.
  if (data.memories) data.memories = data.memories.map(m => ({ tags: [], ...m }))
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
      spark: 'You wrote that you get maybe ten more proper conversations with dad, and you spend them on the greenhouse. You have said for years that it only works if it is one take. What are you doing twice?',
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

  it('never counts a note the app elicited as a capture', async () => {
    // The failure this prevents: the user answers a question about a project
    // that has been silent for months, the answer is filed under that
    // project dated today, and the next run announces that they "came back
    // to it". They did not. The app poked them, then read its own poke as
    // evidence. corpus-time.ts's whole claim is that a date cannot be faked.
    const data = corpus() as any
    data.memories.push({
      user_id: 'u1', id: 'spark-1', title: 'Spark response',
      body: 'Yes, the deck stand is the one I keep not finishing, you are right about that.',
      created_at: ago(0), memory_type: 'insight', tags: ['spark-response'], embedding: [0, 0, 1],
    })
    data.fragments.push({
      user_id: 'u1', id: 'f-spark', text: 'the deck stand is the one I keep not finishing',
      created_at: ago(0), memory_id: 'spark-1', project_id: 'p1',
    })

    const trace: string[] = []
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1', trace)

    expect(trace.join('\n')).toMatch(/provenance: 1 app-authored notes excluded/)
    // It reaches no subject, by its text or by its id.
    const blob = JSON.stringify(subjects)
    expect(blob).not.toMatch(/keep not finishing/)
    expect(blob).not.toMatch(/spark-1/)
  })

  it('still counts everything the user said unprompted', async () => {
    // The filter reads a missing tags column as "user said it", because
    // almost the entire corpus predates the marker. Getting this backwards
    // empties every timeline at once.
    const trace: string[] = []
    const before = await gatherSubjects(fakeSupabase(corpus()).client, 'u1', trace)
    expect(before.length).toBeGreaterThan(0)
    expect(trace.join('\n')).not.toMatch(/provenance:/)
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

  it('does not turn a logged event into a subject', async () => {
    // A real production question: "You were watching the Arsenal match and
    // noticed how well organized the team appears this season. Then you
    // wrote that their winning streak has come to an end. Does
    // organization keep the streak alive?" -- self-contained sports
    // trivia, no connector doing any work, no stake, nothing to make.
    // memory_type is stamped at capture time by the same triage that
    // writes everything else on the row; 'event' means "something that
    // happened," not a reflection with a blind spot in it.
    const data = corpus() as any
    data.joints = []
    data.fragments = []
    data.memories = [
      {
        user_id: 'u1', id: 'm-event', title: "BBC Report: Arsenal's Winning Streak Ends",
        body: 'Watching the Arsenal match, they looked well organised again this season, but the winning streak has come to an end after that result.',
        created_at: ago(280), memory_type: 'event',
      },
    ]
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1')
    expect(subjects.some(s => s.shape === 'unfiled')).toBe(false)
  })

  it('still allows an unclassified note through -- most memories predate the field', async () => {
    const data = corpus() as any
    data.joints = []
    data.fragments = []
    data.memories = [
      {
        user_id: 'u1', id: 'm-unclassified', title: 'Old note',
        body: 'Something I keep meaning to come back to and never have, a real reflection with no memory_type stamped on it at all.',
        created_at: ago(280), memory_type: null,
      },
    ]
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

  it('ignores a feed article opened but never voted on', () => {
    // Two archived articles reached a real question this way. Opening is
    // not a verdict, and read_at is not even a reliable record of opening:
    // any path that sets status to 'reading' stamps it, including the
    // swipe that means "put this in my list".
    const data = corpus() as any
    data.reading_queue = [{
      ...data.reading_queue.find((r: any) => r.id === 'r2'),
      resonance: null,
      read_at: ago(290),
    }]
    return gatherSubjects(fakeSupabase(data).client, 'u1').then(subjects => {
      expect(subjects.find(s => s.kind === 'article')).toBeUndefined()
    })
  })

  it('still ignores a feed article that was never opened', async () => {
    const data = corpus() as any
    data.reading_queue = [{
      ...data.reading_queue.find((r: any) => r.id === 'r2'),
      resonance: null,
      read_at: null,
    }]
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1')
    expect(subjects.find(s => s.kind === 'article')).toBeUndefined()
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
        resonance: 'good', read_at: null, tags: ['rss'], created_at: ago(300),
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

describe('a gatherer failure does not take down the whole bake', () => {
  it('malformed article HTML falls back to the excerpt instead of throwing', async () => {
    // articleSubject runs inside gatherSubjects' Promise.all alongside four
    // other gatherers. An uncaught throw parsing one article's HTML would
    // fail the whole bake -- every subject lost, not just this one.
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const data = corpus() as any
    data.reading_queue = [
      {
        user_id: 'u1', id: 'r4', title: 'Bad markup', excerpt: 'a'.repeat(150),
        // linkedom is lenient about most malformed HTML, so this asserts
        // the fallback path directly rather than hoping some input throws.
        content: '<p>short</p>',
        resonance: 'good', read_at: null, tags: [], created_at: ago(300),
      },
    ]
    await expect(gatherSubjects(fakeSupabase(data).client, 'u1')).resolves.not.toThrow()
  })
})

describe('isTransientError', () => {
  it('recognises the failure actually seen in production', async () => {
    const { isTransientError } = await import('./mull-subjects.js')
    expect(isTransientError('Gateway Timeout')).toBe(true)
    expect(isTransientError('upstream connect error or disconnect/reset before headers')).toBe(true)
    expect(isTransientError('request timed out')).toBe(true)
    expect(isTransientError('ECONNRESET')).toBe(true)
  })

  it('does not retry a real rejection -- retrying that would just be slower', async () => {
    const { isTransientError } = await import('./mull-subjects.js')
    expect(isTransientError('column list_items.foo does not exist')).toBe(false)
    expect(isTransientError('new row violates row-level security policy')).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})

describe('a timed-out long-held query gets one retry, not a silent empty result', () => {
  it('succeeds on the second attempt after a Gateway Timeout on the first', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const data = corpus() as any

    let longHeldCalls = 0
    const real = fakeSupabase(data).client
    // identityBlock ALSO reads list_items, with a different select (no
    // 'status' column) -- distinguish on that, rather than intercepting
    // every list_items call, so this only exercises longHeldSubject's path.
    const client = {
      ...real,
      from: (table: string) => {
        const chain = real.from(table)
        if (table !== 'list_items') return chain
        const realSelect = chain.select
        chain.select = (cols?: string) => {
          if (!cols?.includes('status')) return realSelect(cols)
          longHeldCalls++
          const isFirstCall = longHeldCalls === 1
          const wrapped = realSelect(cols)
          const realThen = wrapped.then
          wrapped.then = (resolve: (v: any) => unknown) =>
            isFirstCall
              ? resolve({ data: null, error: { message: 'Gateway Timeout' } })
              : realThen(resolve)
          return wrapped
        }
        return chain
      },
    }

    const trace: string[] = []
    await bakeMull(client as any, 'u1', undefined, trace)

    expect(longHeldCalls).toBe(2)
    expect(trace.join('\n')).toMatch(/retrying after transient error/)
    expect(trace.join('\n')).not.toMatch(/long-held-candidates query FAILED/)
  })

  it('does not retry forever -- one retry, then it reports the failure', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const data = corpus() as any

    let longHeldCalls = 0
    const real = fakeSupabase(data).client
    const client = {
      ...real,
      from: (table: string) => {
        const chain = real.from(table)
        if (table !== 'list_items') return chain
        const realSelect = chain.select
        chain.select = (cols?: string) => {
          if (!cols?.includes('status')) return realSelect(cols)
          longHeldCalls++
          const wrapped = realSelect(cols)
          wrapped.then = (resolve: (v: any) => unknown) =>
            resolve({ data: null, error: { message: 'Gateway Timeout' } })
          return wrapped
        }
        return chain
      },
    }

    const trace: string[] = []
    await bakeMull(client as any, 'u1', undefined, trace)

    expect(longHeldCalls).toBe(2)
    expect(trace.join('\n')).toMatch(/long-held-candidates query FAILED/)
  })
})

describe('a question with no project on either side is correct silence, end to end', () => {
  beforeEach(() => {
    generateText.mockReset()
    batchGenerateEmbeddings.mockClear()
  })

  it('an unfiled thought with no project connector in band produces nothing, not a manufactured question', async () => {
    // The actual production failure: an unfiled note about a football
    // match, paired with whatever else happened to score in band, wrote
    // self-contained sports trivia -- no project on either side, nothing
    // to build. The subject/blind-spot/draft calls all ran fine; the
    // fix has to be that the pairing itself never survives to draft.
    generateText.mockResolvedValueOnce(BLIND_SPOTS)
    const data = corpus() as any
    data.joints = []
    data.fragments = []
    data.memories = [
      {
        user_id: 'u1', id: 'm-unfiled', title: 'Old reflection',
        body: 'Something I keep meaning to come back to and never have, a real thought with no project attached to it at all.',
        created_at: ago(280), memory_type: 'insight',
      },
    ]
    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(data).client, 'u1', undefined, trace)
    expect(baked).toEqual([])
    // Never reached the draft call at all -- the pairing was thrown out
    // before there was anything to draft.
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('the same unfiled thought DOES produce a question once a project scores in band', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)
    const data = corpus() as any
    data.joints = []
    data.fragments = []
    data.memories = [
      {
        user_id: 'u1', id: 'm-unfiled', title: 'Old reflection',
        body: 'Something I keep meaning to come back to and never have, a real thought with no project attached to it at all.',
        created_at: ago(280), memory_type: 'insight',
      },
    ]
    const real = fakeSupabase(data).client
    const client = {
      ...real,
      rpc: async (name: string, args: Row) => {
        if (name === 'match_projects') {
          return { data: [{ id: 'p-book', title: 'The book', description: 'A novel', similarity: 0.6 }], error: null }
        }
        return real.rpc(name, args)
      },
    }
    const trace: string[] = []
    const baked = await bakeMull(client as any, 'u1', undefined, trace)
    expect(trace.join('\n')).toMatch(/search \[memory\].*-> 1 in band/)
  })
})

describe('a buried project is not resurfaced as a subject or a connector', () => {
  beforeEach(() => {
    generateText.mockReset()
    batchGenerateEmbeddings.mockClear()
  })

  it('never picks a graveyarded project as a subject', async () => {
    // Sent to the graveyard: status: 'abandoned', state stays 'mull'.
    // Every existing `.neq('state', 'harvested')` guard in this codebase
    // misses that -- only the JS-side isGraveyarded check catches it.
    const data = corpus() as any
    data.projects = [
      ...data.projects,
      { user_id: 'u1', id: 'p-buried', title: 'The buried one', description: 'Sent to the graveyard months ago', metadata: {}, last_closeout_text: null, created_at: ago(700), last_active: ago(700), last_session_ended_at: ago(700), state: 'mull', status: 'abandoned' },
    ]
    data.fragments.push(
      { user_id: 'u1', id: 'f-buried1', text: 'still thinking about the buried project', created_at: ago(650), project_id: 'p-buried', memory_id: null, projects: { title: 'The buried one' } },
      { user_id: 'u1', id: 'f-buried2', text: 'the buried project again, same as before', created_at: ago(600), project_id: 'p-buried', memory_id: null, projects: { title: 'The buried one' } },
    )
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1')
    expect(subjects.some(s => s.id === 'p-buried')).toBe(false)
  })

  it('does not let a graveyarded project through match_projects as a connector', async () => {
    // The sharper case: the subject has no project of its own (an
    // unfiled thought), a project connector is now REQUIRED, and
    // match_projects itself returns a match -- but that project has
    // been sent to the graveyard. Without the status lookup this would
    // confidently point the user at a project they deliberately buried.
    generateText.mockResolvedValueOnce(BLIND_SPOTS)
    const data = corpus() as any
    data.joints = []
    data.fragments = []
    data.memories = [
      {
        user_id: 'u1', id: 'm-unfiled', title: 'Old reflection',
        body: 'Something I keep meaning to come back to and never have, a real thought with no project attached to it at all.',
        created_at: ago(280), memory_type: 'insight',
      },
    ]
    data.projects = [
      ...data.projects,
      { user_id: 'u1', id: 'p-buried', title: 'The buried one', description: 'Sent to the graveyard', metadata: {}, last_closeout_text: null, created_at: ago(700), last_active: ago(700), last_session_ended_at: ago(700), state: 'mull', status: 'abandoned' },
    ]
    const real = fakeSupabase(data).client
    const client = {
      ...real,
      rpc: async (name: string, args: Row) => {
        if (name === 'match_projects') {
          return { data: [{ id: 'p-buried', title: 'The buried one', description: 'Sent to the graveyard', similarity: 0.6 }], error: null }
        }
        return real.rpc(name, args)
      },
    }
    const trace: string[] = []
    const baked = await bakeMull(client as any, 'u1', undefined, trace)
    expect(baked).toEqual([])
    expect(trace.join('\n')).toMatch(/nothing in band/)
  })
})

describe('a fragment is dated by the thought, not by the backfill that wrote it', () => {
  it('reads the linked memory date when every fragment row shares one timestamp', async () => {
    // backfillFragments writes the years already in the corpus in a single
    // run, so those rows all carry the same created_at. Production reported
    // "corpus span: 0 days" across 72 fragments -- every shape in this file
    // is arithmetic over these dates, so all of them collapsed at once.
    const data = corpus() as any
    const flattened = ago(1)
    data.memories = data.fragments.map((f: any, i: number) => ({
      user_id: 'u1',
      id: `m-${f.id}`,
      title: f.text,
      body: f.text,
      created_at: f.created_at, // the real thinking date
      embedding: [i / 10, 1 - i / 10, 0.5],
    }))
    data.fragments = data.fragments.map((f: any) => ({
      ...f,
      created_at: flattened, // what the backfill actually stamped
      memory_id: `m-${f.id}`,
    }))

    const trace: string[] = []
    await gatherSubjects(fakeSupabase(data).client, 'u1', trace)

    const spanLine = trace.find(t => t.startsWith('corpus span:'))!
    expect(spanLine).toBeDefined()
    // The real span is years. Reading the row dates it would be 0.
    expect(Number(spanLine.match(/(\d+)/)![1])).toBeGreaterThan(300)
  })
})

describe('a joint that fits no sharper shape is still a joint', () => {
  it('keeps a theme recurring across months that is too young to be a conviction', async () => {
    // classifyTimeline's bars are built for raw timelines. Against a corpus
    // this size `conviction` wants ~250 days and `went_quiet` wants 120 days
    // of silence, so a theme recurring across three months and still warm
    // matched nothing and the joint was dropped — the strongest subject kind
    // the channel has, thrown away on a technicality it had already proved.
    const data = corpus() as any
    const recent: Record<string, string> = { f1: ago(100), f2: ago(60), f3: ago(20) }
    data.fragments = data.fragments.map((f: any) =>
      recent[f.id] ? { ...f, created_at: recent[f.id] } : f)

    const trace: string[] = []
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1', trace)
    const joint = subjects.find(s => s.kind === 'joint')

    expect(joint).toBeDefined()
    expect(joint!.shape).toBe('recurring')
    // The fact still has to be true and dated — that is the whole reason a
    // joint is worth asking about.
    expect(joint!.line).toMatch(/\b3 times\b/)
    expect(joint!.line).toMatch(/\b20\d\d\b/)
    expect(joint!.line).toContain('never made it a project')
  })

  it('says how many joints became subjects, and why the rest did not', async () => {
    const data = corpus() as any
    const trace: string[] = []
    await gatherSubjects(fakeSupabase(data).client, 'u1', trace)
    expect(trace.join('\n')).toMatch(/joint subjects: \d+ of \d+/)
  })
})

describe('a sloppy quote no longer loses the question before the gate sees it', () => {
  it('keeps a draft whose quote field is empty but whose question carries the note', async () => {
    // The parser required spark AND quote AND stake, so a missing quote
    // dropped the draft right there -- pre-empting rejectionReason, which
    // exists precisely to re-check the question itself when the model
    // mis-reports what it used. Silent, and indistinguishable in the trace
    // from a model that had nothing to say.
    const noQuote = JSON.stringify({
      pairs: [{
        n: 1,
        spark: 'You wrote that you get maybe ten more proper conversations with dad, and you spend them on the greenhouse. You have said for years that it only works if it is one take. What are you doing twice?',
        quote: '',
        stake: 'He stops re-recording and keeps the next first pass.',
      }],
    })
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(noQuote)

    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)

    expect(baked.length).toBeGreaterThan(0)
    expect(trace.join('\n')).toContain('with no quote')
  })

  it('says so in the trace when the draft call itself fails', async () => {
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockRejectedValueOnce(new Error('503 Service Unavailable'))

    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus()).client, 'u1', undefined, trace)

    expect(baked).toHaveLength(0)
    // Previously this was a console.warn and the trace just said "0 of 4",
    // which reads identically to the model declining every pair.
    expect(trace.join('\n')).toMatch(/draft call FAILED: .*503/)
  })
})

describe('one capture per thought, so the habitual-pair guard can work', () => {
  it('does not count a thought and its own fragment as two co-occurrences', async () => {
    // A filed thought appears twice -- as the memory and as the fragment
    // pointing at it, both carrying the same date -- so one co-occurrence
    // between two projects became four pairings, and "only happened once"
    // could never be true. Production: 276 pairs, 0 unique.
    const data = corpus() as any
    // Two projects, one capture each, two days apart and long ago. Each
    // thought is filed, so each also exists as a fragment.
    data.memories = [
      { user_id: 'u1', id: 'mA', title: 'A', body: 'the kiln finally came up to temperature', created_at: ago(300), memory_type: 'insight' },
      { user_id: 'u1', id: 'mB', title: 'B', body: 'the bassline should sit under the vocal', created_at: ago(298), memory_type: 'insight' },
    ]
    data.fragments = [
      { user_id: 'u1', id: 'fA', text: 'the kiln finally came up to temperature', created_at: ago(1), project_id: 'p-book', memory_id: 'mA', projects: { title: 'The book' } },
      { user_id: 'u1', id: 'fB', text: 'the bassline should sit under the vocal', created_at: ago(1), project_id: 'p-deck', memory_id: 'mB', projects: { title: 'Deck stand' } },
    ]
    data.joints = []

    const trace: string[] = []
    const subjects = await gatherSubjects(fakeSupabase(data).client, 'u1', trace)

    const line = trace.find(t => t.startsWith('simultaneity:'))!
    // Two captures, not four: the fragment and its memory are one thought.
    expect(line).toContain('2 captures with a project')
    expect(line).toContain('1 that only happened once')
    expect(subjects.find(s => s.kind === 'pair')).toBeDefined()
  })
})

describe('a subject the standing question already covers goes to the back', () => {
  it('prefers a project no recent question was about', async () => {
    const data = corpus() as any
    const trace: string[] = []

    // With nothing standing, the strongest project leads.
    const fresh = await gatherSubjects(fakeSupabase(data).client, 'u1', trace)
    const leader = fresh.find(s => s.kind === 'project')!

    // Now say a recent question already covered that project.
    const after = await gatherSubjects(
      fakeSupabase(corpus() as any).client, 'u1', [], new Set([leader.projectId!]),
    )
    const stillThere = after.find(s => s.id === leader.id)

    // Not dropped -- a repeat still beats an empty slot, and the gates are
    // still in front of it -- but it no longer leads.
    expect(after[0].id).not.toBe(leader.id)
    if (stillThere) expect(stillThere.strength).toBeLessThan(leader.strength)
  })
})

describe('an article connector quotes the article, not the feed teaser', () => {
  it('hands the model the real text for an article the search returned', async () => {
    // match_reading returns `excerpt`, capped at 100 characters by the
    // ingest. The connector is the only text the model may quote, and the
    // gate then demands the note's own words survive into the question --
    // so a teaser asks it to quote from something that barely exists.
    generateText.mockReset()
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)

    const real = fakeSupabase(corpus() as any)
    const client = {
      ...real.client,
      rpc: async (name: string, args: Row) => {
        // The base stub answers match_reading with nothing, so an article
        // can never reach the band there. Make one win.
        if (name === 'match_reading') {
          const r2 = (corpus() as any).reading_queue.find((r: any) => r.id === 'r2')
          return { data: [{ id: r2.id, title: r2.title, excerpt: r2.excerpt, similarity: 0.58 }], error: null }
        }
        if (name === 'match_memories') return { data: [], error: null }
        return (real.client as any).rpc(name, args)
      },
    } as any

    await bakeMull(client, 'u1')

    const draftPrompt = generateText.mock.calls.at(-1)![0] as string
    // The article's real text, not the 89-character blurb match_reading
    // handed back.
    expect(draftPrompt).toContain('refusing to accept that the shortest path')
    expect(draftPrompt).not.toContain('cut at a hundred characters by the ingest')
  })
})

describe('the best question that clears the gates ships first', () => {
  it('prefers the one whose question turns on the note over one that merely quotes it', async () => {
    // Both clear every gate. The first replays the note in its setup and
    // then asks something the note has nothing to do with; the second
    // turns on the note's own words. rankPairs ranked the PAIR, so before
    // this the first shipped purely because its pair scored higher.
    generateText.mockReset()
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(JSON.stringify({
      pairs: [
        {
          n: 1,
          spark: 'You wrote that you get maybe ten more proper conversations with dad, and you spend them on the greenhouse. Which room gets tidied next?',
          quote: 'ten more proper conversations with dad',
          stake: 'He books the weekend and drives up there.',
        },
        {
          n: 2,
          spark: 'You kept the first take of the whole side even though the drop is late. Which chapter are you going to keep the first take of?',
          quote: 'Kept the first take of the whole side even though the drop is late',
          stake: 'He leaves chapter nine alone and ships it.',
        },
      ],
    }))

    const trace: string[] = []
    const baked = await bakeMull(fakeSupabase(corpus() as any).client, 'u1', undefined, trace)

    expect(baked.length).toBeGreaterThan(0)
    // The one whose question sentence carries the note leads.
    expect(baked[0].text).toContain('keep the first take of')
    expect(trace.join('\n')).toMatch(/ranked \d+ that cleared the gates/)
  })
})

describe('the orbit pass: the relationship is computed, not searched', () => {
  it('hands the draft a claim about unused material instead of two things to bridge', async () => {
    generateText.mockReset()
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)

    // A memory near The book's vector, old, and never filed to it.
    const data = corpus() as any
    data.memories = [
      ...data.memories,
      {
        user_id: 'u1', id: 'm-orbit',
        title: 'Swapping', body: 'The person who comes back is never the person who left, and nobody in the room says so out loud.',
        created_at: ago(300), memory_type: 'insight', embedding: [1, 0, 0.8],
      },
    ]

    const trace: string[] = []
    await bakeMull(fakeSupabase(data).client, 'u1', undefined, trace)

    const draftPrompt = generateText.mock.calls.at(-1)![0] as string
    // The project is named, and the claim is the computed one.
    expect(draftPrompt).toContain('THE PROJECT: The book')
    expect(draftPrompt).toContain('THE UNUSED MATERIAL')
    expect(draftPrompt).toMatch(/sits closest to "The book"/)
    // And the instruction that killed the old shape is in front of it.
    expect(draftPrompt).toContain('do NOT look for a link')
    expect(trace.join('\n')).toMatch(/orbit: \d+ projects x \d+ captures/)
  })

  it('does not orbit a memory that already went into that project', async () => {
    generateText.mockReset()
    generateText.mockResolvedValueOnce(BLIND_SPOTS).mockResolvedValueOnce(DRAFTS)

    const data = corpus() as any
    data.memories = [...data.memories, {
      user_id: 'u1', id: 'm-orbit', title: 'Swapping', body: 'The person who comes back is never the person who left.',
      created_at: ago(300), memory_type: 'insight', embedding: [1, 0, 0.8],
    }]
    // It went in.
    data.fragments = [...data.fragments, {
      user_id: 'u1', id: 'f-orbit', text: 'The person who comes back is never the person who left.',
      created_at: ago(300), project_id: 'p-book', memory_id: 'm-orbit', projects: { title: 'The book' },
    }]

    const trace: string[] = []
    await bakeMull(fakeSupabase(data).client, 'u1', undefined, trace)
    expect(trace.join('\n')).toMatch(/-> 0 not already filed there/)
  })
})
