/**
 * Themes — what an active project is steering by, kept for weeks.
 *
 * The one next move (next-move.ts) is rewritten at close-out, and close-out
 * only happens when the session runs in the app. On a project you work on
 * off-app — a book you rewrite with the phone face-down — the move is out
 * of date after one session and stays that way. Themes sit a level above
 * it ("every chapter in the new voice", "the ending doesn't land yet"), so
 * they stay true across many sessions and nothing has to keep them current.
 *
 * Kept in step with the notes (Oct 2026, the owner's call): lines that never
 * changed made the whole card look dead, "which defeats the whole point".
 * When new notes land under a project, the lines are re-read against them:
 * kept if the notes still back them, reworded or swapped if the notes say it
 * has moved on. The old lines are kept for an Undo. Never from nothing: a
 * project with no lines is not given any behind the owner's back.
 *
 * Pure except nothing — the route does the reads and writes.
 */

import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './plain-english.js'
import { citationSupports, evidenceHaystack, hasOnlyKnownSpecifics, type Evidence } from './session-grounding.js'

export const MAX_THEMES = 3
export const MAX_THEME_CHARS = 100
/** A project with a session or any activity this recently is being worked
 *  on: the home card shows its themes instead of the move. Past this it's
 *  gone quiet, and the move (a way back in) is the more useful thing. */
export const ACTIVE_WITHIN_DAYS = 14

export interface ProjectTheme {
  text: string
  /** When this wording was set. Unchanged text keeps its date. */
  at: string
}

export function readThemes(metadata: unknown): ProjectTheme[] {
  const raw = (metadata as { themes?: unknown } | null)?.themes
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is ProjectTheme => !!t && typeof (t as ProjectTheme).text === 'string' && !!(t as ProjectTheme).text.trim())
    .slice(0, MAX_THEMES)
}

/**
 * What the user sent, made safe to store: trimmed, de-duplicated, capped.
 * A theme whose text didn't change keeps its old date, so "from 21 Sep"
 * stays honest after an unrelated edit to another theme.
 */
export function normalizeThemes(input: unknown, previous: ProjectTheme[], now = new Date()): ProjectTheme[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: ProjectTheme[] = []
  for (const item of input) {
    const text = typeof item === 'string' ? item : (item as { text?: unknown })?.text
    if (typeof text !== 'string') continue
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_THEME_CHARS)
    const key = clean.toLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    const kept = previous.find(p => p.text.trim().toLowerCase() === key)
    out.push({ text: clean, at: kept?.at ?? now.toISOString() })
    if (out.length >= MAX_THEMES) break
  }
  return out
}

/** Being worked on right now, by the newest of the dates we have. */
export function isActivelyWorked(
  dates: Array<string | null | undefined>,
  now = new Date(),
): boolean {
  const newest = Math.max(...dates.map(d => (d ? new Date(d).getTime() : 0)).filter(n => Number.isFinite(n)), 0)
  if (!newest) return false
  return now.getTime() - newest < ACTIVE_WITHIN_DAYS * 86_400_000
}

export function buildThemesPrompt(input: {
  title: string
  description: string | null
  evidence: Evidence[]
}): string {
  const rows = input.evidence.map(e => `[${e.id}] (${e.label}) ${e.text}`).join('\n')
  return `Someone is working on a creative project. Read what they've said about it and name
the 2 or 3 big things they are steering by. Things that stay true for weeks, across
many sessions — not today's step.

Project: "${input.title}"
${input.description ? `What it is: ${input.description}\n` : ''}
What they've said about it:
${rows}

GOOD themes (short, in their words, last for weeks):
- "Every chapter in the new voice"
- "The ending doesn't land yet"
- "Cut anything that only explains"

BAD themes:
- "Write chapter 4 tonight" — a single step, out of date tomorrow.
- "Explore the emotional depth of the narrative" — vague, not something they said.
- "Stay consistent" — true of every project, says nothing.

Rules:
- Each theme must come from something above. Cite the row it came from by its id.
- Under 10 words. Use their words where you can.
- Name nothing (people, places, tools, numbers) that the rows don't name.
- Fewer is fine. If nothing above is a real theme, return an empty list.

${PLAIN_ENGLISH_RULES}

Return JSON only:
{ "themes": [ { "text": "...", "from": "ROW_ID" } ] }`
}

/**
 * Keeps only themes that are honest: cite a real row that actually shares
 * their wording, name nothing the evidence doesn't, and pass the voice
 * check. Same cite-or-stay-silent rule as the move and the sparks.
 */
export function parseThemeDraft(raw: string, evidence: Evidence[], title: string): string[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  const list = (parsed as { themes?: unknown })?.themes
  if (!Array.isArray(list)) return []
  const haystack = evidenceHaystack(evidence, title)
  const out: string[] = []
  for (const item of list) {
    const text = typeof item?.text === 'string' ? item.text.replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '') : ''
    if (!text || text.length > MAX_THEME_CHARS) continue
    if (text.split(/\s+/).length > 14) continue
    const row = evidence.find(e => e.id === item?.from)
    if (!row || !citationSupports(text, row.text)) continue
    if (!hasOnlyKnownSpecifics(text, haystack)) continue
    if (findVoiceViolations(text).length > 0) continue
    if (out.some(t => t.toLowerCase() === text.toLowerCase())) continue
    out.push(text)
    if (out.length >= MAX_THEMES) break
  }
  return out
}


/** A fingerprint of the notes the lines were last read against. Not "the
 *  newest date": a note said on the page is linked a moment after it is
 *  saved, so a date check can miss it for good. */
export function materialSignature(rows: Array<{ text: string; at: string }>): string {
  const basis = rows.slice(0, 12).map(r => `${r.at.slice(0, 10)}|${r.text.slice(0, 60)}`).join('\n')
  let h = 5381
  for (let i = 0; i < basis.length; i++) h = ((h * 33) ^ basis.charCodeAt(i)) >>> 0
  return `${rows.length}:${h.toString(36)}`
}

/** What the notes were last read against, and the lines that were replaced. */
export interface ThemesUpdate { at: string; previous: string[] }

export function readThemesUpdate(metadata: unknown): ThemesUpdate | null {
  const raw = (metadata as { themes_update?: unknown } | null)?.themes_update as Partial<ThemesUpdate> | undefined
  if (!raw || typeof raw.at !== 'string' || !Array.isArray(raw.previous)) return null
  return { at: raw.at, previous: raw.previous.filter((t): t is string => typeof t === 'string').slice(0, MAX_THEMES) }
}

export function buildThemesRefreshPrompt(input: {
  title: string
  description: string | null
  current: string[]
  evidence: Evidence[]
}): string {
  const rows = input.evidence.map(e => `[${e.id}] (${e.label}) ${e.text}`).join('\n')
  return `Someone is working on a creative project. These are the big things they were
steering by:

${input.current.map(t => `- ${t}`).join('\n')}

Below is what they have said about it, newest first. Say what they are steering by NOW.

Project: "${input.title}"
${input.description ? `What it is: ${input.description}\n` : ''}
What they've said about it:
${rows}

Rules:
- Keep a line exactly as written when the notes still back it. Most of the time most lines stay.
- Reword or replace a line only when a newer note shows it has been done, dropped or has changed. Add one only when a newer note shows a new big thing.
- Things that stay true for weeks, not today's step. Under 10 words, in their words.
- Each new or reworded line cites the row it came from by id. A kept line needs no row.
- Name nothing (people, places, tools, numbers) that the rows don't name.
- 2 or 3 lines. If nothing has changed, return the same lines.

${PLAIN_ENGLISH_RULES}

Return JSON only:
{ "themes": [ { "text": "...", "from": "ROW_ID or KEPT" } ] }`
}

/**
 * The lines after a re-read. A line identical to a current one is kept
 * without a citation (it passed the gates when it was written); anything new
 * must cite a real row, share its wording, name nothing the notes don't, and
 * pass the voice check, same as a first draft.
 */
export function parseThemeRefresh(raw: string, evidence: Evidence[], title: string, current: string[]): string[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  const list = (parsed as { themes?: unknown })?.themes
  if (!Array.isArray(list)) return []
  const known = new Set(current.map(t => t.trim().toLowerCase()))
  const haystack = evidenceHaystack(evidence, title)
  const out: string[] = []
  for (const item of list) {
    const text = typeof item?.text === 'string' ? item.text.replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '') : ''
    if (!text || text.length > MAX_THEME_CHARS) continue
    if (out.some(t => t.toLowerCase() === text.toLowerCase())) continue
    if (!known.has(text.toLowerCase())) {
      if (text.split(/\s+/).length > 14) continue
      const row = evidence.find(e => e.id === item?.from)
      if (!row || !citationSupports(text, row.text)) continue
      if (!hasOnlyKnownSpecifics(text, haystack)) continue
      if (findVoiceViolations(text).length > 0) continue
    }
    out.push(text)
    if (out.length >= MAX_THEMES) break
  }
  return out
}
