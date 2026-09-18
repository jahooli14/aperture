/**
 * The mull channel's rules, with no IO in them.
 *
 * The channel used to pick one subject, name what it never examined, strip
 * that of its own vocabulary, and search the corpus in band for a
 * connector — built to stop the model finding a resemblance and dressing
 * it up as a thought ("You like how Tame Impala treats synths as machines
 * that generate ideas — does the water scene in your book do that too?").
 * Nothing there was wrong. It just wasn't true of anything.
 *
 * Measured against the real corpus, that search wasn't what was keeping it
 * honest — this file was. A single call handed the whole corpus at once
 * (mull-generator.ts) passed these same gates just as cleanly, so the
 * search is gone and this file is unchanged: grounding, the binary-shape
 * gate, the explainer-pattern gate, the word limit, the invented-specifics
 * check. Rules rather than taste, and rules can be tested regardless of
 * how the material in front of them was found.
 */

import { motifWords } from './spark-echo.js'
import { findVoiceViolations } from './plain-english.js'
export { isGraveyarded } from './project-state.js'

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
  // The gotcha construction. "You said A, but you're also doing B" asserts a
  // contradiction rather than finding one, and the questions that follow it
  // walk away from both halves into something that would fit any subject. A
  // real tension does not need "but" to announce itself.
  /,\s*(but|yet)\s+you('re| are|r)?\s+(also|still|now|actually)\b/i,
  // Same move, any connective. "You wanted to map all 198 countries to a
  // memory palace. Yet you left your painted coasters sitting for eleven
  // months" -- the pivot decides the user is being inconsistent and sets up
  // to catch them out. Banning only ", but you're also" just moved the model
  // onto "Yet you". Two facts side by side need no pivot between them.
  /(^|[.;,]\s*)(yet|but|though|whereas)\s+you\b/i,
]

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

/**
 * The longest run of the note's own words that survives into the question.
 *
 * The `quote` field is the model's report of what it used, and it keeps
 * getting it slightly wrong — a word dropped, a tense changed, a phrase
 * tightened. Loosening the quote matcher to chase that is a rearguard
 * action, and it was already loosened twice. What actually matters is
 * whether the QUESTION carries the user's own words, which can be checked
 * on the question itself without trusting the report at all.
 */
export function longestSharedRun(text: string, source: string, minWords = 4): string | null {
  const words = flattenPerson(normalise(source)).split(' ').filter(Boolean)
  const haystack = flattenPerson(normalise(text))
  for (let len = Math.min(words.length, 14); len >= minWords; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const run = words.slice(i, i + len).join(' ')
      if (haystack.includes(run)) return run
    }
  }
  return null
}

/**
 * The sentence that actually asks — everything after the last full stop
 * that still contains the question mark.
 *
 * A mull is a setup plus a question: "You wrote X, N months ago. Does
 * Y...?" The setup is where the user's own words are replayed, so a
 * question can carry the note perfectly in its first sentence and then ask
 * something that has nothing to do with it. Telling those apart needs the
 * two halves separated.
 */
export function questionSentence(text: string): string {
  const trimmed = text.trim()
  // Split on sentence ends, keep the last piece that asks something.
  const parts = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].includes('?')) return parts[i]
  }
  return trimmed
}

/**
 * Does the note reach the QUESTION, or only the setup?
 *
 * This is "the note is the LENS, not evidence you hold against them" made
 * checkable. Two real drafts, minutes apart, same corpus:
 *
 *   "You wrote that ideas are worth more than oil, eight months before
 *    picking up A single note on paper again. If the idea is worth more
 *    than oil, why does it have to fit on a physical piece of paper?"
 *
 *   "You asked \"Can you hear this latest one?\" while working on audio
 *    quality, then left your project \"Vivid dreams book idea\" sitting
 *    quiet for six months. Does the dream sound loud or quiet when you
 *    wake up?"
 *
 * Both quote the user and both clear every gate. In the first the note's
 * language is load-bearing in the question itself; in the second the
 * question could have been asked without the note existing. That is the
 * whole difference between the two, and it is the difference between a
 * question worth carrying for three days and one that reads as a
 * non-sequitur.
 *
 * Used to RANK survivors, never to reject: a hard gate here would trade a
 * mediocre question for an empty slot, and this channel has learned that
 * lesson repeatedly.
 */
export function noteReachesQuestion(text: string, connectorText: string): boolean {
  return longestSharedRun(questionSentence(text), connectorText, 3) !== null
}

/**
 * How good a question that already cleared the gates is, relative to the
 * others from the same run. Higher ships first.
 *
 * The gates are pass/fail and the run keeps "the first two that clear
 * them" — in pair-rank order, which ranks the PAIR (subject strength ×
 * similarity) and knows nothing about the question that came out of it. So
 * a weaker question from a stronger pair shipped ahead of a better one.
 */
export function draftQuality(text: string, connectorText: string): number {
  // One signal, deliberately. A tiebreak on how MUCH of the note is
  // replayed was tried and removed: it rewards a longer transcription in
  // the setup, which is not the same as a better question, and it
  // reordered two drafts that were equally good on the part that matters.
  // Equal scores keep the order they arrived in (sort is stable), so this
  // only moves a question when there is a real reason to.
  return noteReachesQuestion(text, connectorText) ? 1 : 0
}

/**
 * The specifics in a question: a number, or a capitalised word that isn't
 * starting a sentence. Years, places, brands, names of things.
 *
 * These are what a model invents when it invents. The rest of a question
 * is the asker's own framing ("what would it cost to find out which is
 * true?") and legitimately appears nowhere in the evidence.
 */
export function specifics(text: string): string[] {
  const out: string[] = []
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    sentence.trim().split(/\s+/).forEach((raw, i) => {
      // Split inside the token too: "1950s/60s" is two specifics, and
      // checking it whole would flag a note that says "1950s and 60s".
      for (const w of raw.split(/[^A-Za-z0-9]+/).filter(Boolean)) {
        if (/\d/.test(w)) { out.push(w.toLowerCase()); continue }
        if (i > 0 && /^[A-Z][a-z]{2,}$/.test(w)) out.push(w.toLowerCase())
      }
    })
  }
  return [...new Set(out)]
}

/**
 * Specifics the question asserts that appear nowhere it could have got
 * them from.
 *
 * The grounding gate above asks whether SOME of the note survives into the
 * question. One matching run clears it — and everything else in the same
 * sentence is then unchecked. A live question read "You kept a school book
 * from the 1950s/60s… Which page from the French school book goes on the
 * first postcard?", where the genuine quote did all the work and "French"
 * and "1950s/60s" were verified against nothing.
 *
 * Coverage over ALL the question's words was tried first — composite-
 * generator's `hasAdequateCoverage`, ported straight over — and measured
 * against the gate corpus it cannot work here: good questions score
 * anywhere from 0.00 to 0.66 because most of a mull is the asker's own
 * framing, and the invented examples score 0.12 and 0.18, inside that
 * range. No threshold separates them. Specifics do: every question in the
 * GOOD corpus has none unsupported, and the invented one has two.
 *
 * Substring matching on purpose — "60s" is satisfied by "1960s", which
 * errs toward letting a question through. Invention is a hard reject, so
 * the bias belongs on that side.
 */
export function unsupportedSpecifics(text: string, evidence: string[]): string[] {
  const haystack = evidence.join(' ').toLowerCase()
  return specifics(text).filter(w => !haystack.includes(w) && !ordinalSupported(w, haystack))
}

/**
 * "the 10th" is not an invention when the fact says "10 January".
 *
 * English writes dates as ordinals and the facts this channel computes
 * write them as cardinals, so every question that mentioned the day was
 * rejected for making it up. Live: two drafts in one run died on "3rd" and
 * "10th" against a fact reading "On 10 January 2026...". Same shape as the
 * missing month earlier — a gate can only see what it is given, and here
 * it was given the number and shown the ordinal.
 *
 * Deliberately narrow: only a number with an ordinal suffix, only matched
 * against the same bare number. "2026th" is not a thing, and "1950s" is
 * already handled by the tokeniser above.
 */
export function ordinalSupported(word: string, haystack: string): boolean {
  const m = /^(\d{1,2})(st|nd|rd|th)$/.exec(word)
  if (!m) return false
  return new RegExp(`\\b${m[1]}\\b`).test(haystack)
}

export interface ValidationInput extends MullDraft {
  connectorText: string
  /** What changes depending on the answer, in the model's own words. */
  stake: string
  /** The subject line the question was written from. Part of the evidence
   *  a specific can legitimately come from — a good question names the
   *  project, and the project is not in the note. */
  subjectText?: string
  /** "Get more creative" — the reroll's fallback tier for when the regular
   *  bar has run the corpus dry. Relaxes taste, never honesty: the gates
   *  that stop the model explaining itself or shipping a decorative binary
   *  are skipped, but grounding (the note's own words survive into the
   *  question) and unsupportedSpecifics (nothing invented) are not
   *  negotiable in any tier — a looser bar is not a licence to make things
   *  up. See rejectionReason. */
  loose?: boolean
}

/**
 * Every reason a finished mull gets thrown away. Returns null when it's
 * good, or the reason it isn't — logged, so a channel that keeps going
 * quiet can be diagnosed rather than guessed at.
 *
 * Throwing one away is cheap: there is no fixed daily slot to fill, and
 * a question that lands badly is read once and distrusted for a week.
 */
/**
 * Does the question hand them a choice between two things it supplied?
 *
 * The prompt has banned this from the start, and the model kept doing it
 * anyway, because the ban was written as a PHRASING ("X, and also Y — which
 * is it?") and the model was using a different one:
 *
 *   "Does Pupils trace how he grows up, or does it stay in the nursery?"
 *   "Does Tame impala synth sessions run on footwork, or does it stay on
 *    the synth?"
 *
 * Both shipped from a healthy corpus with the quote landing correctly, and
 * both are answerable in five seconds by picking a side — which the channel's
 * own "too easy is a quiz" rule says is nothing to carry for three days.
 *
 * Narrow on purpose: an opening auxiliary AND an explicit alternative. A
 * question may still say "or" ("what would it take to finish it, or to
 * admit it is finished?" is one thing asked twice) and may still start with
 * "Does" if it offers no alternative. Both halves must be present, because
 * a gate that fires on either one would throw away good questions, which
 * this channel has done before and pays for in empty slots.
 *
 * Shape alone is not the verdict, though — see `stakeSplits`. Some of the
 * best questions this channel can ask ARE either/ors.
 */
/**
 * Does the stake name a genuinely different outcome for each branch?
 *
 * The word "or" alone is not enough, and one run in five proved it: the
 * channel shipped "Are you making creative logo t-shirts for friends, or
 * are you just running the same January project twice?" behind a stake that
 * said "or" and meant nothing by it. An exemption that any sentence
 * containing "or" can satisfy is not an exemption, it is a hole.
 *
 * Two earlier versions of this were both wrong, in opposite directions.
 *
 * `/\beither way\b/` passed the stake UNCONDITIONALLY, which is the whole
 * gate handed away on a phrase that means the opposite of splitting: "either
 * way" is "regardless of which branch", and it is exactly what a model
 * reaches for when both branches land in the same place ("he learns
 * something about the app either way"). Nothing in this function's own
 * reasoning ever argued for it and no teaching example uses it.
 *
 * Requiring four words a side was the other. It reads as strictness and is
 * really just a length check, and the channel's own teaching examples fail
 * it: "The shed gets racking or gets emptied" and "The plot gets planted
 * this spring or handed back" are both real splits whose second side is TWO
 * words. English drops the repeated subject and verb in the second branch —
 * that ellipsis is a mark of a natural split, not a weak one.
 *
 * What actually separates the three real splits on record from a decorative
 * one is that the second side NAMES SOMETHING THE FIRST DID NOT:
 * racking/emptied, planted/handed back, writes/admits. A stake whose second
 * side only restates the first ("he picks a direction, or he picks another
 * one") adds no outcome, however many words it spends. So: both sides carry
 * content, and the side after "or" contributes a content word of its own.
 */
const STAKE_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its',
  'he', 'she', 'they', 'them', 'him', 'her', 'his', 'their', 'you', 'your',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'and', 'that', 'this',
  'gets', 'get', 'goes', 'go', 'does', 'do', 'did', 'has', 'have', 'had',
  'will', 'would', 'one', 'not', 'up', 'out', 'off', 'by', 'as', 'so',
])

/**
 * Crude on purpose. "He decides, or he does not decide" is one outcome said
 * twice, and an exact-match comparison reads `decide` as new content next to
 * `decides` — so the restatement this whole function exists to catch walks
 * through on a suffix. Chopping the common endings collapses the pair
 * without needing a stemmer: the three real splits still differ afterwards
 * (rack/empti, plant/hand, writ/admit), which is the only test that matters.
 */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, '').replace(/e$/, '')
}

function stakeContent(side: string): Set<string> {
  return new Set(
    side.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 1 && !STAKE_STOPWORDS.has(w))
      .map(stem)
      .filter(Boolean),
  )
}

export function stakeSplits(stake: string): boolean {
  const parts = (stake ?? '').trim().split(/\bor\b/i)
  if (parts.length !== 2) return false
  const before = stakeContent(parts[0])
  const after = stakeContent(parts[1])
  if (before.size === 0 || after.size === 0) return false
  // The branch after "or" has to put something on the table that the branch
  // before it did not. That is the difference between two outcomes and one
  // outcome said twice.
  return [...after].some(w => !before.has(w))
}

export function offersAChoice(questionText: string): boolean {
  const q = questionSentence(questionText).trim().toLowerCase()
  const opensClosed = /^(does|do|did|is|are|was|were|will|would|should|can|could|has|have)\b/.test(q)
  const alternative = /,\s*or\b|\bor is it\b|\bor does it\b|\bwhich is it\b/.test(q)
  return opensClosed && alternative
}

export function rejectionReason(input: ValidationInput): string | null {
  const text = input.text.trim()
  if (text.length === 0) return 'empty'
  if (!text.includes('?')) return 'not a question'
  if (text.split(/\s+/).length > MAX_MULL_WORDS) return 'too long to carry around'
  // Grounding, checked two ways. Either the model's quote really is in the
  // note, or the question itself carries a run of the note's own words --
  // in which case the report was sloppy but the question is sound, and
  // throwing it away produces an empty slot for a clerical reason.
  const quoted = quoteIsReal(input.quote, input.connectorText)
  const carried = longestSharedRun(text, input.connectorText)
  if (!quoted && !carried) {
    // Four drafts in a row died here and the message said only that they
    // had. Which half failed is the whole diagnosis: a model quoting the
    // project instead of the note is a prompt problem, and a real quote
    // the substring check can't find is a matching problem. They need
    // opposite fixes, so the trace has to tell them apart.
    return `nothing of the note survives into the question — it said it used ` +
      `"${input.quote.slice(0, 70)}", the note actually says "${input.connectorText.slice(0, 70)}…"`
  }
  if (quoted && !usesQuote(text, input.quote) && !carried) {
    return 'the note is decoration, not a lens'
  }

  // From here down are taste gates, not honesty gates — they stop a
  // question that's clumsy or decorative, not one that invents. `loose`
  // (the reroll's "get more creative" tier) skips them so a corpus that's
  // run out of high-bar material still produces something, rather than a
  // fourth straight empty slot. Grounding above and unsupportedSpecifics
  // below stay on regardless: a looser bar changes how good the question
  // has to be, never whether it's allowed to make something up.
  if (!input.loose) {
    const explainer = EXPLAINER_PATTERNS.find(re => re.test(text))
    if (explainer) return `explains the link: ${explainer.source}`

    // A binary is only fake when both branches land in the same place. The
    // prompt already demands the model say what the user would DO differently
    // depending on the answer, so the stake is the evidence: one that names
    // two outcomes means the either/or is real and worth carrying --
    //   "Do you have it now, or did you miss the work?"
    //   stake: "He writes the last line this week, or admits he wanted the hours."
    // -- while a single outcome behind a two-sided question means the sides
    // were decoration:
    //   "Does Pupils trace how he grows up, or does it stay in the nursery?"
    //   stake: "He picks a direction."
    if (offersAChoice(text) && !stakeSplits(input.stake)) {
      return 'offers a choice between two things it supplied, and nothing different happens either way'
    }
  }

  // Only when the caller supplied the subject. Half the evidence is not
  // enough to call something invented: the dated facts this channel
  // computes ("since March 2023", "three times since February") live in
  // the subject, not the note, and judging without it rejects the app's
  // own arithmetic.
  const invented = input.subjectText
    ? unsupportedSpecifics(text, [input.connectorText, input.subjectText])
    : []
  if (invented.length > 0) {
    return `names something that is in neither the note nor the project: ${invented.join(', ')}`
  }

  if (!input.loose && stakeIsHollow(input.stake)) return `nothing changes either way: "${input.stake}"`

  const voice = findVoiceViolations(text)
  if (voice.length > 0) return voice[0]

  return null
}

