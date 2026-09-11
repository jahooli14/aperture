/**
 * The mull channel's rules, with no IO in them.
 *
 * The old channel had nine question shapes, each pulling its own slice of
 * the corpus. The failure was always the same and it wasn't the writing:
 * a generator picked two things and asked the model to link them, so the
 * model always found a link, and what it found was a resemblance dressed
 * up as a thought. "You like how Tame Impala treats synths as machines
 * that generate ideas — does the water scene in your book do that too?"
 * Nothing there is wrong. It's just not true of anything.
 *
 * The replacement inverts it, the same way composites were fixed (joint →
 * pair, never pair → invented bridge):
 *
 *   1. Take ONE thing — a project, a note, an article.
 *   2. Name the blind spot: what it assumes and has never examined.
 *   3. Write that blind spot as a plain human question with none of the
 *      subject's own vocabulary left in it, and use THAT as the search.
 *   4. Whatever the corpus returns is the connector. It was chosen by
 *      the blind spot, so there is nothing to invent.
 *
 * Step 3 is the load-bearing one. Search the blind spot in its own words
 * and the nearest thing is always the subject restated — more notes about
 * the book, for a question about the book. Strip the vocabulary and the
 * same question reaches the note about your dad's garden.
 *
 * This file holds the parts that decide whether the result is any good,
 * because those are rules rather than taste and rules can be tested.
 */

import { motifWords } from './spark-echo.js'
import { findVoiceViolations } from './plain-english.js'

/** What a connector can be. Sparks attribute to a project when there is
 *  one, so a project subject keeps its id and a note doesn't invent one. */
export type MullSourceKind = 'memory' | 'project' | 'article'

export interface MullCandidate {
  kind: MullSourceKind
  id: string
  title: string
  /** The words themselves — quoted back, and checked against. */
  text: string
  /** Cosine similarity to the blind-spot query, 0–1. */
  similarity: number
}

/**
 * Below this the match is noise: the corpus simply has nothing to say
 * about this blind spot, and silence is the right answer.
 */
export const CONNECTOR_FLOOR = 0.45

/**
 * Above this it isn't a connection, it's the same note again. A blind
 * spot about swapping characters matches the chapter outline at 0.9 —
 * true, and worth nothing to think about on a walk. The ceiling is what
 * keeps the channel from congratulating the user on what they already
 * wrote down.
 */
export const CONNECTOR_CEILING = 0.82

/**
 * Two distinctive words shared with the subject means the same domain:
 * another note about the book, for a question about the book. The
 * embedding says it answers the blind spot; this says it answers it from
 * somewhere else. Relevance from the vector, distance from the vocabulary
 * — that pairing is the whole mechanism.
 */
export const DOMAIN_OVERLAP_LIMIT = 2

/** Three sentences of carry-around, not an essay. */
export const MAX_MULL_WORDS = 60

/**
 * The model explaining its own link is the tell that there wasn't one.
 * A real collision needs no connective tissue: put the two things next to
 * each other and the reader does the work. "Which mirrors the way..." is
 * the sound of a bridge being built after the fact.
 */
const EXPLAINER_PATTERNS: readonly RegExp[] = [
  /\b(which|that) (mirrors|echoes|parallels|reflects)\b/i,
  /\bthis connects (to|with)\b/i,
  /\b(just|much) like (how|the way)\b/i,
  /\bthe same (way|thing) (that|as)\b/i,
  /\bthere'?s a (parallel|connection|link|resonance)\b/i,
  /\b(interestingly|notably|tellingly)\b/i,
  /\bboth (of these|are about)\b/i,
]

export function sharesDomain(a: string, b: string, limit = DOMAIN_OVERLAP_LIMIT): boolean {
  const words = new Set(motifWords(a))
  if (words.size === 0) return false
  let shared = 0
  for (const word of motifWords(b)) {
    if (words.has(word) && ++shared >= limit) return true
  }
  return false
}

export interface ConnectorFilter {
  /** The subject's own words — anything sharing its vocabulary is out. */
  subjectText: string
  /** Ids that ARE the subject, in any table. */
  excludeIds: string[]
}

/**
 * Which returned item becomes the lens.
 *
 * Inside the band, the highest similarity wins: the band has already
 * thrown out the restatements above it and the noise below, so what's
 * left is ranked by how squarely it answers the blind spot. Nothing here
 * prefers a distant match for its own sake — distance is enforced by the
 * vocabulary rule, not by picking a worse answer on purpose.
 */
export function selectConnector(
  candidates: MullCandidate[],
  filter: ConnectorFilter,
): MullCandidate | null {
  const excluded = new Set(filter.excludeIds)
  const eligible = candidates.filter(c =>
    c.text.trim().length > 0 &&
    !excluded.has(c.id) &&
    c.similarity >= CONNECTOR_FLOOR &&
    c.similarity <= CONNECTOR_CEILING &&
    !sharesDomain(filter.subjectText, `${c.title} ${c.text}`)
  )
  if (eligible.length === 0) return null
  return eligible.reduce((best, c) => (c.similarity > best.similarity ? c : best))
}

/** Quotes get retyped with different punctuation and spacing; matching has
 *  to survive that without becoming a fuzzy match that lets invention in. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The grounding gate, and the only thing standing between this and the
 * Context Engine's invented article titles: the model has to hand back
 * the words it used, and they have to actually be in the note.
 */
export function quoteIsReal(quote: string, sourceText: string): boolean {
  const q = normalise(quote)
  if (q.length < 8) return false
  return normalise(sourceText).includes(q)
}

/** Did the drafted question actually use the quote, or just append it? */
export function usesQuote(text: string, quote: string): boolean {
  const quoteWords = new Set(motifWords(quote))
  if (quoteWords.size === 0) return false
  return motifWords(text).some(w => quoteWords.has(w))
}

export interface MullDraft {
  text: string
  quote: string
}

export interface ValidationInput extends MullDraft {
  connectorText: string
}

/**
 * Every reason a finished mull gets thrown away. Returns null when it's
 * good, or the reason it isn't — logged, so a channel that keeps going
 * quiet can be diagnosed rather than guessed at.
 *
 * Throwing one away is cheap: there is no fixed daily slot to fill, and
 * a question that lands badly is read once and distrusted for a week.
 */
export function rejectionReason(input: ValidationInput): string | null {
  const text = input.text.trim()
  if (text.length === 0) return 'empty'
  if (!text.includes('?')) return 'not a question'
  if (text.split(/\s+/).length > MAX_MULL_WORDS) return 'too long to carry around'
  if (!quoteIsReal(input.quote, input.connectorText)) return 'quote is not in the note'
  if (!usesQuote(text, input.quote)) return 'the note is decoration, not a lens'

  const explainer = EXPLAINER_PATTERNS.find(re => re.test(text))
  if (explainer) return `explains the link: ${explainer.source}`

  const voice = findVoiceViolations(text)
  if (voice.length > 0) return voice[0]

  return null
}

/**
 * Which kind of thing today's mull is about.
 *
 * Mostly a project, because that's what the app is for and a project has
 * enough shape to have an unexamined assumption in the first place. But
 * not always: a note you made three weeks ago and never went back to has
 * its own blind spot, and an article you vouched for is the one input
 * that doesn't come from inside your own head. Weighted, not rotated —
 * a fixed cycle would make the channel predictable, which is the same
 * habituation problem the old type rotation existed to solve.
 */
const SUBJECT_WEIGHTS: Record<MullSourceKind, number> = {
  project: 0.55,
  memory: 0.3,
  article: 0.15,
}

export function pickSubjectKind(
  available: MullSourceKind[],
  rand: number = Math.random(),
): MullSourceKind | null {
  if (available.length === 0) return null
  const total = available.reduce((sum, k) => sum + SUBJECT_WEIGHTS[k], 0)
  let r = rand * total
  for (const kind of available) {
    r -= SUBJECT_WEIGHTS[kind]
    if (r <= 0) return kind
  }
  return available[available.length - 1]
}
