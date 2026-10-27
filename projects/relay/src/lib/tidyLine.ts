/**
 * Print-only tidying. The lines on screen are exactly what was sent; the book
 * gets a capital at the start of each paragraph, because lines typed on a
 * phone often don't have one.
 *
 * Deliberately just that. Spelling, punctuation and wording are the writers'.
 * Skips words that are lowercase on purpose ("iPhone"), and lines that start
 * with a number.
 */
export function capitaliseOpening(body: string): string {
  return body.replace(/^([^\p{L}\p{N}]*)(\p{Ll})(?!\p{Lu})/u, (_, lead: string, letter: string) =>
    lead + letter.toLocaleUpperCase('en-GB')
  )
}
