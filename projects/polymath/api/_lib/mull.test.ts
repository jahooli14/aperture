import { describe, it, expect } from 'vitest'
import {
  quoteIsReal, resolveEvidence, specifics, unsupportedSpecifics, ordinalSupported,
  offersAChoice, isClosed, checkCandidate, judgeShips, judgeRank, parseJudgeScores, readsAnInnerState,
  type Candidate, type JudgeScore,
} from './mull.js'
import type { Corpus, CorpusRow } from './mull-corpus.js'

const row = (ref: string, text: string, extra: Partial<CorpusRow> = {}): CorpusRow =>
  ({ kind: 'memory', id: ref.toLowerCase(), captureId: ref.toLowerCase(), ref, projectId: null, title: '', text, meta: '', ...extra })

const ROWS = [
  row('N1', 'Ten more proper conversations with dad, probably, and we spend them on the greenhouse.', { meta: '14 March 2025' }),
  row('N2', "It only works if it's one take. The second take is always worse.", { meta: '2 June 2025' }),
  row('P1', 'A novel where characters get swapped out partway through', { kind: 'project', title: 'The book', meta: 'active, started 10 January 2024' }),
]
const CORPUS: Corpus = { rows: ROWS, byRef: new Map(ROWS.map(r => [r.ref, r])), projectIdByTitle: new Map(), text: '' }

const candidate = (question: string, evidence = [
  { ref: 'N2', quote: "it only works if it's one take" },
  { ref: 'P1', quote: 'characters get swapped out partway through' },
]): Candidate => ({ question, evidence, noticing: '', stake: '', project: null })

describe('quoteIsReal', () => {
  it('matches across retyped punctuation, case and person', () => {
    expect(quoteIsReal('It only works if it is one take', ROWS[1].text)).toBe(true)
    expect(quoteIsReal('ten more proper conversations with your dad', ROWS[0].text)).toBe(true)
  })
  it('refuses words that are not there, and anything too short to mean anything', () => {
    expect(quoteIsReal('the third take is always worse', ROWS[1].text)).toBe(false)
    expect(quoteIsReal('dad', ROWS[0].text)).toBe(false)
  })
})

describe('resolveEvidence', () => {
  it('resolves a real quote to its cited row', () => {
    expect(resolveEvidence([{ ref: 'N1', quote: 'spend them on the greenhouse' }], CORPUS).rows.map(r => r.ref)).toEqual(['N1'])
  })
  it('finds the right row when the ref is wrong but the quote is real', () => {
    expect(resolveEvidence([{ ref: 'P1', quote: 'spend them on the greenhouse' }], CORPUS).rows.map(r => r.ref)).toEqual(['N1'])
  })
  it('reports a quote found nowhere, and counts one row once', () => {
    const r = resolveEvidence([
      { ref: 'N1', quote: 'spend them on the greenhouse' },
      { ref: 'N1', quote: 'ten more proper conversations' },
      { ref: 'N2', quote: 'nobody said this sentence ever' },
    ], CORPUS)
    expect(r.rows).toHaveLength(1)
    expect(r.bad).toHaveLength(1)
  })
})

describe('specifics', () => {
  it('picks out numbers and mid-sentence names, not sentence openers', () => {
    expect(specifics('Since March 2023 you rewrote Lena twice. What changed?')).toEqual(['march', '2023', 'lena'])
  })
  it('an ordinal is supported by the bare number', () => {
    expect(ordinalSupported('10th', 'on 10 january')).toBe(true)
    expect(ordinalSupported('11th', 'on 10 january')).toBe(false)
  })
  it('flags what no evidence row contains', () => {
    expect(unsupportedSpecifics('In March you said one take. What would Abbey Road say?', ['14 March 2025 one take'])).toEqual(['abbey', 'road'])
  })
})

describe('question shape', () => {
  it('a yes/no question is closed; an open one is not', () => {
    expect(isClosed('You said one take. Should the book be one take too?')).toBe(true)
    expect(isClosed('You said one take. What would the book look like in one take?')).toBe(false)
  })
  it('offersAChoice needs the opener and the alternative', () => {
    expect(offersAChoice('Does it stay, or does it go?')).toBe(true)
    expect(offersAChoice('What would it take to finish it, or to admit it is finished?')).toBe(false)
  })
})

describe('checkCandidate', () => {
  it('passes an honest two-row open question', () => {
    const r = checkCandidate(candidate("You said it only works if it's one take. The book swaps its characters out partway through. What would one take look like for the book?"), CORPUS)
    expect(r.ok).toBe(true)
  })
  it('counts dates and titles from the rows it cites as evidence', () => {
    const r = checkCandidate(candidate("In June you said it only works if it's one take. The book has been going since January 2024. What would one take look like for it?"), CORPUS)
    expect(r.ok).toBe(true)
  })
  it('refuses a date that is only in a row it does NOT cite', () => {
    const r = checkCandidate(candidate("In March you said it only works if it's one take. What would one take look like for the book?"), CORPUS)
    expect(r.ok).toBe(false)
  })
  it('refuses one row of evidence', () => {
    const r = checkCandidate(candidate('What would one take look like for the book?', [{ ref: 'N2', quote: "it only works if it's one take" }]), CORPUS)
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/needs 2 real rows/) })
  })
  it('refuses the model explaining its own pattern', () => {
    const r = checkCandidate(candidate("You said one take, which mirrors how the book swaps characters. What would that look like?"), CORPUS)
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/explains the pattern/) })
  })
  it('passes a take: facts, then one committed claim, no question mark', () => {
    const r = checkCandidate(candidate("You said it only works if it's one take. The book swaps its characters out partway through. I think the book is not one take."), CORPUS)
    expect(r.ok).toBe(true)
  })
  it('refuses a take that hedges its claim', () => {
    const r = checkCandidate(candidate("You said it only works if it's one take. The book swaps its characters out partway through. Maybe the book could be one take."), CORPUS)
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/hedges/) })
  })
  it('does not blame a hedge that is only in their own quoted words', () => {
    const r = checkCandidate(candidate("You said it only works if it's one take, maybe. The book swaps its characters out partway through. I think the book is not one take."), CORPUS)
    expect(r.ok).toBe(true)
  })
  it('refuses a take that reads a feeling off the evidence, even when loose', () => {
    const t = "You said it only works if it's one take. The book swaps its characters out partway through. I think you're afraid of one take."
    expect(checkCandidate(candidate(t), CORPUS).ok).toBe(false)
    expect(checkCandidate(candidate(t), CORPUS, true).ok).toBe(false)
  })
  it('refuses "but secretly" -- the app cannot see what they secretly want', () => {
    const t = "You said it only works if it's one take. The book swaps its characters out partway through. I think you preach one take but secretly want a labyrinth."
    expect(checkCandidate(candidate(t), CORPUS).ok).toBe(false)
  })
  it('refuses a take that says what they value -- the live overreach', () => {
    const t = "You said it only works if it's one take. The book swaps its characters out partway through. I think you value starting things far more than finishing them."
    expect(checkCandidate(candidate(t), CORPUS)).toMatchObject({ ok: false, reason: expect.stringMatching(/feel or value/) })
    expect(checkCandidate(candidate(t), CORPUS, true).ok).toBe(false)
  })
  it('refuses "let yourself" -- permission is a motive', () => {
    const t = "You said it only works if it's one take. The book swaps its characters out partway through. I think you only let yourself do one take."
    expect(checkCandidate(candidate(t), CORPUS).ok).toBe(false)
  })
  it('refuses opening on a plan, as the live "For Going Analogue, you planned..." did', () => {
    const t = "For the book, you planned to swap characters out partway through. You said it only works if it's one take. I think the book is not one take."
    expect(checkCandidate(candidate(t), CORPUS)).toMatchObject({ ok: false, reason: 'opens by reciting a plan' })
  })
  it('refuses "probably" in the claim, and a claim long enough to be a theory', () => {
    const base = "You said it only works if it's one take. The book swaps its characters out partway through. "
    expect(checkCandidate(candidate(`${base}I think the book is probably not one take.`), CORPUS).ok).toBe(false)
    const long = `${base}I think the book is the one place where you keep going back and changing what you already did before anyone reads it.`
    expect(checkCandidate(candidate(long), CORPUS)).toMatchObject({ ok: false, reason: expect.stringMatching(/theory/) })
  })
  it('loose skips the shape gates but never the honesty ones', () => {
    expect(checkCandidate(candidate('You said one take. Should the book be one take?'), CORPUS, true).ok).toBe(true)
    expect(checkCandidate(candidate('You said one take at Abbey Road. Should the book be one take?'), CORPUS, true).ok).toBe(false)
  })
})

describe('the judge', () => {
  const s = (o: Partial<JudgeScore>): JudgeScore =>
    ({ n: 1, revelation: 8, truth: 8, specific: 8, answerable: 8, verdict: 'ship', reason: '', ...o })

  it('ships only on its own verdict, a true pattern and a real revelation', () => {
    expect(judgeShips(s({}))).toBe(true)
    expect(judgeShips(s({ verdict: 'kill' }))).toBe(false)
    expect(judgeShips(s({ truth: 6 }))).toBe(false)
    expect(judgeShips(s({ revelation: 6 }))).toBe(false)
  })
  it('the loose bar drops taste, never truth', () => {
    expect(judgeShips(s({ verdict: 'kill', revelation: 3 }), true)).toBe(true)
    expect(judgeShips(s({ truth: 5 }), true)).toBe(false)
  })
  it('never ships an overreaching take, however sharp', () => {
    expect(judgeShips(s({ overreach: true }))).toBe(false)
    expect(judgeShips(s({ overreach: true }), true)).toBe(false)
    expect(parseJudgeScores({ scores: [{ n: 1, revelation: 8, truth: 8, specific: 8, answerable: 8, overreach: true, verdict: 'ship' }] }, 1).get(1)?.overreach).toBe(true)
  })
  it('revelation outweighs everything else', () => {
    expect(judgeRank(s({ revelation: 10, specific: 6 }))).toBeGreaterThan(judgeRank(s({ revelation: 8, specific: 9 })))
  })
  it('refuses malformed scores rather than inventing them', () => {
    const scores = parseJudgeScores({ scores: [
      { n: 1, revelation: 8, truth: 8, specific: 8, answerable: 8, verdict: 'ship', reason: 'ok' },
      { n: 2, revelation: 11, truth: 8, specific: 8, answerable: 8, verdict: 'ship' },
      { n: 3, revelation: 8, truth: 8, specific: 8, verdict: 'ship' },
      { n: 9, revelation: 8, truth: 8, specific: 8, answerable: 8, verdict: 'ship' },
    ] }, 3)
    expect([...scores.keys()]).toEqual([1])
  })
})

describe('readsAnInnerState', () => {
  it('lets a want through when it is their own word', () => {
    expect(readsAnInnerState('I think you want a table you never have to clear.', ['I want the tools out all the time'])).toBeNull()
    expect(readsAnInnerState("I think you'd rather keep it.", ["I'd rather not show anyone"])).toBeNull()
  })
  it('names one that is not', () => {
    expect(readsAnInnerState('I think you want an audience.', ['four songs demoed, never sent'])).toBe('you want')
    expect(readsAnInnerState("I think you don't care about the ending.", ['wrote the ending twice'])).toBe('you care about')
  })
  it('leaves behaviour alone', () => {
    expect(readsAnInnerState('I think your projects stop the moment someone could see them.', [])).toBeNull()
  })
})
