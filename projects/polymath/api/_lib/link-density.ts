/**
 * "So many links it's basically unreadable" — the fix.
 *
 * Extraction (Readability, or Jina's markdown converted to HTML) sometimes
 * keeps DOM that lives inside the article's content column but isn't
 * prose: "Related stories," a tag-cloud footer, a "More from this author"
 * rail, reference lists. None of that is caught by cleanHtml's selector
 * denylist because it has no distinguishing class name — the only thing
 * that marks it is that it's ALMOST ENTIRELY LINKS, which is exactly the
 * heuristic real extractors (Arc90/Readability's own link-density check,
 * Boilerpipe) use.
 *
 * Two passes, applied to a parsed document in place:
 *  1. Any block (p/li/td/blockquote) where most of the text lives inside
 *     two or more <a> tags — a real inline citation is one link in a
 *     sentence, not the whole sentence being links.
 *  2. Any list where every item is nothing but a single link — a nav
 *     menu or "more from this author" rail, which individually might
 *     dodge pass 1 (short link text keeps density low) but is
 *     unmistakable as a whole list.
 *
 * Pure DOM traversal — no dependency on which parser built the document,
 * so it works the same whether the caller is running linkedom (serverless)
 * or jsdom (tests).
 */

const LINK_DENSITY_THRESHOLD = 0.6
const BLOCK_SELECTOR = 'p, li, td, blockquote'
const MIN_LINKS_FOR_DENSITY_CHECK = 2
const MIN_LIST_ITEMS_FOR_NAV_CHECK = 3

interface MinimalElement {
  tagName?: string
  textContent: string | null
  children?: ArrayLike<MinimalElement>
  querySelectorAll(selector: string): ArrayLike<MinimalElement>
  remove(): void
}

interface MinimalDocument {
  querySelectorAll(selector: string): ArrayLike<MinimalElement>
}

function textLength(el: MinimalElement): number {
  return (el.textContent || '').trim().length
}

/** Pass 1: strip blocks that are mostly links rather than prose. */
export function stripLinkDenseBlocks(document: MinimalDocument): number {
  let removed = 0
  Array.from(document.querySelectorAll(BLOCK_SELECTOR)).forEach((el) => {
    const links = Array.from(el.querySelectorAll('a'))
    if (links.length < MIN_LINKS_FOR_DENSITY_CHECK) return

    const total = textLength(el)
    if (total === 0) return

    const linked = links.reduce((sum, a) => sum + textLength(a), 0)
    if (linked / total >= LINK_DENSITY_THRESHOLD) {
      el.remove()
      removed++
    }
  })
  return removed
}

/** Pass 2: strip lists where every item IS a link, nothing else. */
export function stripLinkOnlyLists(document: MinimalDocument): number {
  let removed = 0
  Array.from(document.querySelectorAll('ul, ol')).forEach((el) => {
    const items = Array.from(el.children ?? []).filter((c) => c.tagName?.toLowerCase() === 'li')
    if (items.length < MIN_LIST_ITEMS_FOR_NAV_CHECK) return

    const allLinkOnly = items.every((li) => {
      const links = Array.from(li.querySelectorAll('a'))
      if (links.length !== 1) return false
      const linkText = textLength(links[0])
      // Allow a couple of stray characters (bullet punctuation, a
      // trailing arrow) — this only fires when the item is basically
      // nothing BUT the link.
      return linkText > 0 && textLength(li) - linkText <= 3
    })

    if (allLinkOnly) {
      el.remove()
      removed++
    }
  })
  return removed
}

/** Run both passes. Order matters: list-level check first would miss
 *  nothing here since the two heuristics target different shapes, but
 *  block-density first means a dense paragraph inside a list item that
 *  ISN'T a pure-link list still gets a chance to be cleaned on its own. */
export function stripLinkFarms(document: MinimalDocument): void {
  stripLinkDenseBlocks(document)
  stripLinkOnlyLists(document)
}
