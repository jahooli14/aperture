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
import { rejectionReason, usesQuote, quoteIsReal } from './mull.js'
import { findVoiceViolations } from './plain-english.js'

const NOTE = `Ten more proper conversations with dad, probably, and we spend them on the greenhouse.
Cut the mitres at 5am before anyone was up. The trial expired on Friday and I never opened it again.
I keep buying records I don't play. The tidy room in a messy house. It only works if it's one take.`

const candidate = (text: string, quote: string, stake: string) =>
  ({ text, quote, stake, connectorText: NOTE })

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
