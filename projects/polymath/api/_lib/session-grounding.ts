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
])

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

/**
 * The same loose check verifyCitations uses on morph proposals: the cited
 * evidence has to genuinely share vocabulary with the claim, so a model
 * can't point at an unrelated note to make an invention look sourced.
 */
export function citationSupports(itemText: string, evidenceText: string): boolean {
  const claim = contentWords(itemText)
  const source = new Set(contentWords(evidenceText))
  if (claim.length === 0 || source.size === 0) return false
  const hits = claim.filter(w => source.has(w)).length
  return hits >= 2
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
      kept.push({ text, source: null })
      continue
    }

    const supporting = cited.find(e => citationSupports(text, e.text))
    if (!supporting) {
      rejected.push({ text, reason: `citation does not support it (${cited.map(c => c.id).join(', ')})` })
      continue
    }

    kept.push({ text, source: supporting.label })
  }

  return { kept, rejected }
}
