import { describe, it, expect } from 'vitest'
import {
  selectConnector,
  sharesDomain,
  quoteIsReal,
  usesQuote,
  rejectionReason,
  rankPairs,
  stakeIsHollow,
  CONNECTOR_FLOOR,
  CONNECTOR_CEILING,
  connectorCeiling,
  type MullCandidate,
} from './mull.js'

const candidate = (over: Partial<MullCandidate> = {}): MullCandidate => ({
  kind: 'memory',
  id: 'm1',
  title: 'Dad and the garden',
  text: 'Ten more proper conversations with dad, probably, and we spend them on the greenhouse.',
  similarity: 0.6,
  ...over,
})

const BOOK = 'A novel where characters are swapped out partway through the chapters'

describe('sharesDomain', () => {
  it('flags two things written in the same vocabulary', () => {
    expect(sharesDomain(BOOK, 'Chapter nine needs the swapped characters to land')).toBe(true)
  })

  it('lets a genuinely different subject through', () => {
    expect(sharesDomain(BOOK, candidate().text)).toBe(false)
  })

  it('one shared word is a coincidence, not a domain', () => {
    expect(sharesDomain(BOOK, 'The chapters of my life')).toBe(false)
  })
})

describe('selectConnector', () => {
  const filter = { subjectText: BOOK, excludeIds: ['subject'] }

  it('takes the best match inside the band', () => {
    const picked = selectConnector([
      candidate({ id: 'a', similarity: 0.5 }),
      candidate({ id: 'b', similarity: 0.7 }),
    ], filter)
    expect(picked?.id).toBe('b')
  })

  it('drops a near-duplicate above the ceiling — that is the note restated', () => {
    const picked = selectConnector([candidate({ similarity: CONNECTOR_CEILING + 0.05 })], filter)
    expect(picked).toBeNull()
  })

  it('drops noise below the floor', () => {
    const picked = selectConnector([candidate({ similarity: CONNECTOR_FLOOR - 0.05 })], filter)
    expect(picked).toBeNull()
  })

  it('drops anything written in the subject own words, however well it scores', () => {
    const picked = selectConnector([
      candidate({ id: 'same', text: 'The swapped characters in later chapters', similarity: 0.8 }),
    ], filter)
    expect(picked).toBeNull()
  })

  it('never returns the subject itself', () => {
    expect(selectConnector([candidate({ id: 'subject' })], filter)).toBeNull()
  })

  it('ignores an item with no text to quote', () => {
    expect(selectConnector([candidate({ text: '   ' })], filter)).toBeNull()
  })
})

describe('quoteIsReal', () => {
  const source = 'Ten more proper conversations with dad — probably — and we spend them on the greenhouse.'

  it('accepts a quote that is really there', () => {
    expect(quoteIsReal('ten more proper conversations with dad', source)).toBe(true)
  })

  it('survives retyped punctuation', () => {
    expect(quoteIsReal('conversations with dad – probably', source)).toBe(true)
  })

  it('rejects an invented quote', () => {
    expect(quoteIsReal('ten more summers with dad', source)).toBe(false)
  })

  it('rejects a quote too short to mean anything', () => {
    expect(quoteIsReal('dad', source)).toBe(false)
  })
})

describe('usesQuote', () => {
  it('true when the question actually reaches for the words', () => {
    expect(usesQuote('You said the greenhouse takes the last conversations. What are the chapters for?', 'the greenhouse')).toBe(true)
  })

  it('false when the note was appended rather than used', () => {
    expect(usesQuote('What should happen in chapter nine?', 'the greenhouse')).toBe(false)
  })
})

describe('rejectionReason', () => {
  const good = {
    text: 'You wrote that you have ten more proper conversations with dad and you spend them on the greenhouse. The book swaps Lena out in chapter nine and nobody notices. What are those chapters for?',
    quote: 'ten more proper conversations with dad',
    stake: 'If the answer is nothing, chapters nine to twelve come out.',
    connectorText: 'Ten more proper conversations with dad, and we spend them on the greenhouse.',
  }

  it('passes a grounded, plain, unexplained collision', () => {
    expect(rejectionReason(good)).toBeNull()
  })

  it('rejects a statement with no question in it', () => {
    expect(rejectionReason({ ...good, text: good.text.replace('What are those chapters for?', 'Those chapters matter.') }))
      .toBe('not a question')
  })

  it('rejects an invented quote', () => {
    expect(rejectionReason({ ...good, quote: 'ten more summers with dad' })).toBe('quote is not in the note')
  })

  it('rejects a draft that explains its own link', () => {
    const text = 'You have ten more proper conversations with dad. Which mirrors the book swapping Lena out. What are those chapters for?'
    expect(rejectionReason({ ...good, text })).toMatch(/explains the link/)
  })

  it('rejects an essay', () => {
    const text = `${good.quote} ${'padding word '.repeat(70)}?`
    expect(rejectionReason({ ...good, text })).toBe('too long to carry around')
  })

  it('rejects a question nothing turns on', () => {
    expect(rejectionReason({ ...good, stake: 'It would give them a deeper sense of their themes.' }))
      .toMatch(/nothing changes either way/)
  })

  it('rejects consultant voice', () => {
    const text = 'Your ten more proper conversations with dad unlock a transformative question. What are those chapters for?'
    expect(rejectionReason({ ...good, text })).toMatch(/banned word/)
  })
})

describe('rankPairs', () => {
  const pair = (over: any) => ({
    subjectId: 's1', connectorId: 'c1', similarity: 0.6, subjectStrength: 0.6, ...over,
  })

  it('takes the best answers to the blind spot first', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'a', connectorId: 'ca', similarity: 0.5 }),
      pair({ subjectId: 'b', connectorId: 'cb', similarity: 0.75 }),
    ])
    expect(ranked.map(p => p.subjectId)).toEqual(['b', 'a'])
  })

  it('a thing said since 2023 outranks a saved article answered just as well', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'article', connectorId: 'c1', subjectStrength: 0.4 }),
      pair({ subjectId: 'since-2023', connectorId: 'c2', subjectStrength: 1.4 }),
    ], 1)
    expect(ranked[0].subjectId).toBe('since-2023')
  })

  it('but a strong subject cannot rescue a connector that barely answers it', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'strong', connectorId: 'c1', subjectStrength: 1.0, similarity: 0.46 }),
      pair({ subjectId: 'ordinary', connectorId: 'c2', subjectStrength: 0.4, similarity: 0.80 }),
    ], 1)
    expect(ranked[0].subjectId).toBe('ordinary')
  })

  it('never banks a second question about the same subject', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'same', connectorId: 'c1', similarity: 0.8 }),
      pair({ subjectId: 'same', connectorId: 'c2', similarity: 0.7 }),
    ])
    expect(ranked).toHaveLength(1)
  })

  it('never builds both questions on the same note', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'a', connectorId: 'shared', similarity: 0.8 }),
      pair({ subjectId: 'b', connectorId: 'shared', similarity: 0.7 }),
    ])
    expect(ranked).toHaveLength(1)
  })

  it('stops at the limit even when more survive', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'a', connectorId: 'c1' }),
      pair({ subjectId: 'b', connectorId: 'c2' }),
      pair({ subjectId: 'c', connectorId: 'c3' }),
    ])
    expect(ranked).toHaveLength(2)
  })
})

describe('stakeIsHollow', () => {
  it('accepts a stake that names something they would do', () => {
    expect(stakeIsHollow('If the answer is nothing, chapters nine to twelve come out.')).toBe(false)
    expect(stakeIsHollow('They stop buying the third synth and finish the one mix.')).toBe(false)
  })

  it('rejects the ways of saying there is no stake', () => {
    expect(stakeIsHollow('It deepens their understanding of the work.')).toBe(true)
    expect(stakeIsHollow('They might reconsider how the book is structured.')).toBe(true)
    expect(stakeIsHollow('Changes how they think about the project.')).toBe(true)
    expect(stakeIsHollow('Nothing concrete.')).toBe(true)
  })

  it('rejects a stake too short to be one', () => {
    expect(stakeIsHollow('Clarity.')).toBe(true)
  })
})

describe('the ceiling scales with how much vocabulary the subject has', () => {
  // The two guards are meant to work together. A short, plain, idiomatic
  // subject supplies no vocabulary for the domain rule, so the vector has
  // to carry both jobs — which means a tighter ceiling, or the note that
  // IS the subject restated walks straight in.
  const shortJoint = "it only works if it is one take. the first pass was always the good one"
  const longProject = [
    'A novel where characters get swapped out partway through',
    'chapter nine needs to feel like arriving somewhere',
    'rewrote chapter three again, four passes now',
    'the swap has to happen before the reader trusts her',
    'cut the flashback, it explains too much',
  ].join(' ')

  const restatement = 'Kept the first take of the whole side even though the drop is late. Every version I tightened afterwards was worse.'

  it('tightens when the subject has almost no distinctive words', () => {
    expect(connectorCeiling(shortJoint)).toBeLessThan(CONNECTOR_CEILING)
    expect(connectorCeiling(shortJoint)).toBeGreaterThan(CONNECTOR_FLOOR)
  })

  it('stays loose when the vocabulary rule can do its own job', () => {
    expect(connectorCeiling(longProject)).toBe(CONNECTOR_CEILING)
  })

  it('blocks the subject-restated-in-other-words that sharesDomain cannot see', () => {
    // sharesDomain is blind here: every word of the joint is a stopword.
    expect(sharesDomain(shortJoint, restatement)).toBe(false)
    // The ceiling catches it anyway.
    const picked = selectConnector(
      [candidate({ id: 'restated', text: restatement, similarity: 0.75 })],
      { subjectText: shortJoint, excludeIds: [] },
    )
    expect(picked).toBeNull()
  })

  it('still lets a genuine connector through for the same subject', () => {
    const picked = selectConnector(
      [candidate({ id: 'real', similarity: 0.58 })],
      { subjectText: shortJoint, excludeIds: [] },
    )
    expect(picked?.id).toBe('real')
  })
})
