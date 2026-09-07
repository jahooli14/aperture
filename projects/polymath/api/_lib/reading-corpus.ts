/**
 * Which articles are allowed to influence what the app says.
 *
 * Before this existed, every row in `reading_queue` counted as corpus —
 * including the twenty unread RSS headlines that arrived overnight and
 * were never opened. That made the identity signal meaningless: a feed
 * you subscribed to once was indistinguishable from a book you loved.
 *
 * The signal is now explicit. At the end of an article the reader asks
 * one question with two answers: "This was good" or "Not for me". Only
 * "good" lets the article in.
 *
 * Legacy rows have no verdict, so the rule has one carve-out: an article
 * the user *saved by hand* (no `rss` tag) still counts, as it did before.
 * Saving something deliberately was always a signal; it just wasn't the
 * only one. An RSS item with no verdict counts for nothing.
 */

export type Resonance = 'good' | 'not_for_me'

/** The subset of an article row this module needs. */
export interface CorpusArticle {
  resonance?: string | null
  tags?: string[] | null
  status?: string | null
}

const RSS_TAG = 'rss'

function isFromFeed(row: CorpusArticle): boolean {
  return Array.isArray(row.tags) && row.tags.includes(RSS_TAG)
}

/**
 * True when this article should be read as part of the user's corpus —
 * eligible to shape project ideas, syntheses, sparks and embeddings.
 */
export function isCorpusEligible(row: CorpusArticle): boolean {
  if (row.resonance === 'not_for_me') return false
  if (row.resonance === 'good') return true
  // No verdict: only hand-saved articles carry the old implicit signal.
  return !isFromFeed(row)
}

/**
 * How strongly it counts. An explicit "this was good" outranks a legacy
 * hand-save, so prompts can lead with what the user actually vouched for
 * instead of whatever happens to be newest.
 */
export function corpusWeight(row: CorpusArticle): number {
  if (!isCorpusEligible(row)) return 0
  return row.resonance === 'good' ? 2 : 1
}

/**
 * Filter + order in one pass: eligible rows only, vouched-for first,
 * input order preserved within each tier (callers fetch newest-first).
 */
export function selectCorpusArticles<T extends CorpusArticle>(rows: T[]): T[] {
  const vouched: T[] = []
  const implicit: T[] = []
  for (const row of rows) {
    const weight = corpusWeight(row)
    if (weight === 2) vouched.push(row)
    else if (weight === 1) implicit.push(row)
  }
  return [...vouched, ...implicit]
}

/**
 * One-line label for prompt context, so the model can tell "they said this
 * was good" from "this was sitting in their saved list". Empty string for
 * the implicit tier — nothing worth spending tokens on.
 */
export function corpusLabel(row: CorpusArticle): string {
  return row.resonance === 'good' ? ' (they marked this one good)' : ''
}
