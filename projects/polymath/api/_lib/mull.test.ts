import { describe, it, expect } from 'vitest'
import {
  selectConnector,
  selectConnectors,
  sharesDomain,
  quoteIsReal,
  usesQuote,
  rejectionReason,
  rankPairs,
  PAIRS_TO_DRAFT,
  stakeIsHollow,
  stakeSplits,
  offersAChoice,
  unsupportedSpecifics,
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

  it('keeps a sound question whose quote field is sloppy', () => {
    // The model mis-reports what it used more often than it invents: a word
    // dropped, a tense changed. What matters is whether the QUESTION
    // carries the note's own words, and this one does.
    expect(rejectionReason({ ...good, quote: 'ten more summers with dad' })).toBeNull()
  })

  it('rejects a question with nothing of the note in it, however it is labelled', () => {
    expect(rejectionReason({
      ...good,
      text: 'What would the book be if you stopped rewriting chapter three?',
      quote: 'ten more proper conversations with dad',
      connectorText: 'A completely unrelated note about the bird feeder and the frost.',
    })).toMatch(/^nothing of the note survives into the question/)
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

  it('puts every distinct pair ahead of any repeat', () => {
    // Repeats are reserves: fine to attempt when the gates reject the
    // others, never the first thing tried. Distinctness of what actually
    // ships is enforced downstream, on the survivors.
    const ranked = rankPairs([
      pair({ subjectId: 'same', connectorId: 'c1', similarity: 0.9 }),
      pair({ subjectId: 'same', connectorId: 'c2', similarity: 0.8 }),
      pair({ subjectId: 'other', connectorId: 'c3', similarity: 0.5 }),
    ])
    expect(ranked.slice(0, 2).map(p => p.subjectId)).toEqual(['same', 'other'])
  })

  it('keeps repeats as reserve rather than dropping them', () => {
    // Dropping them is what made one gate rejection empty the whole run.
    const ranked = rankPairs([
      pair({ subjectId: 'a', connectorId: 'shared', similarity: 0.8 }),
      pair({ subjectId: 'b', connectorId: 'shared', similarity: 0.7 }),
    ])
    expect(ranked).toHaveLength(2)
  })

  it('stops at the limit even when more survive', () => {
    const ranked = rankPairs([
      pair({ subjectId: 'a', connectorId: 'c1' }),
      pair({ subjectId: 'b', connectorId: 'c2' }),
      pair({ subjectId: 'c', connectorId: 'c3' }),
      pair({ subjectId: 'd', connectorId: 'c4' }),
      pair({ subjectId: 'e', connectorId: 'c5' }),
    ])
    expect(ranked).toHaveLength(PAIRS_TO_DRAFT)
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

describe('selectConnectors preferring a project connector', () => {
  // Real vocabulary, deliberately -- BOOK-length subject text keeps
  // connectorCeiling at its full width (VOCAB_FULL_GUARD distinctive
  // words or more) so these tests aren't fighting the vocabulary guard
  // as well as the thing they're actually checking.
  const SUBJECT = 'Something I keep meaning to come back to and never have, a real reflection about work and family and the years going past'
  const noProjectFilter = { subjectText: SUBJECT, excludeIds: [], preferProject: true }
  const hasProjectFilter = { subjectText: SUBJECT, excludeIds: [], preferProject: false }

  it('takes a lower-scoring project over a higher-scoring memory, for a subject with no project of its own', () => {
    // The real question this answers: an unfiled thought with no project
    // attached is exactly the case where landing on a project is most
    // valuable, and the search already returns project rows alongside
    // memories for every subject -- nothing was choosing between them.
    const candidates: MullCandidate[] = [
      candidate({ kind: 'memory', id: 'm1', title: 'A different note', text: 'Nothing to do with any of that.', similarity: 0.7 }),
      candidate({ kind: 'project', id: 'p1', title: 'The deck stand', text: 'Oak offcuts, still not started.', similarity: 0.6 }),
      candidate({ kind: 'article', id: 'a1', title: 'An article', text: 'Something read once.', similarity: 0.65 }),
    ]
    const picked = selectConnectors(candidates, noProjectFilter)
    expect(picked[0].kind).toBe('project')
    expect(picked[0].id).toBe('p1')
  })

  it('falls back to the best non-project candidate when no project is in band', () => {
    const candidates: MullCandidate[] = [
      candidate({ kind: 'memory', id: 'm1', title: 'A different note', text: 'Nothing to do with any of that.', similarity: 0.7 }),
      candidate({ kind: 'article', id: 'a1', title: 'An article', text: 'Something read once.', similarity: 0.65 }),
    ]
    const picked = selectConnectors(candidates, noProjectFilter)
    expect(picked[0].kind).toBe('memory')
  })

  it('does not force a project connector onto a subject that already has one', () => {
    // A project subject's own blind spot should be answered by whatever
    // best fits the band -- manufacturing a project-to-project bridge here
    // is exactly what the joint -> pair composite mechanism exists to do
    // carefully instead of this channel doing it by accident.
    const candidates: MullCandidate[] = [
      candidate({ kind: 'memory', id: 'm1', title: 'A different note', text: 'Nothing to do with any of that.', similarity: 0.7 }),
      candidate({ kind: 'project', id: 'p2', title: 'The deck stand', text: 'Oak offcuts, still not started.', similarity: 0.6 }),
    ]
    const picked = selectConnectors(candidates, hasProjectFilter)
    expect(picked[0].kind).toBe('memory')
  })

  it('still respects the band and the domain guard for the preferred project', () => {
    const candidates: MullCandidate[] = [
      candidate({ kind: 'project', id: 'p1', title: 'Above ceiling', text: 'Scores too high to count as a real connection.', similarity: CONNECTOR_CEILING + 0.05 }),
      candidate({ kind: 'memory', id: 'm1', title: 'A different note', text: 'Nothing to do with any of that.', similarity: 0.6 }),
    ]
    const picked = selectConnectors(candidates, noProjectFilter)
    expect(picked[0].kind).toBe('memory')
  })
})

describe('selectConnectors requiring a project connector, no fallback', () => {
  const SUBJECT = 'Something I keep meaning to come back to and never have, a real reflection about work and family and the years going past'
  const requireFilter = { subjectText: SUBJECT, excludeIds: [], requireProject: true }

  it('takes a project even when other candidates score higher', () => {
    const candidates: MullCandidate[] = [
      candidate({ kind: 'memory', id: 'm1', title: 'A different note', text: 'Nothing to do with any of that.', similarity: 0.75 }),
      candidate({ kind: 'article', id: 'a1', title: 'An article', text: 'Something read once.', similarity: 0.7 }),
      candidate({ kind: 'project', id: 'p1', title: 'The deck stand', text: 'Oak offcuts, still not started.', similarity: 0.55 }),
    ]
    const picked = selectConnectors(candidates, requireFilter)
    expect(picked).toHaveLength(1)
    expect(picked[0].kind).toBe('project')
  })

  it('returns nothing at all when no project is in band -- correct silence, not a settled-for note', () => {
    const candidates: MullCandidate[] = [
      candidate({ kind: 'memory', id: 'm1', title: 'A different note', text: 'Nothing to do with any of that.', similarity: 0.75 }),
      candidate({ kind: 'article', id: 'a1', title: 'An article', text: 'Something read once.', similarity: 0.7 }),
    ]
    expect(selectConnectors(candidates, requireFilter)).toHaveLength(0)
  })

  it('a project outside the band still yields nothing, even with no other candidates at all', () => {
    const candidates: MullCandidate[] = [
      candidate({ kind: 'project', id: 'p1', title: 'Above ceiling', text: 'Scores too high to count as a real connection.', similarity: CONNECTOR_CEILING + 0.05 }),
    ]
    expect(selectConnectors(candidates, requireFilter)).toHaveLength(0)
  })
})

describe('ordinals are not inventions', () => {
  it('accepts "the 10th" when the fact says "10 January"', () => {
    // Live: two drafts in one run died on "3rd" and "10th" against a fact
    // reading "On 10 January 2026...". English writes dates as ordinals;
    // the computed facts write them as cardinals.
    expect(unsupportedSpecifics(
      'You put ten things on a list on the 10th. Which one goes first?',
      ['On 10 January 2026 they put 10 things on a list in one sitting.'],
    )).toEqual([])
  })

  it('still catches a day nothing supports', () => {
    expect(unsupportedSpecifics(
      'You put ten things on a list on the 23rd. Which one goes first?',
      ['On 10 January 2026 they put 10 things on a list in one sitting.'],
    )).toContain('23rd')
  })

  it('does not treat any number as an ordinal', () => {
    expect(unsupportedSpecifics('You wrote 198 of them.', ['They wrote 12 of them.'])).toContain('198')
  })
})

/**
 * The binary gate and the one exemption that lets a real either/or through.
 *
 * Neither had a test, which is how a live question shipped reading "Does
 * Aperture pull the raw thoughts straight from your notes, or wait until
 * they are finished?" — the exact shape `offersAChoice` exists to stop.
 * Both halves are here now: the questions the gate must catch, and the
 * stakes that earn a pass.
 */
describe('offersAChoice', () => {
  const binaries = [
    'Does Pupils trace how he grows up, or does it stay in the nursery?',
    'Does Tame impala synth sessions run on footwork, or does it stay on the synth?',
    'Does Aperture pull the raw thoughts straight from your notes, or wait until they are finished?',
    'Are you making t-shirts for friends, or are you just running the same January project twice?',
  ]
  for (const q of binaries) {
    it(`catches: ${q.slice(0, 44)}…`, () => expect(offersAChoice(q)).toBe(true))
  }

  // Both halves are required on purpose. A gate firing on either one throws
  // away good questions, which this channel has done before and pays for in
  // empty slots.
  const fine = [
    'What would it take to finish it, or to admit it is finished?',
    'Which name goes on the first tag?',
    'Does the knowledge base keep running while you are away?',
  ]
  for (const q of fine) {
    it(`lets through: ${q.slice(0, 44)}…`, () => expect(offersAChoice(q)).toBe(false))
  }
})

describe('stakeSplits', () => {
  // The channel's own teaching examples. Two of the three have a TWO-WORD
  // second side, which is why a four-words-a-side rule was the wrong test:
  // English drops the repeated subject in the second branch.
  const real = [
    'The shed gets racking or gets emptied.',
    'The plot gets planted this spring or handed back.',
    'He writes the last line this week, or admits he wanted the hours.',
  ]
  for (const s of real) it(`splits: ${s}`, () => expect(stakeSplits(s)).toBe(true))

  const decorative: [string, string][] = [
    ['He picks a direction.', 'no second branch at all'],
    ['He picks a direction, or he picks a direction.', 'the same outcome twice'],
    ['He decides, or he does not decide.', 'a restatement wearing a suffix'],
    ['Eight things come off the list.', 'one outcome, no or'],
    // "either way" used to pass this function unconditionally. It means
    // "regardless of which branch", which is the opposite of a split, and it
    // is what a model writes when both branches land in the same place.
    ['He learns something about the app either way.', 'either way is not a split'],
    ['He gets a deeper sense of their themes either way.', 'either way is not a split'],
  ]
  for (const [s, why] of decorative) {
    it(`does not split (${why}): ${s}`, () => expect(stakeSplits(s)).toBe(false))
  }
})
