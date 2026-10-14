/**
 * The season — what you've decided matters for a stretch of time.
 *
 * "Until Christmas, Going Analogue is main, Oscar's toy is second, and the
 * rest is for fun." Said once. The corpus then aims at it: takes about the
 * main project lead, the second comes next, and at least one in three
 * ignores your priorities so there is always something fun in the mix.
 *
 * Kept on the projects themselves, no new table: the main project is the
 * live one (state = 'live', as everywhere else), and a project's
 * `metadata.season = { role, until, label }` says what it's doing this
 * season. A season is over when its date passes; nothing is asked and
 * nothing is deleted, the projects just stop being weighted.
 */

import { normaliseTitle } from './mull-corpus.js'

export type SeasonRole = 'main' | 'also'

export interface SeasonTag {
  role: SeasonRole
  /** ISO date (YYYY-MM-DD) the season ends, or null for open-ended. */
  until: string | null
  label: string | null
}

export interface SeasonProject {
  id: string
  title: string
  status?: string | null
  state?: string | null
  is_priority?: boolean | null
  metadata?: unknown
}

export interface Season {
  main: { id: string; title: string } | null
  also: { id: string; title: string }[]
  until: string | null
  label: string | null
}

export const MAX_ALSO = 2
const DONE = new Set(['completed', 'archived', 'abandoned', 'graveyard'])

export function readSeasonTag(metadata: unknown): SeasonTag | null {
  const raw = (metadata as { season?: Partial<SeasonTag> } | null)?.season
  if (!raw || (raw.role !== 'main' && raw.role !== 'also')) return null
  return {
    role: raw.role,
    until: typeof raw.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.until) ? raw.until : null,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, 30) : null,
  }
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Still running: no end date, or the end date hasn't passed. */
export function inSeason(tag: SeasonTag | null, now: Date): boolean {
  return !!tag && (!tag.until || tag.until >= isoDay(now))
}

/**
 * The season as it stands today. The main project is the live one, so
 * this always agrees with the home card. Projects tagged `also` count only
 * while their date holds, and only the first two.
 */
export function readSeason(projects: SeasonProject[], now = new Date()): Season {
  const open = projects.filter(p => !DONE.has(p.status ?? '') && p.state !== 'harvested')
  const live = open.find(p => p.state === 'live') ?? open.find(p => p.is_priority) ?? null
  if (!live) return { main: null, also: [], until: null, label: null }
  const mainTag = readSeasonTag(live.metadata)
  const running = inSeason(mainTag, now)
  const also = open
    .filter(p => p.id !== live.id)
    .filter(p => { const t = readSeasonTag(p.metadata); return t?.role === 'also' && inSeason(t, now) })
    .slice(0, MAX_ALSO)
    .map(p => ({ id: p.id, title: p.title }))
  return {
    main: { id: live.id, title: live.title },
    also,
    until: running && mainTag ? mainTag.until : null,
    label: running && mainTag ? mainTag.label : null,
  }
}

/**
 * Roughly one run in three leads with something fun instead of the main
 * project. Decided by the day, not stored: nothing to keep in step.
 */
export function leadsWithFun(now: Date): boolean {
  return Math.floor(now.getTime() / 86_400_000) % 3 === 2
}

// ─── Saying it out loud ───────────────────────────────────────────────

export interface Proposal {
  main: { id: string; title: string } | null
  also: { id: string; title: string }[]
  until: string | null
  label: string | null
}

export function buildSeasonPrompt(said: string, projects: { title: string }[], today: string): string {
  return `Someone is telling their creative app what matters for the next stretch of time.
Read what they said and pull out: which project is the MAIN one, up to ${MAX_ALSO}
others that matter too, and when the stretch ends.

Today is ${today}.

Their projects (use these titles exactly, copy them character for character):
${projects.map(p => `- ${p.title}`).join('\n')}

What they said:
"${said.replace(/"/g, "'").slice(0, 1200)}"

Return JSON only:
{ "main": "exact title or null", "also": ["exact title"], "until": "YYYY-MM-DD or null", "label": "2-3 words or null" }

Rules:
- Only titles from the list. If they name something that isn't there, leave it out.
- "main" is the one they call the focus, the priority, the main thing. If they name only one, it is the main.
- "until": turn "Christmas" into 25 December, "end of the year" into 31 December, "the summer" into 31 August,
  using the next one that hasn't passed. null if they gave no time.
- "label": what they'd call the stretch, like "Christmas". null if they didn't.
- Don't add anything they didn't say.`
}

/**
 * Read the model's answer, keeping only what is real: titles that match a
 * project exactly, a date that is a date and hasn't passed, a short label.
 * Nothing is invented to fill a gap.
 */
export function parseSeasonProposal(raw: string, projects: { id: string; title: string }[], today: string): Proposal | null {
  let parsed: any
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const byTitle = new Map(projects.map(p => [normaliseTitle(p.title), p]))
  const find = (t: unknown) => (typeof t === 'string' ? byTitle.get(normaliseTitle(t)) : undefined)

  const main = find(parsed.main) ?? null
  const also: { id: string; title: string }[] = []
  for (const t of Array.isArray(parsed.also) ? parsed.also : []) {
    const p = find(t)
    if (p && p.id !== main?.id && !also.some(a => a.id === p.id)) also.push({ id: p.id, title: p.title })
    if (also.length >= MAX_ALSO) break
  }
  const until = typeof parsed.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.until)
    && !Number.isNaN(new Date(parsed.until).getTime()) && parsed.until >= today
    ? parsed.until : null
  const label = typeof parsed.label === 'string' && parsed.label.trim() ? parsed.label.trim().slice(0, 30) : null

  if (!main && also.length === 0) return null
  return { main: main ? { id: main.id, title: main.title } : null, also, until, label }
}
