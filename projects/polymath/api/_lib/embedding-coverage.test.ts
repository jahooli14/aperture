import { describe, it, expect } from 'vitest'
import { isStale, summarise, describeCoverage, type CoverageRow } from './embedding-coverage.js'

const row = (over: Partial<CoverageRow> = {}): CoverageRow => ({
  id: 'r1',
  embedding: [0.1, 0.2],
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('isStale', () => {
  it('is not stale when the row has not changed since the vector was built', () => {
    expect(isStale(row({
      embedded_at: '2026-02-01T00:00:00Z',
      text_updated_at: '2026-01-15T00:00:00Z',
    }))).toBe(false)
  })

  it('is stale when the text was rewritten after the vector was built', () => {
    // The failure this exists to catch: the search still works, still
    // returns rows, and is quietly answering about text that is gone.
    expect(isStale(row({
      embedded_at: '2026-01-15T00:00:00Z',
      text_updated_at: '2026-03-01T00:00:00Z',
    }))).toBe(true)
  })

  it('does not call a row with no vector stale — it is missing, not wrong', () => {
    expect(isStale(row({ embedding: null, embedded_at: '2026-01-01T00:00:00Z', text_updated_at: '2026-03-01T00:00:00Z' }))).toBe(false)
  })

  it('leaves rows that predate the column alone', () => {
    // The migration stamps these. Reading a missing embedded_at as stale
    // would rebuild the whole corpus on the first run for no reason.
    expect(isStale(row({ text_updated_at: '2026-03-01T00:00:00Z' }))).toBe(false)
  })

  it('does not guess staleness from a timestamp that is not about the text', () => {
    // A project row is written whenever its heat is recomputed or a task is
    // ticked. Reading that as "the text changed" reported all 34 projects
    // stale on a corpus where none had been reworded, which would have sent
    // the whole table back through the embedder every run.
    expect(isStale(row({ created_at: '2026-03-01T00:00:00Z', embedded_at: '2026-01-01T00:00:00Z' }))).toBe(false)
  })

  it('allows a second of slack, because the two writes race on the capture path', () => {
    expect(isStale(row({
      embedded_at: '2026-01-01T00:00:00.000Z',
      text_updated_at: '2026-01-01T00:00:00.400Z',
    }))).toBe(false)
  })

  it('treats an unreadable timestamp as no evidence rather than as staleness', () => {
    expect(isStale(row({ embedded_at: 'whenever', text_updated_at: '2026-03-01T00:00:00Z' }))).toBe(false)
  })
})

describe('summarise', () => {
  it('counts missing, stale and embedded separately', () => {
    const c = summarise('memories', [
      row({ id: 'a', embedded_at: '2026-02-01T00:00:00Z' }),
      row({ id: 'b', embedding: null }),
      row({ id: 'c', embedded_at: '2026-01-01T00:00:00Z', text_updated_at: '2026-04-01T00:00:00Z' }),
    ])
    expect(c).toMatchObject({ table: 'memories', total: 3, embedded: 2, missing: 1, stale: 1, excluded: 0 })
  })

  it('reads a pgvector string as a vector', () => {
    expect(summarise('t', [row({ embedding: '[0.1,0.2]' })]).embedded).toBe(1)
  })

  it('does not count a deliberate exclusion as a gap', () => {
    // An article with no "good" verdict is not corpus, so it having no
    // vector is the rule working, not a hole in coverage.
    const c = summarise('reading_queue', [
      row({ id: 'a', embedding: null }),
      row({ id: 'b', embedding: null }),
    ], r => r.id === 'b')
    expect(c).toMatchObject({ total: 2, excluded: 1, missing: 1, embedded: 0 })
  })
})

describe('describeCoverage', () => {
  it('says plainly when there is nothing to do', () => {
    const lines = describeCoverage([summarise('memories', [row({ embedded_at: '2026-02-01T00:00:00Z' })])])
    expect(lines[lines.length - 1]).toContain('every corpus row has a current vector')
  })

  it('names the gap and what to run', () => {
    const lines = describeCoverage([summarise('memories', [row({ embedding: null })])])
    expect(lines[0]).toContain('1 MISSING')
    expect(lines[lines.length - 1]).toContain('backfill-embeddings')
  })

  it('counts the excluded rows out of the denominator', () => {
    const lines = describeCoverage([summarise('reading_queue', [
      row({ id: 'a', embedded_at: '2026-02-01T00:00:00Z' }),
      row({ id: 'b', embedding: null }),
    ], r => r.id === 'b')])
    expect(lines[0]).toContain('1/1 embedded')
    expect(lines[0]).toContain('1 not corpus')
  })
})
