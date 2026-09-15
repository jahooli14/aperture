/**
 * Which articles are allowed to influence what the app says.
 *
 * Before this existed, every row in `reading_queue` counted as corpus —
 * including the twenty unread RSS headlines that arrived overnight and
 * were never opened. That made the identity signal meaningless: a feed
 * you subscribed to once was indistinguishable from a book you loved.
 *
 * The signal is explicit and it is the only one. At the end of an article
 * the reader asks one question with two answers: "This was good" or "Not
 * for me". Only "good" lets the article in. Opening it, saving it, filing
 * it and archiving it are all things you do BEFORE you know what it says.
 */

export type Resonance = 'good' | 'not_for_me'

/** The subset of an article row this module needs. */
export interface CorpusArticle {
  resonance?: string | null
  tags?: string[] | null
  status?: string | null
}

/**
 * True when this article should be read as part of the user's corpus —
 * eligible to shape project ideas, syntheses, sparks and embeddings.
 *
 * The verdict, and nothing else. You get to the end of an article and say
 * whether it was any good; that answer is the whole gate.
 *
 * Two weaker rules were tried and both were wrong. "Undecided but you
 * opened it" let two archived articles into a question the owner did not
 * recognise — and `read_at`, which that rule leaned on, is stamped by any
 * path that sets status to 'reading', including the right-swipe that means
 * "put this in my list" rather than "I read this". A filing gesture is not
 * a verdict. The legacy hand-saved carve-out (no `rss` tag) went with it:
 * saving something is an intention to read, not a judgement of what it
 * turned out to say.
 *
 * This is deliberately strict, and the cost is real: it empties the
 * reading input until articles get voted on. That is the owner's call —
 * an article that shapes what the app says back to you should be one you
 * finished and vouched for.
 */
export function isCorpusEligible(row: CorpusArticle): boolean {
  return row.resonance === 'good'
}

/**
 * How strongly it counts. One tier now that only a vouched-for article is
 * eligible at all; kept because callers order on it.
 */
export function corpusWeight(row: CorpusArticle): number {
  return isCorpusEligible(row) ? 2 : 0
}

/**
 * The eligible rows, in the order they arrived (callers fetch
 * newest-first). There is one tier now, so there is nothing to reorder.
 */
export function selectCorpusArticles<T extends CorpusArticle>(rows: T[]): T[] {
  return rows.filter(isCorpusEligible)
}

/** One-line label for prompt context. Everything eligible is vouched for
 *  now, so this says so. */
export function corpusLabel(row: CorpusArticle): string {
  return row.resonance === 'good' ? ' (they marked this one good)' : ''
}
