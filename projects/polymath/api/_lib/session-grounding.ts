/**
 * Grounding for session items — "cite or stay silent", applied to the plan.
 *
 * SPEC.md already commits to this for morph proposals (morph.ts /
 * verifyCitations): a claim the app can't trace back to something the user
 * actually said doesn't get shown. Session items were exempt, and the
 * result was a plan for a song project that named an SM57 microphone, an
 * acoustic guitar part and a click track — none of which exist anywhere in
 * the corpus. One fabricated line costs the whole list its credibility,
 * because you now have to check every other line yourself. At that point
 * the app has added work rather than removed it.
 *
 * Two independent gates, both mechanical, both here rather than hoped for
 * in a prompt:
 *
 *   1. INVENTED SPECIFICS. Gear codes (SM57, C414), proper nouns and
 *      numbers-with-units (-3dB, 24-bit, 120bpm) are the tokens that make
 *      a line sound authoritative. Any of them that appears nowhere in the
 *      project's evidence is a fabrication, and the item goes.
 *   2. CITATION. Every non-generic item names the evidence it came from,
 *      and the cited evidence has to actually share vocabulary with it —
 *      the same loose-overlap check verifyCitations uses, so a model can't
 *      launder an invention by pointing at an unrelated note.
 *
 * A generic item ("Open the project and play it from the top") cites
 * nothing and is allowed precisely because it asserts nothing.
 */

export interface Evidence {
  id: string
  /** Where it came from, for the receipt line under the item. */
  label: string
  text: string
}

export interface RawItem {
  text: string
  evidence?: string[]
}

export interface GroundedItem {
  text: string
  /** Human-readable source, e.g. "from your last close-out". Null when the
   *  item is generic enough to need no source. */
  source: string | null
  /** The real id of the open task this item is grounded in, when its
   *  supporting citation traces back to one. Session items are usually a
   *  MODEL'S PARAPHRASE of a task, not its stored text -- "Fix the
   *  transition out of track two" becomes "Play track two from the top and
   *  find where it breaks". Matching a ticked item back to its task by
   *  string equality silently fails the moment the model paraphrases,
   *  which its own prompt teaches it to do. An id survives the paraphrase. */
  taskId: string | null
}

/**
 * Tokens that make a sentence sound like it knows something. Each one is a
 * claim about the project, so each one has to be traceable.
 */
export function extractSpecifics(text: string): string[] {
  const out = new Set<string>()

  // Gear / model codes: SM57, C414, RE20, MPC1000, U87.
  for (const m of text.matchAll(/\b[A-Za-z]{1,4}-?\d{2,4}[A-Za-z]?\b/g)) out.add(m[0])

  // Numbers with a unit attached: -3dB, 24-bit, 120bpm, 44.1kHz, 3/4.
  // The separator matters: "24-bit" and "24 bit" and "24bit" are the same
  // claim, and only one of them matched before.
  for (const m of text.matchAll(/\b\d+(?:\.\d+)?[-\s]?(?:db|bit|bpm|khz|hz|mm|cm|inch|in|ft|k|px)\b/gi)) out.add(m[0])

  // Proper nouns — capitalised words that aren't starting a sentence.
  // These are the brand names, people and place names a model reaches for
  // when it's filling a gap rather than reporting.
  const words = text.split(/\s+/)
  words.forEach((word, i) => {
    const clean = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    if (!clean || clean.length < 2) return
    if (!/^[A-Z][a-z]+$/.test(clean) && !/^[A-Z]{2,}$/.test(clean)) return
    // Sentence-initial capitals are grammar, not claims.
    if (i === 0) return
    const prev = words[i - 1]
    if (/[.!?]$/.test(prev)) return
    if (clean === 'I') return
    out.add(clean)
  })

  return [...out]
}

/** Everything the app actually knows about this project, as one haystack. */
export function evidenceHaystack(evidence: Evidence[], projectTitle: string): string {
  return `${projectTitle} ${evidence.map(e => e.text).join(' ')}`.toLowerCase()
}

/**
 * True when every specific in the item appears somewhere in what the user
 * has actually said or written about this project.
 */
export function hasOnlyKnownSpecifics(text: string, haystack: string): boolean {
  return extractSpecifics(text).every(s => haystack.includes(s.toLowerCase()))
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'your', 'you',
  'out', 'off', 'get', 'got', 'its', 'was', 'are', 'has', 'have', 'onto',
  'then', 'them', 'next', 'over', 'back', 'down', 'one', 'two', 'new', 'all',
  'still', 'just', 'need', 'needs', 'again', 'until', 'where', 'what', 'when',
  'some', 'more', 'much', 'very', 'here', 'there', 'about', 'through',
])

/**
 * Verbs that appear in almost every session item ever written. Sharing one
 * of these with a note proves nothing -- "sort the album artwork" and "got
 * the intro sorted" have "sort" in common and nothing else, and treating
 * that as a citation is how an invention launders itself.
 *
 * They still count as content for length purposes; they just can't be the
 * thing that makes a citation valid.
 */
const WEAK_MATCH_WORDS = new Set([
  'work', 'sort', 'make', 'made', 'take', 'took', 'give', 'put', 'set',
  'start', 'started', 'finish', 'finished', 'open', 'close', 'play', 'look',
  'find', 'fix', 'try', 'keep', 'move', 'add', 'use', 'check', 'sort',
  'thing', 'things', 'stuff', 'bit', 'part', 'time', 'day', 'week',
])

/**
 * Crude suffix stripping, deliberately not a real stemmer. It exists to
 * make "sent"/"send", "mixed"/"mix" and "cutting"/"cut" match, because a
 * citation was being rejected purely on English inflection -- "Send the
 * rough to Graham" genuinely does come from a goal that says "sent to
 * him", and blocking it taught the app to be useless on well-known
 * projects rather than honest on thin ones.
 */
export function stem(word: string): string {
  let w = word
  for (const suffix of ['ing', 'ed']) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length)
      break
    }
  }
  // Plurals strip only the 's': taking 'es' off "bounces" gives "bounc",
  // which then fails to match "bounce".
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  // Doubled final consonant from -ing/-ed ("cutting" -> "cutt" -> "cut").
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2]) w = w.slice(0, -1)
  // Irregulars worth the two lines: they're the verbs this domain uses most.
  const irregular: Record<string, string> = { sent: 'send', wrote: 'writ', cut: 'cut', got: 'get' }
  return irregular[w] ?? w
}

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
    .map(stem)
}

/**
 * A citation holds when the item and its cited evidence share at least one
 * DISTINCTIVE word — a noun or a domain term, not a verb every item uses.
 *
 * The earlier version wanted two raw word matches, which blocked most
 * honest inference on a well-shaped project: "Work on the intro level"
 * citing "Got the intro sorted" has exactly one word in common and is
 * plainly legitimate. One distinctive word is a stronger signal than two
 * weak ones, and it's the specifics gate above — not this — that does the
 * heavy lifting against fabrication.
 */
export function citationSupports(itemText: string, evidenceText: string): boolean {
  const claim = contentWords(itemText)
  const source = new Set(contentWords(evidenceText))
  if (claim.length === 0 || source.size === 0) return false
  return claim.some(w => source.has(w) && !WEAK_MATCH_WORDS.has(w))
}

/**
 * Two ITEMS describing the same real-world move -- not one item citing
 * evidence. Deliberately a different, stricter bar than citationSupports:
 * that function's whole point is that ONE shared word is enough to accept
 * a citation ("Work on the intro level" citing "Got the intro sorted" is
 * legitimate on one word). Reusing that same one-word bar to decide two
 * TASKS are duplicates is wrong in both directions -- "Record the vocal"
 * and "Record the guitar solo" share exactly one word and are plainly
 * different tasks, while "Listen to the song" and "Play back the mixed
 * file" describe the same move with zero shared vocabulary at all (that
 * case can only be caught by the model itself, not word-matching).
 * This asks a narrower question: do most of the shorter text's own
 * distinctive words show up in the other -- catching near-identical
 * restatements ("Fix the transition out of track two" vs "Fix the
 * transition between the two tracks") without flagging two genuinely
 * different tasks that merely share a topic word.
 */
export function sharesSubstantialWording(a: string, b: string, minRatio = 0.6): boolean {
  const wordsA = new Set(contentWords(a))
  const wordsB = new Set(contentWords(b))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  const smaller = wordsA.size <= wordsB.size ? wordsA : wordsB
  const larger = smaller === wordsA ? wordsB : wordsA
  let shared = 0
  for (const w of smaller) if (larger.has(w)) shared++
  return shared / smaller.size >= minRatio
}

/**
 * Coverage across the WHOLE evidence set, as a second gate alongside
 * citationSupports rather than a replacement for it.
 *
 * citationSupports asks "does ONE cited entry share a real word with this
 * item" -- right for a session item, which is usually one short move
 * grounded in one task or close-out. A composite fuses SEVERAL pieces of
 * evidence into one sentence, and that per-citation check can pass on a
 * single shared word ("shelf") while every other specific word in the
 * same sentence ("steel tubing", "turntable") traces to nothing at all --
 * exactly the smuggled-invention failure this whole module exists to
 * catch, just spread across a longer sentence instead of concentrated in
 * one citation.
 *
 * This checks that a real majority of the item's own distinctive words
 * appear SOMEWHERE in the full evidence, not just the one word that
 * happened to get it past citationSupports. Scoped to composites for now
 * -- session items are short and single-sourced enough that the per-
 * citation check alone has held up under test.
 */
export function hasAdequateCoverage(text: string, evidence: Evidence[], minRatio = 0.5): boolean {
  // A slightly higher length floor than contentWords' own 3 -- a lone
  // short filler word ("see", "got") is common enough in ordinary prose
  // that penalising a whole sentence for lacking one reads as a false
  // alarm, where citationSupports' single-word match doesn't have that
  // problem (it only needs ONE real hit, not a majority).
  const words = contentWords(text).filter(w => w.length >= 4 && !WEAK_MATCH_WORDS.has(w))
  if (words.length === 0) return true
  const haystackWords = new Set(evidence.flatMap(e => contentWords(e.text)))
  const hits = words.filter(w => haystackWords.has(w)).length
  return hits / words.length >= minRatio
}

/**
 * Drops every item the app can't stand behind. Returns what survived, and
 * what didn't with the reason — the rejections are logged, not shown, but
 * they're the thing to look at when the lists come back thin.
 */
export function filterGrounded(
  items: RawItem[],
  evidence: Evidence[],
  projectTitle: string,
  /** evidence id -> the open task it was built from, for evidence that
   *  came from an open task. Absent for goal/closeout/fragment evidence,
   *  which isn't a task to mark done. */
  taskIdByEvidenceId: Record<string, string> = {},
): { kept: GroundedItem[]; rejected: { text: string; reason: string }[] } {
  const haystack = evidenceHaystack(evidence, projectTitle)
  const byId = new Map(evidence.map(e => [e.id, e]))
  const kept: GroundedItem[] = []
  const rejected: { text: string; reason: string }[] = []

  for (const item of items) {
    const text = item.text?.trim()
    if (!text) continue

    if (!hasOnlyKnownSpecifics(text, haystack)) {
      const unknown = extractSpecifics(text).filter(s => !haystack.includes(s.toLowerCase()))
      rejected.push({ text, reason: `invented: ${unknown.join(', ')}` })
      continue
    }

    const cited = (item.evidence ?? []).map(id => byId.get(id)).filter((e): e is Evidence => !!e)

    if (cited.length === 0) {
      // No citation is fine only for an item that asserts nothing about the
      // project beyond its own title.
      kept.push({ text, source: null, taskId: null })
      continue
    }

    const supporting = cited.find(e => citationSupports(text, e.text))
    if (!supporting) {
      rejected.push({ text, reason: `citation does not support it (${cited.map(c => c.id).join(', ')})` })
      continue
    }

    kept.push({ text, source: supporting.label, taskId: taskIdByEvidenceId[supporting.id] ?? null })
  }

  return { kept, rejected }
}
