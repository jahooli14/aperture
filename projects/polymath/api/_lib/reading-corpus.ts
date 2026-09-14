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
  /** Set the moment the article is opened in the reader (api/reading.ts). */
  read_at?: string | null
}

const RSS_TAG = 'rss'

function isFromFeed(row: CorpusArticle): boolean {
  return Array.isArray(row.tags) && row.tags.includes(RSS_TAG)
}

/**
 * Did the user actually open this one?
 *
 * `read_at` only, and deliberately not `status`. Status looks like it says
 * this and doesn't: the right-swipe on New reads sets 'reading' to mean "I
 * want this in my list" (its own comment says it hasn't been read), and
 * the left-swipe on Saved reads sets 'archived' without opening anything.
 * Both are filing gestures. `read_at` is stamped in one place only — the
 * reader actually loading the article.
 */
function wasOpened(row: CorpusArticle): boolean {
  return !!row.read_at
}

/**
 * True when this article should be read as part of the user's corpus —
 * eligible to shape project ideas, syntheses, sparks and embeddings.
 *
 * Opening one counts, and that is the difference between a corpus and an
 * empty set. The rule used to be the verdict or nothing (plus the legacy
 * hand-save carve-out), which reads well and in practice meant a live
 * corpus of 198 articles and zero of them counting, because the buttons
 * sit at the END of an article and most reads don't get tapped. What the
 * rule was built to exclude is the twenty headlines that arrive overnight
 * and are never touched -- and those are still excluded, because they
 * were never opened. Choosing one out of the feed and reading it is a
 * real signal; it just isn't as strong as saying so, which is what
 * corpusWeight is for.
 */
export function isCorpusEligible(row: CorpusArticle): boolean {
  if (row.resonance === 'not_for_me') return false
  if (row.resonance === 'good') return true
  // No verdict: a hand-save carries the old implicit signal, and opening
  // a feed item is the user picking it out of the pile themselves.
  return !isFromFeed(row) || wasOpened(row)
}

/**
 * How strongly it counts. An explicit "this was good" outranks a legacy
 * hand-save or an article merely opened, so prompts can lead with what
 * the user actually vouched for instead of whatever happens to be newest.
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
