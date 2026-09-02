/**
 * Cleaning model output into lines that can go on screen -- shared by the
 * spine, the session shaper, the split and the debrief. Pure, no IO.
 *
 * Structure does the thinking: the banned-verb list is enforced here, not
 * hoped for in the prompt, and anything the model returns is sanitised
 * down to plain lines before anything else looks at it.
 */

import { sharesSubstantialWording, type RawItem } from './session-grounding.js'

/**
 * Admin disguised as build (CLAUDE.md's anti-pattern). A session item has
 * to be something you DO to the work, not something you decide about it.
 * Checked after generation because the model agrees to this in the prompt
 * and then does it anyway.
 */
export const ADMIN_VERBS = [
  'research', 'plan', 'outline', 'decide', 'list', 'consider', 'review',
  'think about', 'set up', 'organise', 'organize', 'brainstorm', 'explore',
  'reflect on', 'assess', 'evaluate', 'identify', 'define',
]

export function isAdminItem(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/^[-*\d.\s)]+/, '')
  return ADMIN_VERBS.some(v => t.startsWith(v + ' ') || t === v)
}

/**
 * Model output -> a list you can put on screen. Strips bullet/number
 * prefixes, drops blanks, near-duplicates and admin items, trims anything
 * long enough to need re-reading mid-session, and caps at the count the
 * window allows.
 */
export function sanitizeRawItems(raw: unknown, count: number): RawItem[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: RawItem[] = []
  for (const entry of raw) {
    // Tolerate a bare string as well as the {text, evidence} shape -- an
    // uncited item is still checkable, it just has to survive on having no
    // specifics in it at all.
    const rawText = typeof entry === 'string' ? entry : entry?.text
    if (typeof rawText !== 'string') continue
    const text = rawText.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
    if (!text) continue
    if (text.length > 120) continue
    if (isAdminItem(text)) continue
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    const evidence = Array.isArray(entry?.evidence)
      ? entry.evidence.filter((x: unknown): x is string => typeof x === 'string')
      : undefined
    out.push({ text, evidence })
    if (out.length >= count) break
  }
  return out
}

/** Text-only view, for callers that just need clean lines. */
export function sanitizeItems(raw: unknown, count: number): string[] {
  return sanitizeRawItems(raw, count).map(i => i.text)
}

/**
 * A mechanical backstop against two items saying near enough the same
 * thing in different words. Uses sharesSubstantialWording, NOT
 * citationSupports: that accepts a single shared word (right for "does
 * this citation support this claim"), which would wrongly merge "Record
 * the vocal" and "Record the guitar solo". This needs most of the shorter
 * item's words to reappear. It still can't catch two items that mean the
 * same thing in completely different words -- that's the prompt's job.
 */
export function dedupeSimilar<T extends { text: string }>(items: T[], against: T[] = []): T[] {
  const seen = [...against]
  const out: T[] = []
  for (const item of items) {
    if (seen.some(s => sharesSubstantialWording(item.text, s.text))) continue
    seen.push(item)
    out.push(item)
  }
  return out
}
