import { describe, it, expect } from 'vitest'
import {
  quoteIsReal,
  usesQuote,
  rejectionReason,
  stakeIsHollow,
  stakeSplits,
  offersAChoice,
  unsupportedSpecifics,
} from './mull.js'

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

  describe('loose (the "get more creative" reroll tier)', () => {
    it('still rejects a question ungrounded in the note — loose changes taste, not honesty', () => {
      expect(rejectionReason({
        ...good,
        loose: true,
        text: 'What would the book be if you stopped rewriting chapter three?',
        connectorText: 'A completely unrelated note about the bird feeder and the frost.',
      })).toMatch(/^nothing of the note survives into the question/)
    })

    it('lets an explained link through', () => {
      const text = 'You have ten more proper conversations with dad. Which mirrors the book swapping Lena out. What are those chapters for?'
      expect(rejectionReason({ ...good, loose: true, text })).toBeNull()
    })

    it('lets a decorative binary through', () => {
      const text = 'Do you have ten more proper conversations with dad, or does the greenhouse take them instead?'
      expect(rejectionReason({ ...good, loose: true, text, stake: 'Nothing changes either way.' })).toBeNull()
    })

    it('lets a hollow stake through', () => {
      expect(rejectionReason({ ...good, loose: true, stake: 'It would give them a deeper sense of their themes.' }))
        .toBeNull()
    })
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
