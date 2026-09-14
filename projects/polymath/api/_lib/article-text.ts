/**
 * What an article's text actually is, in one place.
 *
 * `reading_queue.excerpt` is a UI field: the ingest caps it at 100
 * characters ("2 lines on mobile", api/reading.ts) and the real text lives
 * in `content` as HTML. Anything that reads an article and gets this wrong
 * is working from a feed blurb.
 *
 * That was true of the embeddings, which is worse than it sounds: every
 * feed article's vector was built from a title plus a hundred characters
 * of teaser, so `match_reading` was comparing questions against blurbs and
 * the reading half of the corpus retrieved close to noise. Three callers
 * built this string separately (the subject gatherer, the embed-on-save
 * path, the maintenance backfill) and only one of them knew.
 */

import { parseHTML } from 'linkedom'

/**
 * Roughly the model's input limit in characters.
 *
 * gemini-embedding-001 accepts 2048 tokens and silently truncates past it,
 * so the cut happens here instead — deliberate, and at a sane boundary.
 * ~4 chars per token is the usual English approximation.
 */
export const EMBED_CHAR_BUDGET = 8000

/**
 * Tags stripped AND entities decoded, via linkedom rather than a regex.
 * A regex strip leaves "isn&#8217;t" in the text handed to the model. The
 * model writes the entity decoded ("isn't"), the grounding gate does a
 * plain substring compare against the stored text, and the two never match
 * — so a real, correctly-quoted answer fails grounding and is thrown away
 * as invented.
 */
export function htmlToText(html: string): string {
  // Callers run this inside Promise.all alongside other gatherers, where an
  // uncaught throw loses every sibling rather than this one article.
  try {
    const { document } = parseHTML(`<div>${html}</div>`) as any
    // textContent concatenates every descendant text node with no idea
    // which tags are rendered, so it includes <script> and <style> bodies.
    document.querySelectorAll?.('script, style')?.forEach((el: any) => el.remove())
    const text = document.querySelector('div')?.textContent ?? ''
    return text.replace(/\s+/g, ' ').trim()
  } catch (e) {
    console.warn('[article-text] could not parse article HTML, falling back to excerpt:', e)
    return ''
  }
}

/**
 * The best available text for an article: the real content when there is
 * some, the excerpt only as a fallback. The 120-char floor is what
 * separates real content from an ingest artefact — a handful of characters
 * of stripped markup is not an article.
 */
export function articleBody(row: { excerpt?: string | null; content?: string | null }): string {
  const full = typeof row.content === 'string' ? htmlToText(row.content) : ''
  if (full.length > 120) return full
  return typeof row.excerpt === 'string' ? row.excerpt.trim() : ''
}

/**
 * What gets embedded for an article: the title, then as much of the real
 * text as the model will read. Title first because it survives truncation.
 */
export function articleEmbeddingText(
  row: { title?: string | null; excerpt?: string | null; content?: string | null },
  budget = EMBED_CHAR_BUDGET,
): string {
  const title = (row.title ?? '').trim()
  const body = articleBody(row)
  return `${title}\n\n${body}`.slice(0, budget).trim()
}
