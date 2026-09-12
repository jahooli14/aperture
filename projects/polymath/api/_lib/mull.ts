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

/** What today's question is built on. `joint` is the fourth and the best:
 *  something said more than once, already quoted and clustered by
 *  joint-miner.ts, sitting in the corpus unused by this channel until now.
 *  A thing you keep saying and have never made is the shortest path there
 *  is to "oh — I should make that." */
export type MullSubjectKind = MullSourceKind | 'joint' | 'pair'

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
 * How much subject vocabulary the domain rule needs to be worth anything.
 *
 * The two guards are meant to work together: the vector says the connector
 * answers the blind spot, the vocabulary says it answers from somewhere
 * else. But the vocabulary half only exists if the subject HAS distinctive
 * words, and the best subjects don't. "It only works if it's one take" is
 * three distinctive words and nine stopwords, so sharesDomain blocks
 * nothing for it — including the note that is that exact idea in different
 * clothes, which is the one thing it was there to catch.
 *
 * So when one guard goes missing the other tightens. A connector at 0.75
 * against a three-word joint is almost certainly a restatement; against a
 * ninety-word project block it is a genuine neighbour. Same number,
 * different meaning, and the ceiling has to reflect that rather than
 * pretend both are equally protected.
 */
export const VOCAB_FULL_GUARD = 12
/** The ceiling when the subject offers no vocabulary guard at all. */
export const CONNECTOR_CEILING_TIGHT = 0.62

export function connectorCeiling(subjectText: string): number {
  const distinctive = motifWords(subjectText).length
  if (distinctive >= VOCAB_FULL_GUARD) return CONNECTOR_CEILING
  const share = distinctive / VOCAB_FULL_GUARD
  return CONNECTOR_CEILING_TIGHT + share * (CONNECTOR_CEILING - CONNECTOR_CEILING_TIGHT)
}

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
  const ceiling = connectorCeiling(filter.subjectText)
  const eligible = candidates.filter(c =>
    c.text.trim().length > 0 &&
    !excluded.has(c.id) &&
    c.similarity >= CONNECTOR_FLOOR &&
    c.similarity <= ceiling &&
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
 * The note says "dad". The question says "your dad", because the prompt
 * tells it to talk to the user. Both are the same words.
 *
 * Without this the grounding check punished the model for doing exactly
 * what it was asked, and it fired on most real output — the commonest
 * single reason a good question was thrown away. Person is the only thing
 * flattened: everything else still has to match, so an invented quote is
 * still an invented quote.
 */
function flattenPerson(text: string): string {
  // Contractions first. The corpus says "it's one take" and the model
  // writes "it is one take", which is the same sentence and was failing.
  // Expanding both sides makes them agree; the possessive collision it
  // causes ("dad's" becoming "dad is") is harmless, because it happens
  // identically on both sides of every comparison.
  //
  // Person words are then dropped rather than replaced with a placeholder:
  // the note usually has no word at all where the question says "your", so
  // a placeholder would just be a different mismatch in the same place.
  return text
    .replace(/n't\b/g, ' not')
    .replace(/'(s|re|ll|ve|m|d)\b/g, ' $1')
    .replace(/\b(my|your|his|her|their|our|i|you|he|she|they|we|am|are|is|was|were|s|re|ll|ve|m|d)\b/g, ' ')
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
  const source = normalise(sourceText)
  if (source.includes(q)) return true
  return flattenPerson(source).includes(flattenPerson(q))
}

/** Three or more words in a row, which no paraphrase manages by accident. */
function sharesRun(text: string, quote: string, run = 3): boolean {
  const flatQuote = flattenPerson(normalise(quote))
  const words = flatQuote.split(' ').filter(w => w.length > 0)
  const haystack = flattenPerson(normalise(text))
  // A quote too short to have a three-word run has to appear whole, which
  // is stronger evidence, not weaker. "one take" is two stopwords and no
  // distinctive anything — the only honest test is whether they said it.
  if (words.length < run) return flatQuote.length > 0 && haystack.includes(flatQuote)
  for (let i = 0; i + run <= words.length; i++) {
    if (haystack.includes(words.slice(i, i + run).join(' '))) return true
  }
  return false
}

/**
 * Did the drafted question actually use the quote, or just append it?
 *
 * Two ways to pass, and the second is not a loosening — it's the fix for a
 * hole the first one couldn't see. A distinctive shared word catches most
 * cases. But the best quotes are short and plain — "it only works if it's
 * one take" has not a single word in it that isn't filler — so the word
 * test rejected exactly the material worth quoting. A verbatim run of three
 * words is the same evidence by a different route.
 */
export function usesQuote(text: string, quote: string): boolean {
  const quoteWords = new Set(motifWords(quote))
  if (quoteWords.size > 0 && motifWords(text).some(w => quoteWords.has(w))) return true
  return sharesRun(text, quote)
}

export interface MullDraft {
  text: string
  quote: string
}

/**
 * A question with no consequence gets no background cycles.
 *
 * "What changes if they answer this?" has an honest answer for a real
 * question — they cut the chapters, they stop buying the third synth, they
 * finally start the thing. It has only a hollow one for a question that is
 * really an observation with a question mark on the end, and this is what
 * hollow sounds like. Making the model declare the stake and then checking
 * it is a cheap forcing function: it can't write the consequence down
 * without noticing there isn't one.
 */
const HOLLOW_STAKE_PATTERNS: readonly RegExp[] = [
  /\b(their|the) (understanding|perspective|awareness|thinking|mindset|approach to)\b/i,
  /\bhow (they|the user) (think|thinks|sees?|views?|feels?) about\b/i,
  /\b(deeper|better|clearer|renewed) (insight|clarity|sense|appreciation)\b/i,
  /\bthey (might|could|may) (reflect|consider|realise|realize|reconsider)\b/i,
  /\bnothing (concrete|specific|in particular)\b/i,
  /\bit (would|could) (help|inform) them\b/i,
]

export function stakeIsHollow(stake: string): boolean {
  const text = stake.trim()
  if (text.split(/\s+/).length < 4) return true
  return HOLLOW_STAKE_PATTERNS.some(re => re.test(text))
}

export interface ValidationInput extends MullDraft {
  connectorText: string
  /** What changes depending on the answer, in the model's own words. */
  stake: string
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

  if (stakeIsHollow(input.stake)) return `nothing changes either way: "${input.stake}"`

  const voice = findVoiceViolations(text)
  if (voice.length > 0) return voice[0]

  return null
}

/**
 * Which of the day's candidate questions actually get written.
 *
 * The model calls are the expensive part and retrieval is nearly free, so
 * the channel builds several (blind spot → connector) pairs per run and
 * writes up the best ones in one go. Ranking them is deterministic: no
 * third model call to choose, because choosing is the kind of judgement a
 * score makes better than a paragraph of reasoning.
 *
 * Two halves. `similarity` says how squarely the connector answers the
 * blind spot — already inside the band, so higher is better. `strength`
 * comes from the subject's temporal shape (corpus-time.ts): a thing said
 * since 2023 and never built outranks an article someone saved, and it
 * does so by arithmetic over dates rather than by a hardcoded preference
 * for one table over another.
 */
const SUBJECT_WEIGHT = 0.35

export interface RankablePair {
  subjectId: string
  connectorId: string
  similarity: number
  /** The temporal shape's own strength, 0–1.5. */
  subjectStrength: number
}

export function rankPairs<T extends RankablePair>(pairs: T[], limit = 2): T[] {
  const score = (p: T) => p.similarity + p.subjectStrength * SUBJECT_WEIGHT
  const scored = [...pairs].sort((a, b) => score(b) - score(a))
  const chosen: T[] = []
  const usedSubjects = new Set<string>()
  const usedConnectors = new Set<string>()
  for (const pair of scored) {
    // Two questions about the same subject, or built on the same note, is
    // one question and a repeat — and the second one is what the user gets
    // days later, when the repeat is most obvious.
    if (usedSubjects.has(pair.subjectId) || usedConnectors.has(pair.connectorId)) continue
    chosen.push(pair)
    usedSubjects.add(pair.subjectId)
    usedConnectors.add(pair.connectorId)
    if (chosen.length >= limit) break
  }
  return chosen
}
