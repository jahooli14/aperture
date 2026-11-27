import { describe, it, expect } from 'vitest'
import { groundLines, portraitInputHash } from './portrait.js'
import type { Corpus, CorpusRow } from './mull-corpus.js'

const row = (ref: string, kind: CorpusRow['kind'], at?: string, captureId = ref): CorpusRow =>
  ({ kind, id: ref, ref, captureId, projectId: null, title: ref, text: `text ${ref}`, meta: '', at })
const rows = [row('P1', 'project'), row('N1', 'memory', '2026-01-03'), row('N2', 'memory', '2026-08-23'), row('L1', 'list_item'), row('F1', 'fragment', '2026-08-23', 'N2')]
const corpus: Corpus = { rows, byRef: new Map(rows.map(r => [r.ref, r])), projectIdByTitle: new Map(), text: '' }

describe('groundLines', () => {
  it('keeps a line backed by three real rows from two kinds of place, dated from the rows', () => {
    const [l] = groundLines({ lines: [{ name: 'people quietly swapped', refs: ['[P1]', 'N1', 'N2', 'L1'] }] }, corpus)
    expect(l.rows.map(r => r.id)).toEqual(['P1', 'N1', 'N2', 'L1'])
    expect([l.first, l.last]).toEqual(['2026-01-03', '2026-08-23'])
  })
  it('drops invented refs, double-counted captures and one-place lines', () => {
    expect(groundLines({ lines: [{ name: 'a', refs: ['N1', 'N9', 'N8'] }] }, corpus)).toEqual([])
    expect(groundLines({ lines: [{ name: 'b', refs: ['N1', 'N2', 'F1'] }] }, corpus)).toEqual([])
    expect(groundLines({ lines: [{ name: 'c', refs: ['P1', 'N2', 'F1'] }] }, corpus)).toEqual([])
  })
  it('reads junk as nothing', () => {
    expect(groundLines(null, corpus)).toEqual([])
    expect(groundLines({ lines: 'x' }, corpus)).toEqual([])
  })
})

describe('portraitInputHash', () => {
  it('is steady for the same notebook and changes with a new row or a correction', () => {
    const a = portraitInputHash('[N1] one\n[N2] two', '')
    expect(portraitInputHash('[N1] one\n[N2] two', '')).toBe(a)
    expect(portraitInputHash('[N1] one\n[N2] two\n[N3] three', '')).not.toBe(a)
    expect(portraitInputHash('[N1] one\n[N2] two', 'not true')).not.toBe(a)
  })
})
