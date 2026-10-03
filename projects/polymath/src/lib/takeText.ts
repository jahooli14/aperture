/**
 * Reading the standing line on the home card. Pure, no React.
 *
 * The mull channel shows a TAKE: facts side by side, then one claim with
 * no question mark, answered with a tap (yes / no / sort of). Older sparks
 * were questions and get "answer it". Which one it is is decided by the
 * LAST sentence only -- the facts quote their own words, and a quoted
 * "why bother?" in the middle doesn't make the claim a question.
 */

/** Sentence-sized pieces for the staggered reveal. Keeps the punctuation
 *  with its sentence; a line with no full stop is one piece. */
export function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g)?.map(t => t.trim()).filter(Boolean) ?? [text]
}

export function isTake(text: string): boolean {
  const parts = splitSentences(text.trim())
  return !(parts[parts.length - 1] ?? '').includes('?')
}
