/**
 * Joint mining, end to end against a fake Postgres.
 *
 * The joints table was empty in production for as long as anyone looked,
 * which meant the mull channel never once had its strongest subject
 * available — "something you keep saying and have never made". Nothing
 * said why, because the fragments read was a PostgREST embed whose result
 * was taken as `const { data } = await`: a rejected query and an empty
 * table were the same value, and a count of zero came back either way.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('./gemini-chat.js', () => ({
  generateText: async () => JSON.stringify({ joint: 'it only works if it is one take' }),
}))
vi.mock('./gemini-embeddings.js', () => ({
  generateEmbedding: async () => [1, 0, 0],
  // Real behaviour: pgvector arrives as a JSON string and this parses it.
  cosineSimilarity: (a: unknown, b: unknown) => {
    const arr = (v: unknown) => (Array.isArray(v) ? v : JSON.parse(v as string))
    const [x, y] = [arr(a), arr(b)]
    return x[0] === y[0] ? 0.95 : 0.1
  },
}))

const { mineJoints } = await import('./joint-miner.js')

const DAY = 86_400_000
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString()

type Tables = Record<string, { data: unknown[] | null; error: { message: string } | null }>

function fakeSupabase(tables: Tables) {
  const inserted: unknown[] = []
  const builder = (table: string): any => {
    const result = tables[table] ?? { data: [], error: null }
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      update: () => chain,
      insert: (row: unknown) => { inserted.push(row); return Promise.resolve({ error: null }) },
      then: (res: (v: unknown) => void) => res(result),
    }
    return chain
  }
  return { client: { from: builder } as any, inserted }
}

/** Three fragments of one recurring idea, spread over two years. */
const FRAGMENTS = [
  { id: 'f1', text: 'it only works if it is one take', created_at: ago(760), memory_id: 'm1' },
  { id: 'f2', text: 'the good mixes were always the first pass', created_at: ago(420), memory_id: 'm2' },
  { id: 'f3', text: 'one take or it is not honest', created_at: ago(90), memory_id: 'm3' },
]

describe('mineJoints', () => {
  it('clusters fragments whose embeddings arrive as pgvector strings', async () => {
    const { client, inserted } = fakeSupabase({
      fragments: { data: FRAGMENTS, error: null },
      memories: {
        data: [
          { id: 'm1', embedding: '[1,0,0]' },
          { id: 'm2', embedding: '[1,0,0]' },
          { id: 'm3', embedding: '[1,0,0]' },
        ],
        error: null,
      },
      joints: { data: [], error: null },
    })

    const { written, trace } = await mineJoints(client, 'u1')

    expect(written).toBe(1)
    expect(inserted).toHaveLength(1)
    expect(trace.join('\n')).toContain('clusterable: 3 of 3')
  })

  it('says so when the fragments query is rejected, instead of reporting zero', async () => {
    const { client } = fakeSupabase({
      fragments: { data: null, error: { message: 'column fragments.memories does not exist' } },
    })

    const { written, trace } = await mineJoints(client, 'u1')

    expect(written).toBe(0)
    expect(trace.join('\n')).toMatch(/fragments query FAILED/)
  })

  it('names the case where nothing can cluster at all', async () => {
    // Fragments exist but no memory carries an embedding, so clustering is
    // arithmetically impossible and no joint can ever be written. That read
    // as "the user has nothing recurring to say".
    const { client } = fakeSupabase({
      fragments: { data: FRAGMENTS, error: null },
      memories: { data: [{ id: 'm1', embedding: null }], error: null },
      joints: { data: [], error: null },
    })

    const { written, trace } = await mineJoints(client, 'u1')

    expect(written).toBe(0)
    expect(trace.join('\n')).toContain('nothing can cluster')
  })

  it('drops a cluster confined to one sitting', async () => {
    // Five fragments from one afternoon is one thought, not a conviction.
    const sameDay = FRAGMENTS.map((f, i) => ({ ...f, created_at: ago(10 + i * 0.1) }))
    const { client, inserted } = fakeSupabase({
      fragments: { data: sameDay, error: null },
      memories: {
        data: sameDay.map(f => ({ id: f.memory_id, embedding: '[1,0,0]' })),
        error: null,
      },
      joints: { data: [], error: null },
    })

    const { written } = await mineJoints(client, 'u1')

    expect(written).toBe(0)
    expect(inserted).toHaveLength(0)
  })
})
