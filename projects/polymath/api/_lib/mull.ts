/**
 * The mull channel's rules, with no IO in them.
 *
 * A candidate question cites its evidence: two or more rows of the corpus,
 * by ref, each with a verbatim quote. These gates decide whether it is
 * HONEST -- every quote is really in the row it cites, every name, number
 * and date the question states is in those rows, and the voice is plain.
 * Whether it is any GOOD is a different question, answered by a separate
 * judge call (mull-prompts.ts), because "would this bring a revelation"
 * is taste, and years of regexes here proved taste cannot be written as a
 * regex. What is left is what a regex is good at: catching invention.
 *
 * `loose` (the reroll's "get more creative" tier) skips the two shape
 * gates. Honesty never relaxes.
 */

import { findVoiceViolations } from './plain-english.js'
import { evidenceText, type Corpus, type CorpusRow } from './mull-corpus.js'
export { isGraveyarded } from './project-state.js'

/** Two or three sentences to carry around, not an essay. The evidence is
 *  laid side by side in the question, so it needs a little more room than
 *  a one-note question did. */
export const MAX_MULL_WORDS = 70

/** A pattern is two things at least. One note played back is a summary. */
export const MIN_EVIDENCE_ROWS = 2

export interface Evidence { ref: string; quote: string }

export interface Candidate {
  question: string
  evidence: Evidence[]
  /** The pattern, in one private sentence. Never shown to the user. */
  noticing: string
  /** What they would do differently once they have answered. */
  stake: string
  project: string | null
}

export interface Grounded extends Candidate {
  /** The rows the evidence really resolved to, in citation order. */
  rows: CorpusRow[]
}

/** Quotes get retyped with different punctuation and spacing; matching has
 *  to survive that without becoming a fuzzy match that lets invention in. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[.,;:!?"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The note says "dad"; the question says "your dad", because it is talking
 * to them. Person words and contractions are flattened on both sides so a
 * quote retold in the second person still matches. Nothing else is.
 */
function flattenPerson(text: string): string {
  return text
    .replace(/n't\b/g, ' not')
    .replace(/'(s|re|ll|ve|m|d)\b/g, ' $1')
    .replace(/\b(my|your|his|her|their|our|i|you|he|she|they|we|am|are|is|was|were|s|re|ll|ve|m|d)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Is this quote really in this text? Eight characters minimum -- "dad" is
 *  in everything. */
export function quoteIsReal(quote: string, sourceText: string): boolean {
  const q = normalise(quote)
  if (q.length < 8) return false
  const source = normalise(sourceText)
  if (source.includes(q)) return true
  const flatQ = flattenPerson(q)
  return flatQ.length >= 8 && flattenPerson(source).includes(flatQ)
}

/**
 * Resolve each cited quote to the row it is really in.
 *
 * The model mis-cites refs more often than it invents words, so a quote
 * that isn't in its cited row is looked for everywhere else before it is
 * given up on. A quote found nowhere is dropped -- and so is anything the
 * question leaned on it for, because the specifics check below only counts
 * rows that resolved.
 */
export function resolveEvidence(evidence: Evidence[], corpus: Corpus): { rows: CorpusRow[]; bad: string[] } {
  const rows: CorpusRow[] = []
  const bad: string[] = []
  for (const e of evidence) {
    const cited = corpus.byRef.get(e.ref.trim().toUpperCase())
    const row = cited && quoteIsReal(e.quote, `${cited.title} ${cited.text}`)
      ? cited
      : corpus.rows.find(r => quoteIsReal(e.quote, `${r.title} ${r.text}`))
    if (!row) bad.push(`${e.ref} "${e.quote.slice(0, 50)}"`)
    else if (!rows.includes(row)) rows.push(row)
  }
  return { rows, bad }
}

/**
 * The sentence that actually asks -- the last one with a question mark.
 */
export function questionSentence(text: string): string {
  const parts = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].includes('?')) return parts[i]
  }
  return text.trim()
}

/**
 * The specifics in a question: a number, or a capitalised word that isn't
 * starting a sentence. Years, places, names, titles -- what a model invents
 * when it invents. The rest of a question is the asker's own framing and
 * legitimately appears nowhere in the evidence.
 */
export function specifics(text: string): string[] {
  const out: string[] = []
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    sentence.trim().split(/\s+/).forEach((raw, i) => {
      // Opening quote marks don't make a word the start of a sentence.
      const first = i === 0 || (i === 1 && /^["'‘“(]$/.test(sentence.trim().split(/\s+/)[0]))
      for (const w of raw.split(/[^A-Za-z0-9]+/).filter(Boolean)) {
        if (/\d/.test(w)) { out.push(w.toLowerCase()); continue }
        if (!first && /^[A-Z][a-z]{2,}$/.test(w)) out.push(w.toLowerCase())
      }
    })
  }
  return [...new Set(out)]
}

/**
 * "the 10th" is not an invention when the evidence says "10 January".
 * Only a number with an ordinal suffix, only against the same bare number.
 */
export function ordinalSupported(word: string, haystack: string): boolean {
  const m = /^(\d{1,2})(st|nd|rd|th)$/.exec(word)
  if (!m) return false
  return new RegExp(`\\b${m[1]}\\b`).test(haystack)
}

/** Specifics the question states that none of its evidence contains.
 *  Substring on purpose -- "60s" is satisfied by "1960s" -- which errs
 *  toward letting a question through; everything it does catch is a hard
 *  reject. */
export function unsupportedSpecifics(text: string, evidence: string[]): string[] {
  const haystack = evidence.join(' ').toLowerCase()
  return specifics(text).filter(w => !haystack.includes(w) && !ordinalSupported(w, haystack))
}

/**
 * The model explaining the pattern is the tell that it doesn't trust the
 * reader to see it -- and the whole point is that they see it themselves.
 * Two facts side by side need no connective tissue.
 */
const EXPLAINER_PATTERNS: readonly RegExp[] = [
  /\b(which|that|this) (mirrors|echoes|parallels|reflects|suggests|shows|reveals|means)\b/i,
  /\bthis connects (to|with)\b/i,
  /\bthere'?s a (parallel|connection|link|pattern|theme)\b/i,
  /\b(interestingly|notably|tellingly|clearly)\b/i,
  /\bboth (of these )?(are|seem|feel) (about|like)\b/i,
  /\bit (seems|looks) like\b/i,
]

const CLOSED_OPENER = /^(does|do|did|is|are|was|were|will|would|should|can|could|has|have|had)\b/i

/**
 * Does the question hand them a choice between two things it supplied?
 * An opening auxiliary AND an explicit alternative. Also used by the
 * follow-up (spark-followup.ts).
 */
export function offersAChoice(questionText: string): boolean {
  const q = questionSentence(questionText).trim().toLowerCase()
  const alternative = /,\s*or\b|\bor is it\b|\bor does it\b|\bwhich is it\b/.test(q)
  return CLOSED_OPENER.test(q) && alternative
}

/** Answerable with a yes or a no. Nobody finds anything out that way. */
export function isClosed(questionText: string): boolean {
  return CLOSED_OPENER.test(questionSentence(questionText).trim())
}

/**
 * Every reason a candidate is thrown away before the judge sees it, or
 * null with the rows its evidence resolved to. Logged by name, so a
 * channel that keeps going quiet can be diagnosed rather than guessed at.
 */
export function checkCandidate(
  c: Candidate, corpus: Corpus, loose = false,
): { ok: true; grounded: Grounded } | { ok: false; reason: string } {
  const text = c.question.trim()
  if (!text) return { ok: false, reason: 'empty' }
  if (!text.includes('?')) return { ok: false, reason: 'not a question' }
  if (text.split(/\s+/).length > MAX_MULL_WORDS) return { ok: false, reason: 'too long to carry around' }

  const { rows, bad } = resolveEvidence(c.evidence, corpus)
  // Distinct captures, not rows: a fragment and the note it was cut from
  // are one thought said once, and a pattern needs two.
  const captures = new Set(rows.map(r => r.captureId)).size
  if (captures < MIN_EVIDENCE_ROWS) {
    return {
      ok: false,
      reason: `needs ${MIN_EVIDENCE_ROWS} real rows of evidence, has ${captures}` +
        (bad.length ? ` (not in the corpus: ${bad.join('; ')})` : ''),
    }
  }

  // Checked against the full rows the quotes resolved to, never the quotes
  // alone: a real quote with an invented detail dressed around it passes a
  // quote-only check and fails this one.
  const invented = unsupportedSpecifics(text, rows.map(evidenceText))
  if (invented.length > 0) {
    return { ok: false, reason: `names something its evidence doesn't: ${invented.join(', ')}` }
  }

  const voice = findVoiceViolations(text)
  if (voice.length > 0) return { ok: false, reason: voice[0] }

  if (!loose) {
    const explainer = EXPLAINER_PATTERNS.find(re => re.test(text))
    if (explainer) return { ok: false, reason: `explains the pattern instead of showing it: ${explainer.source}` }
    if (isClosed(text)) return { ok: false, reason: 'answerable with yes or no' }
  }

  return { ok: true, grounded: { ...c, question: text, rows } }
}

/** One candidate's scores from the judge call (mull-prompts.ts). */
export interface JudgeScore {
  n: number
  revelation: number
  truth: number
  specific: number
  answerable: number
  verdict: 'ship' | 'kill'
  reason: string
}

/**
 * Whether a judged candidate ships. Truth is a floor in every tier -- a
 * looser bar changes how good a question has to be, never whether it may
 * be false. The strict bar needs the judge's own "ship" as well as the
 * numbers, because the reason it gives for a kill is usually right even
 * when its scores are generous.
 */
export function judgeShips(s: JudgeScore, loose = false): boolean {
  if (loose) return s.truth >= 6 && s.answerable >= 5
  return s.verdict === 'ship' && s.truth >= 7 && s.revelation >= 7 && s.answerable >= 6
}

/** Revelation counts double: it is the only thing this channel is for. */
export function judgeRank(s: JudgeScore): number {
  return 2 * s.revelation + s.truth + s.specific + s.answerable
}

/** Read the judge's JSON, refusing anything malformed rather than
 *  inventing a score nobody gave. */
export function parseJudgeScores(raw: unknown, count: number): Map<number, JudgeScore> {
  const out = new Map<number, JudgeScore>()
  const list = (raw as { scores?: unknown })?.scores
  if (!Array.isArray(list)) return out
  const num = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 10 ? v : null)
  for (const s of list) {
    const n = typeof s?.n === 'number' ? s.n : null
    const scores = [num(s?.revelation), num(s?.truth), num(s?.specific), num(s?.answerable)]
    if (n === null || n < 1 || n > count || scores.some(x => x === null)) continue
    const [revelation, truth, specific, answerable] = scores as number[]
    out.set(n, {
      n, revelation, truth, specific, answerable,
      verdict: s.verdict === 'ship' ? 'ship' : 'kill',
      reason: typeof s.reason === 'string' ? s.reason : '',
    })
  }
  return out
}
