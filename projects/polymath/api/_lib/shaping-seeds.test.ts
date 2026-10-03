import { describe, it, expect } from 'vitest'
import type { Corpus, CorpusRow } from './mull-corpus.js'
import { gateSeeded, seedPrompt, SAID_REF, type ChatTurn } from './shaping-seeds.js'

const row = (ref: string, over: Partial<CorpusRow>): CorpusRow => ({
  kind: 'memory', id: ref, ref, captureId: ref, projectId: null,
  title: '', text: '', meta: '3 March 2026', ...over,
})

const rows = [
  row('N1', { title: 'Woodwork course', text: 'Finished the woodwork course and I am keen to carve something from the willow stump in the garden.' }),
  row('N2', { title: 'Milestone', text: 'Oscar sat up independently today for the first time and he is nearly crawling.' }),
  row('N3', { title: 'Sleep', text: 'Quiet moments holding sleeping Oscar, thinking about his developing brain.' }),
]
const corpus: Corpus = {
  rows, byRef: new Map(rows.map(r => [r.ref, r])), projectIdByTitle: new Map(), text: '',
}

const history: ChatTurn[] = [
  { role: 'model', content: 'What do you want to make?' },
  { role: 'user', content: "A wooden toy for Oscar's first birthday" },
]

const good = {
  reply: 'He is nearly crawling. What does he reach for most?',
  uses: [{ ref: 'N2', quote: 'nearly crawling' }],
  offers: [
    {
      text: 'A push-along carved from the willow stump',
      evidence: [
        { ref: SAID_REF, quote: 'A wooden toy for Oscar' },
        { ref: 'N1', quote: 'carve something from the willow stump' },
      ],
    },
  ],
  readyToExtract: false,
}

describe('gateSeeded', () => {
  it('keeps an offer built from the chat and a real note', () => {
    const out = gateSeeded(good, corpus, history, 1)
    expect(out?.offers).toEqual(['A push-along carved from the willow stump'])
    expect(out?.readyToExtract).toBe(false)
  })

  it('drops an offer resting on one thing only', () => {
    const one = { ...good, offers: [{ text: 'A rattle ring', evidence: [{ ref: SAID_REF, quote: 'A wooden toy for Oscar' }] }] }
    expect(gateSeeded(one, corpus, history, 1)?.offers).toEqual([])
  })

  it('drops an offer whose quote is not in the note it cites', () => {
    const fake = {
      ...good,
      offers: [{
        text: 'A push-along carved from the willow stump',
        evidence: [{ ref: 'N1', quote: 'carve something from the willow stump' }, { ref: 'N2', quote: 'he loves ducks and bathtime' }],
      }],
    }
    // Only N1 resolves, and the chat isn't cited: one real thing.
    expect(gateSeeded(fake, corpus, history, 1)?.offers).toEqual([])
  })

  it('drops an offer that names something nobody said', () => {
    const invented = {
      ...good,
      offers: [{
        text: 'A push-along carved from the Birchwood plank',
        evidence: good.offers[0].evidence,
      }],
    }
    expect(gateSeeded(invented, corpus, history, 1)?.offers).toEqual([])
  })

  it('rejects the whole reply when it names something nobody said', () => {
    expect(gateSeeded({ ...good, reply: 'He loves ducks, says Rebecca. What does he reach for?' }, corpus, history, 1)).toBeNull()
  })

  it('does not repeat an offer made earlier', () => {
    const earlier: ChatTurn[] = [...history, { role: 'model', content: 'x', offers: ['A push-along carved from the willow stump'] }]
    expect(gateSeeded(good, corpus, earlier, 2)?.offers).toEqual([])
  })

  it('gives no offers once it is ready, or on the third turn', () => {
    expect(gateSeeded({ ...good, readyToExtract: true }, corpus, history, 1)?.offers).toEqual([])
    expect(gateSeeded(good, corpus, history, 3)?.readyToExtract).toBe(true)
  })

  it('rejects an empty or over-long reply', () => {
    expect(gateSeeded({ ...good, reply: '' }, corpus, history, 1)).toBeNull()
    expect(gateSeeded({ ...good, reply: 'word '.repeat(80) }, corpus, history, 1)).toBeNull()
  })

  it('reads a malformed response as nothing', () => {
    expect(gateSeeded(null, corpus, history, 1)).toBeNull()
    expect(gateSeeded({ reply: 'Fine.', offers: 'nope' }, corpus, history, 1)?.offers).toEqual([])
  })
})

describe('seedPrompt', () => {
  it('lists earlier offers so they are not repeated, and cites SAID', () => {
    const p = seedPrompt(corpus, [{ role: 'model', content: 'x', offers: ['A rattle ring'] }], 'none of these', 2, '')
    expect(p).toContain('A rattle ring')
    expect(p).toContain(SAID_REF)
    expect(p).toContain('turn number 2')
  })
})
