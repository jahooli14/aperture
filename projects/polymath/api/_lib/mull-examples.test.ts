import { describe, it, expect } from 'vitest'
import { GOOD_EXAMPLES, BAD_EXAMPLES } from './mull-examples.js'
import { checkCandidate } from './mull.js'
import type { Corpus, CorpusRow } from './mull-corpus.js'

/** An example the gates would refuse teaches the model to write questions
 *  the gates refuse. So every good one is run through them against a
 *  corpus made of its own evidence. */
describe('the teaching examples', () => {
  GOOD_EXAMPLES.forEach(e => {
    it(`clears the honesty gates: ${e.move}`, () => {
      const rows: CorpusRow[] = e.evidence.map((ev, i) => ({
        kind: 'memory', id: `x${i}`, captureId: `x${i}`, ref: `X${i + 1}`, projectId: null, title: '', text: ev.text, meta: ev.where,
      }))
      const corpus: Corpus = { rows, byRef: new Map(rows.map(r => [r.ref, r])), projectIdByTitle: new Map(), text: '' }
      const r = checkCandidate({
        question: e.question, noticing: '', stake: e.stake, project: null,
        evidence: rows.map(row => ({ ref: row.ref, quote: row.text })),
      }, corpus)
      expect(r.ok ? 'ok' : r.reason).toBe('ok')
    })
  })

  it('every good example builds on at least two things', () => {
    for (const e of GOOD_EXAMPLES) expect(e.evidence.length).toBeGreaterThanOrEqual(2)
  })

  it('every bad example says why', () => {
    for (const e of BAD_EXAMPLES) expect(e.why.length).toBeGreaterThan(20)
  })
})
