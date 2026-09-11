import { describe, it, expect } from 'vitest'
import {
  selectConnector,
  sharesDomain,
  quoteIsReal,
  usesQuote,
  rejectionReason,
  pickSubjectKind,
  CONNECTOR_FLOOR,
  CONNECTOR_CEILING,
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

  it('rejects consultant voice', () => {
    const text = 'Your ten more proper conversations with dad unlock a transformative question. What are those chapters for?'
    expect(rejectionReason({ ...good, text })).toMatch(/banned word/)
  })
})

describe('pickSubjectKind', () => {
  it('returns nothing when the corpus offers nothing', () => {
    expect(pickSubjectKind([])).toBeNull()
  })

  it('always picks the only kind available', () => {
    expect(pickSubjectKind(['article'], 0)).toBe('article')
    expect(pickSubjectKind(['article'], 0.99)).toBe('article')
  })

  it('leans towards projects but reaches notes and articles too', () => {
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => pickSubjectKind(['project', 'memory', 'article'], i / 20)),
    )
    expect(seen).toEqual(new Set(['project', 'memory', 'article']))
  })
})
