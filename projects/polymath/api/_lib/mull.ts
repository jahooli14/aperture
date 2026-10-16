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
  /** The line they are shown. Named for the old shape and kept for the
   *  callers: it is now usually a take (a claim, no question mark), and a
   *  question that is open still passes. */
  question: string
  evidence: Evidence[]
  /** The pattern, in one private sentence. Never shown to the user. */
  noticing: string
  /** The drafter's own best case against it. Handed to the judge, which
   *  is otherwise left to find the weak spot alone. */
  doubt?: string
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
 * Feelings and motives. The app can see what they made, kept and dropped; it
 * cannot see inside them, and a take that reads a feeling off a gap is the
 * oracle voice. Always on -- this is invention of an inner state, an honesty
 * matter, so even "get more creative" keeps it.
 */
const MIND_READING: readonly RegExp[] = [
  /\byou('| a)?re (afraid|scared|terrified|ashamed|anxious|insecure|hiding|running from)\b/i,
  /\b(secretly|subconsciously|unconsciously)\b/i,
  /\bdeep down\b/i,
  /\byou (really|truly|actually) (want|need|fear)\b/i,
  /\bafraid of\b/i,
]

/**
 * What they value, love, want or would rather -- an inner state, said about
 * them. The live failure: "I think you value conceiving simple physical
 * projects far more than executing them." The judge killed it as overreach,
 * but only after it had cost a slot. A take is about what they make, keep,
 * drop and say. The one exception is their own word: "I want the tools out"
 * lets a take say "you want a table you never have to clear".
 */
const INNER_STATE = /\byou(?:'d| would| really| secretly| actually| only| just| do not| don't| never)? (value|values|care about|crave|long for|yearn|fear|love|hate|enjoy|prefer|resent|want|desire|dread|rather)\b/i
/** Permission to themselves is a motive however it is phrased. */
const SELF_PERMISSION = /\b(let|allow|give) yourself\b/i

/** An inner state the take puts on them that their own words don't. */
export function readsAnInnerState(text: string, evidence: string[]): string | null {
  if (SELF_PERMISSION.test(text)) return SELF_PERMISSION.source
  const m = INNER_STATE.exec(text)
  if (!m) return null
  // Their own word, any tense: "love" is supported by "loved", "rather" by "I'd rather".
  const verb = m[1].split(' ')[0].replace(/s$/, '')
  const said = new RegExp(`\\b${verb}`, 'i')
  return evidence.some(e => said.test(e)) ? null : `you ${m[1]}`
}

/** Opening on a plan is reciting it: "For the book, you planned to...". A
 *  plan may be the second half of a contrast, never the first thing said. */
const OPENS_ON_A_PLAN = /^(for [^.,]{1,60},\s*)?(you (planned|plan to|intend|intended|were going to|said you would|said you'd|meant to)|the plan (is|was)|your plan)\b/i

/** The claim is one short sentence; the prompt asks for under 15 words. A
 *  long one is a theory with clauses, which is the analyst voice again. */
export const MAX_CLAIM_WORDS = 20

/** A hedge in the claim itself. A take nobody could be wrong about gets no
 *  reaction. Checked on the last sentence only, so a quoted "maybe" from
 *  their own note is not blamed on us. */
const HEDGES = /\b(perhaps|maybe|probably|possibly|might be|could be|may be|seems? to|sort of|kind of|in a way|i wonder)\b/i

/** The last sentence: the claim itself, after the facts laid next to it. */
export function claimSentence(text: string): string {
  const parts = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean)
  return parts[parts.length - 1] ?? text.trim()
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
  const mind = MIND_READING.find(re => re.test(text))
  if (mind) return { ok: false, reason: `reads a feeling or motive nobody gave: ${mind.source}` }
  const inner = readsAnInnerState(text, rows.map(r => r.text))
  if (inner) return { ok: false, reason: `says what they feel or value, in words they never used: ${inner}` }

  if (!loose) {
    const explainer = EXPLAINER_PATTERNS.find(re => re.test(text))
    if (explainer) return { ok: false, reason: `explains the pattern instead of showing it: ${explainer.source}` }
    if (OPENS_ON_A_PLAN.test(text)) return { ok: false, reason: 'opens by reciting a plan' }
    // Yes or no is the whole point of a take, so this only bites a question.
    if (text.includes('?') && isClosed(text)) return { ok: false, reason: 'answerable with yes or no' }
    if (!text.includes('?')) {
      const claim = claimSentence(text)
      if (HEDGES.test(claim)) return { ok: false, reason: 'hedges the claim, so nobody can disagree with it' }
      if (claim.split(/\s+/).length > MAX_CLAIM_WORDS) return { ok: false, reason: 'the claim is a theory, not one short sentence' }
    }
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
  /** Says more than the notes show: a feeling, a motive, a cause nobody
   *  gave, or a plan read back. Absent reads as not overreaching. */
  overreach?: boolean
  verdict: 'ship' | 'kill'
  reason: string
  /** The judge's own read of whether the take puts the live project next
   *  to a note about something else. Only ever a rank bonus. */
  crosses?: boolean
}

/**
 * The judge scores; it never blocks. There is always a set of takes to mull,
 * and they get lower in percentage as you go through them, so the app shows
 * the best one left. An overreaching take (a feeling or motive put on them)
 * is marked down hard, not removed.
 */
export function judgePercent(s: JudgeScore): number {
  const mean = (s.revelation + s.truth + s.specific + s.answerable) / 4
  return Math.max(0, Math.min(100, Math.round(mean * 10 * (s.overreach ? 0.5 : 1))))
}

/** Revelation counts double: it is the only thing this channel is for. */
export function judgeRank(s: JudgeScore): number {
  return 2 * s.revelation + s.truth + s.specific + s.answerable - (s.overreach ? 40 : 0)
}

/**
 * The Venn. A take that puts the live project next to a note about
 * something else is the one thing only this person could be shown: the
 * overlap of their own work and the rest of their life. It outranks a
 * sharper take that stays inside one project, but only by this much, so a
 * weak crossing never beats a strong one that doesn't.
 */
export const CROSSING_BONUS = 12

/**
 * How far a take crosses the live project: 0 = stays inside it, 1 = a
 * crossing, 2 = the whole trifecta.
 *
 * A crossing leans on something filed under the live project AND on
 * something of theirs from outside it: a voice note or fragment that isn't
 * about it (a fragment and the note it was cut from are one capture), or an
 * item from one of their lists, which is taste they chose. Another
 * project's description doesn't count: it's what they mean to make, not
 * something they said or picked.
 *
 * The trifecta is all three at once -- the live project, a note of theirs
 * about something else, and something from a list. Three unlike things that
 * only meet in one person is the overlap nobody else could be shown.
 */
export function crossingDepth(
  rows: CorpusRow[], corpus: Corpus, liveProjectId: string | null | undefined,
): 0 | 1 | 2 {
  if (!liveProjectId) return 0
  const isLive = (r: CorpusRow) => (r.kind === 'project' && r.id === liveProjectId) || r.projectId === liveProjectId
  const liveCaptures = new Set(corpus.rows.filter(isLive).map(r => r.captureId))
  if (!rows.some(isLive)) return 0
  const outsideNote = rows.some(r =>
    (r.kind === 'memory' || r.kind === 'fragment') && !isLive(r) && !liveCaptures.has(r.captureId))
  const fromAList = rows.some(r => r.kind === 'list_item')
  if (outsideNote && fromAList) return 2
  return outsideNote || fromAList ? 1 : 0
}

export const crossesLiveProject = (
  rows: CorpusRow[], corpus: Corpus, liveProjectId: string | null | undefined,
): boolean => crossingDepth(rows, corpus, liveProjectId) > 0

/**
 * Which part of the season a take serves. "main" if it leans on the main
 * project, "also" if it leans on one of the others that matter this
 * season, "wild" if it's about neither: two things of theirs meeting
 * somewhere else, for fun.
 */
export type Slot = 'main' | 'also' | 'wild'

export function slotOf(
  rows: CorpusRow[], mainId: string | null | undefined, alsoIds: string[], declaredId?: string | null,
): { slot: Slot; projectId: string | null } {
  const touches = (id: string) => rows.some(r => (r.kind === 'project' && r.id === id) || r.projectId === id)
  // Most voice notes about a project never attach to it, so rows alone
  // under-read. The draft names the project a take is most about; that
  // counts when it is one of the season's.
  if (mainId && (touches(mainId) || declaredId === mainId)) return { slot: 'main', projectId: mainId }
  const also = alsoIds.find(id => touches(id) || declaredId === id)
  if (also) return { slot: 'also', projectId: also }
  return { slot: 'wild', projectId: null }
}

/**
 * The season decides the order, but never over quality. Normally main,
 * then also, then the wild one; roughly one run in three leads with the
 * wild one instead. A slot's best candidate only takes its turn if it
 * scores within `tolerance` of the top one: a barely-passing take about the
 * main project does not bury a far better one. A slot nobody filled is
 * skipped, and whatever's left follows in the order it already had.
 */
export function orderBySlots<T>(
  ranked: T[], slotFor: (t: T) => Slot, funFirst: boolean,
  rankOf: (t: T) => number = () => 0, tolerance = CROSSING_BONUS,
): T[] {
  const order: Slot[] = funFirst ? ['wild', 'main', 'also', 'also'] : ['main', 'also', 'wild', 'also']
  const top = ranked.length ? Math.max(...ranked.map(rankOf)) : 0
  const out: T[] = []
  for (const slot of order) {
    const pick = ranked.find(t => !out.includes(t) && slotFor(t) === slot && rankOf(t) >= top - tolerance)
    if (pick) out.push(pick)
  }
  return [...out, ...ranked.filter(t => !out.includes(t))]
}

/** On top of CROSSING_BONUS: all three kinds of thing in one take. */
export const TRIFECTA_BONUS = 8

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
      overreach: s.overreach === true,
      verdict: s.verdict === 'ship' ? 'ship' : 'kill',
      reason: typeof s.reason === 'string' ? s.reason : '',
      crosses: s.crosses === true,
    })
  }
  return out
}
