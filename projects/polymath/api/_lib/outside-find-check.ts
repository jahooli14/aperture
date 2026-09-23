/**
 * The honesty checks for an outside find (outside-find.ts). Pure, so the
 * rules that decide what's allowed onto the screen are tested on their own.
 *
 * A find is only worth showing if it's real. The model is asked to search,
 * but asking isn't checking: every find is read back from the page it
 * names, and anything that doesn't hold up is dropped. Silence beats a
 * made-up reference.
 */

import { findVoiceViolations } from './plain-english.js'
import { parseModelJson } from './schemas.js'

export type FindKind = 'technique' | 'maker' | 'work'

export interface Find {
  title: string
  kind: FindKind
  why: string
  url: string
}

export const TITLE_MAX = 120
export const WHY_MAX_WORDS = 30

const KINDS: readonly FindKind[] = ['technique', 'maker', 'work']

// Roundups are the opposite of one specific thing.
const LISTICLE = /\b(top|best)[-_ ]?\d+\b|\b\d+[-_ ](best|ways|tips|things|ideas)\b/i

/** Reads the model's answer. `null` for "nothing worth showing" or junk. */
export function parseFind(text: string): { find: Find | null; reason: string } {
  let raw: unknown
  try {
    raw = parseModelJson(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
  } catch {
    return { find: null, reason: 'unreadable answer' }
  }
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (r.none === true) return { find: null, reason: 'model found nothing worth showing' }

  const title = typeof r.title === 'string' ? r.title.trim() : ''
  const why = typeof r.why === 'string' ? r.why.trim() : ''
  const url = typeof r.url === 'string' ? r.url.trim() : ''
  const kind = KINDS.find(k => k === r.kind)

  if (!title || title.length > TITLE_MAX) return { find: null, reason: 'no usable title' }
  if (!kind) return { find: null, reason: `unknown kind: ${String(r.kind)}` }
  if (!why) return { find: null, reason: 'no reason given' }
  if (why.split(/\s+/).length > WHY_MAX_WORDS) return { find: null, reason: 'reason too long' }
  const voice = findVoiceViolations(`${title} ${why}`)
  if (voice.length > 0) return { find: null, reason: `voice: ${voice.join(', ')}` }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { find: null, reason: 'no usable link' }
  }
  if (parsed.protocol !== 'https:') return { find: null, reason: 'link is not https' }
  if (LISTICLE.test(title) || LISTICLE.test(parsed.pathname)) return { find: null, reason: 'a roundup, not one thing' }

  return { find: { title, kind, why, url: parsed.toString() }, reason: 'ok' }
}

/** Visible text of an HTML page, roughly. Enough to check a name is on it. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const STOP = new Set(['with', 'from', 'that', 'this', 'your', 'into', 'about', 'their', 'what', 'when', 'how'])

/** The words in a title that would have to be on a page about it. */
export function keyWords(title: string): string[] {
  return fold(title)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !STOP.has(w))
}

/**
 * Is the page about the thing? At least half the title's key words have to
 * be on it (and at least one). A made-up link that happens to resolve —
 * a homepage, a search page — fails here.
 */
export function pageMentions(title: string, pageText: string): boolean {
  const words = keyWords(title)
  const page = fold(pageText)
  if (words.length === 0) return page.includes(fold(title).trim())
  const found = words.filter(w => page.includes(w)).length
  return found >= Math.max(1, Math.ceil(words.length / 2))
}
