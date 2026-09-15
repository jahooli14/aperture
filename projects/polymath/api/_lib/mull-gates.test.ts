/**
 * Does the gate layer actually work?
 *
 * Everything else about this channel was argued into place and never
 * measured. That's how it ended up rejecting three out of five perfectly
 * good questions for mechanical reasons — a quote gate that failed on
 * "your dad" when the note said "dad", and a lens gate that couldn't pass
 * "it only works if it's one take" because every word in it is filler.
 * Both were invisible to reasoning and obvious after one run.
 *
 * So this file is the harness, not a unit test. Two corpora of whole
 * questions — ones the channel should ship and ones it should refuse — run
 * through the real gates. The numbers at the bottom are the point: a
 * false-reject rate creeping up means the gates have been tightened past
 * what a real model produces, which fails silently as an empty slot rather
 * than loudly as a bad question.
 *
 * The GOOD set deliberately includes questions written the way Flash-Lite
 * actually writes — wordier, a bit hedged, quoting loosely — and not only
 * the polished ones. A set written by whoever wrote the gates will always
 * pass the gates.
 */

import { describe, it, expect } from 'vitest'
import {
  rejectionReason, usesQuote, quoteIsReal,
  questionSentence, noteReachesQuestion, draftQuality,
} from './mull.js'
import { findVoiceViolations } from './plain-english.js'

const NOTE = `Ten more proper conversations with dad, probably, and we spend them on the greenhouse.
Cut the mitres at 5am before anyone was up. The trial expired on Friday and I never opened it again.
I keep buying records I don't play. The tidy room in a messy house. It only works if it's one take.`

/** The subject the questions below were written from. A good question
 *  names the project, and the project is not in the note. */
const SUBJECT = `Something they keep saying: "it only works if it is one take". Said since March 2023, never made a project. The book — a novel where characters get swapped out partway through; chapter nine; Lena.`

const candidate = (text: string, quote: string, stake: string) =>
  ({ text, quote, stake, connectorText: NOTE, subjectText: SUBJECT })

const SHOULD_SHIP = [
  candidate(
    "You wrote that you've got maybe ten more proper conversations with dad and you're spending them on the greenhouse. The book swaps Lena out in chapter nine and nobody notices. What are those chapters for?",
    'ten more proper conversations with dad', 'Chapters nine to twelve come out.'),
  candidate(
    "You said the mitres got cut at 5am before anyone was up. Every mix you've finished was done the same way. What are you protecting by working then?",
    'cut the mitres at 5am before anyone was up', 'He stops booking evening studio time.'),
  candidate(
    "Since March 2023 you've said it only works if it's one take. The book chapters have been rewritten four times each. Which one is lying?",
    "it only works if it's one take", 'He ships the next chapter as a first draft.'),
  candidate(
    "You keep buying records you don't play. What would have to be true for you to play them?",
    "I keep buying records I don't play", 'He stops buying and starts a listening night.'),
  // Addresses the user as "you" while the note says "I"/"dad" — the prompt
  // asks for exactly this, and it used to be the commonest false reject.
  candidate(
    "Ten more proper conversations with your dad, you said. How many more records do you think you'll make?",
    'ten more proper conversations with your dad', 'He counts the remaining mixes and plans them.'),
  // A short idiomatic quote with no distinctive word in it at all.
  candidate(
    "Your note about one take sits oddly next to the four rewrites. What would it cost to find out which is true?",
    'one take', 'He runs the next chapter as a single pass.'),
  // "or" is not itself the problem -- this asks ONE thing, twice over, and
  // the alternative is not two options the question handed them.
  candidate(
    "You keep buying records you don't play. What would it take to play them, or to admit you collect rather than listen?",
    "I keep buying records I don't play", 'He starts a listening night.'),
  // Opens with "Does" but offers no alternative, so it is a real question.
  candidate(
    "You said it only works if it's one take. Does the fourth rewrite still count as the same chapter?",
    "it only works if it's one take", 'He ships the next chapter as a first draft.'),
  // Wordier and a bit hedged, the way a small model actually writes.
  candidate(
    "In your notes you said it only works if it is one take. The chapters, though, keep getting rewritten. Which one is the real rule?",
    'it only works if it is one take', 'He drafts the next chapter once and ships it.'),
]

const SHOULD_REFUSE = [
  ["explains its own link", candidate(
    "Your love of raw textures connects to your reading about impermanence, which mirrors the way you approach the deck build. What might that unlock?",
    'The tidy room in a messy house', 'A deeper sense of his themes.')],
  ["names a resemblance and stops", candidate(
    "Both are about memory and loss. Interesting how they sit together.",
    'Ten more proper conversations with dad', 'He reflects on the connection.')],
  ["tells the user what they feel", candidate(
    "You are avoiding the hard part of the book, aren't you?",
    'The tidy room in a messy house', 'He confronts the avoidance.')],
  ["can't be wrong, so it's inert", candidate(
    "What is your work really about?", 'the mitres', 'Clarity.')],
  ["consultant voice, no consequence", candidate(
    "You wrote about your father's mortality and the transformative potential of constraint. What does that reveal?",
    'Ten more proper conversations with dad', 'He would have clearer insight into his practice.')],
  ["an observation, not a question", candidate(
    "The greenhouse is a metaphor for the book.",
    'Ten more proper conversations with dad', 'He sees the metaphor.')],
  ["invents a specific nothing supports", candidate(
    "You kept a school book from the 1950s/60s while working on the book. You wrote that it only works if it is one take. Which page from the French school book goes in chapter nine?",
    'it only works if it is one take', 'He picks the page and drafts the chapter.')],
  // Both shipped live from a healthy corpus, quote landing correctly, and
  // both are answerable in five seconds by picking a side. The prompt had
  // banned this from the start -- as a phrasing, which the model simply
  // did not use.
  ["hands them a choice it invented", candidate(
    "You noted that DJ Elmoe's footwork completely blew us away. Does Tame impala synth sessions run on footwork, or does it stay on the synth?",
    "DJ Elmoe's footwork completely blew us away", 'He picks a direction for the next track.')],
  ["a choice in the other common phrasing", candidate(
    "You said it only works if it's one take. Is the book about the takes, or is it about the rewrites?",
    "it only works if it's one take", 'He drafts the next chapter once.')],
  ["invents the quote", candidate(
    "You said you had ten more summers with your dad. What are the chapters for?",
    'ten more summers with your dad', 'Chapters nine to twelve come out.')],
] as const

describe('the gate layer, end to end', () => {
  it('ships every question that deserves to ship', () => {
    const rejected = SHOULD_SHIP
      .map(c => ({ reason: rejectionReason(c), text: c.text }))
      .filter(r => r.reason)
    expect(rejected.map(r => `${r.reason} — ${r.text.slice(0, 50)}`)).toEqual([])
  })

  for (const [why, c] of SHOULD_REFUSE) {
    it(`refuses one that ${why}`, () => {
      expect(rejectionReason(c)).not.toBeNull()
    })
  }
})

describe('the two bugs the harness found', () => {
  it('a quote survives being addressed to the user', () => {
    // The prompt says talk to them directly; the corpus is in first person.
    expect(quoteIsReal('ten more proper conversations with your dad', NOTE)).toBe(true)
    expect(usesQuote('Ten more proper conversations with your dad, you said.', 'ten more proper conversations with dad')).toBe(true)
  })

  it('still refuses a quote that was never said', () => {
    expect(quoteIsReal('ten more summers with your dad', NOTE)).toBe(false)
  })

  it('a short quote with no distinctive word still counts as used', () => {
    // Every word in this is a stopword. It is also the best line in the note.
    expect(usesQuote('Your note about one take sits oddly next to the rewrites.', 'one take')).toBe(true)
    expect(usesQuote('What should happen in chapter nine?', 'one take')).toBe(false)
  })

  it('catches mind-reading with or without the apostrophe', () => {
    for (const form of [
      'Are you avoiding the hard part?',
      "You're avoiding the hard part.",
      'You are avoiding the hard part.',
      'He is avoiding the hard part.',
    ]) {
      expect(findVoiceViolations(form).length).toBeGreaterThan(0)
    }
  })
})

describe('the manufactured contrast', () => {
  const connector = 'A memory needs to be trapped in a physical object right after it happens or it goes.'

  it('rejects "you said A, but you are also doing B"', () => {
    // From a real bake. The "but" asserts a contradiction that is not there
    // -- designing the t-shirts IS trapping the memory in an object -- and
    // the question then walks away from both halves into something that
    // would fit any subject at all.
    const text =
      'You wrote that a memory needs to be trapped in a physical object right after it happens, but you are also spending hours designing t-shirts for four friends. When does the moment become real?'
    expect(rejectionReason({
      text, quote: 'trapped in a physical object', stake: 'They print the coasters this month.',
      connectorText: connector,
    })).toMatch(/explains the link/)
  })

  it('keeps two things set side by side without the gotcha', () => {
    const text =
      'You wrote that a memory needs to be trapped in a physical object right after it happens. The coasters from that night have sat unprinted since. What goes on them?'
    expect(rejectionReason({
      text, quote: 'trapped in a physical object', stake: 'They print a run of coasters this month.',
      connectorText: connector,
    })).toBeNull()
  })

  it('leaves a real contrast alone when it is not announced', () => {
    const text =
      'You wrote that you get maybe ten more proper conversations with dad, and you spend them on the greenhouse. You have said since 2023 that it only works if it is one take. What are you doing twice?'
    expect(rejectionReason({
      text, quote: 'ten more proper conversations with dad', stake: 'He leaves chapter nine alone and ships it.',
      connectorText: 'I get maybe ten more proper conversations with dad and we spend them on the greenhouse.',
    })).toBeNull()
  })
})


describe('the question the user actually got, and rejected', () => {
  // Shipped to production and immediately called out: "I don't see how the
  // Esqui nor painting wood are relevant". Three fragments of one project
  // collided against each other, the connector absent, the user's own work
  // paraphrased into a put-down.
  const text =
    'You wanted to map all 198 countries to a memory palace continent by continent. Yet you left your painted coasters sitting in silence for eleven months after writing down the Esqui ice saga. Are you mapping the world to remember it, or are you just painting wood so you do not forget?'

  it('is rejected for the pivot', () => {
    expect(rejectionReason({
      text,
      quote: 'map all 198 countries to a memory palace',
      stake: 'He picks one continent and paints it.',
      connectorText: 'I want to map all 198 countries to a memory palace, continent by continent.',
    })).toMatch(/explains the link/)
  })

  it('the ban is on the move, not on one connective', () => {
    for (const pivot of ['Yet you', 'But you', 'Though you', 'Whereas you']) {
      expect(rejectionReason({
        text: `You said the coasters were the whole point. ${pivot} have not touched them since March. What are they for?`,
        quote: 'the coasters were the whole point',
        stake: 'He paints one this week.',
        connectorText: 'The coasters were the whole point of that night.',
      })).toMatch(/explains the link/)
    }
  })

  it('leaves "but" alone when it is not a pivot onto the user', () => {
    expect(rejectionReason({
      text: 'You wrote that your uncle remembers the boat but not the year he sold it. The letters are filed by date. Which one would you read first?',
      quote: 'remembers the boat but not the year he sold it',
      stake: 'Letter eleven opens the folder.',
      connectorText: 'He remembers the boat but not the year he sold it.',
    })).toBeNull()
  })
})

describe('ranking the questions that clear the gates', () => {
  // Two real drafts from the same corpus, minutes apart. Both quote the
  // user, both clear every gate, and one is plainly better.
  const NOTE_OIL = 'I keep thinking ideas are worth more than oil now, that the scarce thing is not the material'
  const GOOD = 'You wrote that ideas are worth more than oil, eight months before picking up A single note on paper again. If the idea is worth more than oil, why does it have to fit on a physical piece of paper?'

  const NOTE_AUDIO = 'Can you hear this latest one? I think the low end is muddy and the vocal sits too far back in the mix'
  const WEAK = 'You asked "Can you hear this latest one?" while working on audio quality, then left your project "Vivid dreams book idea" sitting quiet for six months. Does the dream sound loud or quiet when you wake up?'

  it('separates the setup from the sentence that actually asks', () => {
    expect(questionSentence(GOOD)).toBe('If the idea is worth more than oil, why does it have to fit on a physical piece of paper?')
    expect(questionSentence(WEAK)).toBe('Does the dream sound loud or quiet when you wake up?')
  })

  it('knows when the note is the lens and when it is only the setup', () => {
    // "worth more than oil" is what the question turns on.
    expect(noteReachesQuestion(GOOD, NOTE_OIL)).toBe(true)
    // The question could have been asked without the note existing.
    expect(noteReachesQuestion(WEAK, NOTE_AUDIO)).toBe(false)
  })

  it('ranks the better of the two first', () => {
    expect(draftQuality(GOOD, NOTE_OIL)).toBeGreaterThan(draftQuality(WEAK, NOTE_AUDIO))
  })

  it('still ranks a question with no full stop at all', () => {
    const oneLiner = 'Why does the idea have to fit on a physical piece of paper?'
    expect(questionSentence(oneLiner)).toBe(oneLiner)
    expect(draftQuality(oneLiner, NOTE_OIL)).toBeGreaterThanOrEqual(0)
  })
})
