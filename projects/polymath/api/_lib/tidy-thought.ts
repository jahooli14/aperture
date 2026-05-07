/**
 * Tidy a voice-transcript thought before saving.
 *
 * The transcribe step gives us the raw text including every "um" and "uh"
 * the user said. Reading those back later is grating and hides the
 * substance. We strip a conservative set of filler words and clean up the
 * leftover punctuation.
 *
 * Conservative on purpose: this runs on every captured thought and on
 * every backfilled memory, so a false positive (stripping a real word)
 * is worse than a false negative (leaving a filler in). We only touch
 * tokens that are *unambiguously* fillers — never "like" or "actually,"
 * which carry real meaning in normal sentences.
 *
 * Targeted fillers:
 *   - um, umm, ummm
 *   - uh, uhh, uhhh
 *   - uhm, uhmm
 *   - er (when standalone, not part of another word)
 *   - erm
 *   - hmm, hmmm
 *   - ah (when standalone hesitation, not exclamation context)
 *
 * The function preserves capitalisation of surrounding words and joins
 * sentences cleanly so a stripped filler at the start of a sentence
 * doesn't leave a lowercase first word or a dangling comma.
 */

const FILLERS = [
  'um+', 'uh+', 'uhm+', 'erm', 'er', 'hmm+', 'ah',
]

// Match a filler that's a standalone word, optionally preceded by a
// space and optionally followed by a comma + space. The capture groups
// let us collapse the surrounding whitespace cleanly.
const FILLER_RE = new RegExp(
  `(?:^|\\s|[,;—–-])(?:${FILLERS.join('|')})(?=$|[\\s,.;:!?—–-])`,
  'gi',
)

// Multiple consecutive whitespace characters → single space.
const MULTI_SPACE_RE = /\s+/g

// Clean up dangling commas / leading punctuation after fillers are
// removed (e.g. "Um, the thing is" → ", the thing is" → "The thing is").
const LEADING_PUNCT_RE = /^[\s,;:.\-—–]+/
const ORPHAN_COMMA_RE = /\s+,/g
const DOUBLE_PUNCT_RE = /([,.;:!?])\s*\1+/g

export function tidyThought(input: string | null | undefined): string {
  if (!input) return ''
  let out = input

  // Strip fillers, preserving the leading character if it was a space or
  // punctuation (we replace the whole match with whatever delimiter the
  // user had — usually a space — so word boundaries stay clean).
  out = out.replace(FILLER_RE, (match) => {
    const lead = match[0]
    return /\s/.test(lead) ? ' ' : lead === ',' || lead === ';' ? lead : ''
  })

  // Collapse leftover whitespace and punctuation noise.
  out = out
    .replace(ORPHAN_COMMA_RE, ',')
    .replace(DOUBLE_PUNCT_RE, '$1')
    .replace(MULTI_SPACE_RE, ' ')

  // Walk sentence-by-sentence to fix up leading punctuation + capitalise
  // the first letter of each sentence after we've removed leading
  // fillers. Sentences split on . ! ? followed by space.
  const sentences = out.split(/([.!?]\s+)/)
  const fixed: string[] = []
  for (const part of sentences) {
    if (/^[.!?]\s+$/.test(part)) {
      fixed.push(part)
      continue
    }
    let s = part.replace(LEADING_PUNCT_RE, '')
    if (s.length > 0) {
      s = s[0].toUpperCase() + s.slice(1)
    }
    fixed.push(s)
  }

  return fixed.join('').trim()
}
