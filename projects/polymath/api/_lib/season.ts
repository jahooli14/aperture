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

export type SmallSize = 'hours' | 'weekend'

export interface SeasonTag {
  role: SeasonRole
  /** ISO date (YYYY-MM-DD) the season ends, or null for open-ended. */
  until: string | null
  label: string | null
  /** A small finish: "a few hours" or "a weekend". Never asked for. */
  size?: SmallSize | null
  /** Can't start until this day ("when the wood arrives"). */
  from?: string | null
  /** What it's waiting on, in their words. Cleared with one tap. */
  waiting?: string | null
}

export interface SeasonAlso {
  id: string
  title: string
  size: SmallSize | null
  /** Can't be started yet. Worked out when read, never stored. */
  blocked: boolean
  waiting: string | null
  from: string | null
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
  also: SeasonAlso[]
  until: string | null
  label: string | null
  /** A season has actually been set and is still running. A live project
   *  with no season is just a live project: nothing season-shaped (the
   *  order of takes, the wild one) applies to it. */
  active: boolean
}

export const MAX_ALSO = 3
const DONE = new Set(['completed', 'archived', 'abandoned', 'graveyard'])

export function readSeasonTag(metadata: unknown): SeasonTag | null {
  const raw = (metadata as { season?: Partial<SeasonTag> } | null)?.season
  if (!raw || (raw.role !== 'main' && raw.role !== 'also')) return null
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const waiting = typeof raw.waiting === 'string' && raw.waiting.trim() ? raw.waiting.trim().slice(0, 40) : null
  return {
    role: raw.role,
    until: day(raw.until),
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, 30) : null,
    size: raw.size === 'hours' || raw.size === 'weekend' ? raw.size : null,
    from: day(raw.from),
    waiting,
  }
}

/** Can't be started yet: it names something it's waiting on, or its start
 *  date hasn't come. Worked out each time it's read, so nothing has to be
 *  cleared when the day arrives. */
export function isBlocked(tag: SeasonTag | null, now: Date): boolean {
  if (!tag) return false
  if (tag.waiting) return true
  return !!tag.from && tag.from > isoDay(now)
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** A real calendar date, not just something shaped like one ("2026-02-31"). */
export function isRealDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Still running: no end date, or the end date hasn't passed. The server
 *  counts days in UTC and the person lives in a timezone, so the last day
 *  gets a 14-hour grace: it is never cut short anywhere on earth. */
export function inSeason(tag: SeasonTag | null, now: Date): boolean {
  return !!tag && (!tag.until || tag.until >= isoDay(new Date(now.getTime() - 14 * 3_600_000)))
}

/** Words that tell someone to go and make the thing. A project that can't be
 *  started yet (waiting on wood, on a person) can be thought about, never
 *  "start on it tonight". Checked, not just asked for. */
const MAKING = /\b(cut|saw|sand|drill|glue|paint|build|make|start|begin|finish|do|try|test|print|order|buy|tonight|today|this weekend|right now|next session)\b/i
export function tellsToStartNow(stake: string, take: string): boolean {
  return MAKING.test(stake) || MAKING.test(take)
}

/**
 * The season as it stands today. The main project is the live one, so
 * this always agrees with the home card. Projects tagged `also` count only
 * while their date holds, and only the first three.
 */
export function readSeason(projects: SeasonProject[], now = new Date()): Season {
  const open = projects.filter(p => !DONE.has(p.status ?? '') && p.state !== 'harvested')
  const live = open.find(p => p.state === 'live') ?? open.find(p => p.is_priority) ?? null
  if (!live) return { main: null, also: [], until: null, label: null, active: false }
  const mainTag = readSeasonTag(live.metadata)
  const running = inSeason(mainTag, now)
  const also = open
    .filter(p => p.id !== live.id)
    .filter(p => { const t = readSeasonTag(p.metadata); return t?.role === 'also' && inSeason(t, now) })
    .slice(0, MAX_ALSO)
    .map((p): SeasonAlso => {
      const t = readSeasonTag(p.metadata)
      return {
        id: p.id, title: p.title, size: t?.size ?? null,
        blocked: isBlocked(t, now), waiting: t?.waiting ?? null, from: t?.from ?? null,
      }
    })
  return {
    main: { id: live.id, title: live.title },
    also,
    until: running && mainTag ? mainTag.until : null,
    label: running && mainTag ? mainTag.label : null,
    active: (!!mainTag && running) || also.length > 0,
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

export interface ProposalAlso {
  id: string
  title: string
  size: SmallSize | null
  waiting: string | null
  from: string | null
}

export interface Proposal {
  main: { id: string; title: string } | null
  also: ProposalAlso[]
  until: string | null
  label: string | null
}

export function buildSeasonPrompt(said: string, projects: { title: string }[], today: string): string {
  return `Someone is telling their creative app what matters for the next stretch of time.
Read what they said and pull out: which project is the MAIN one, up to ${MAX_ALSO}
smaller ones to finish too, and when the stretch ends.

Today is ${today}.

Their projects (use these titles exactly, copy them character for character):
${projects.map(p => `- ${p.title}`).join('\n')}

What they said:
"${said.replace(/"/g, "'").slice(0, 1200)}"

Return JSON only:
{ "main": "exact title or null",
  "also": [{ "title": "exact title", "size": "hours | weekend | null", "waiting": "short phrase or null", "from": "YYYY-MM-DD or null" }],
  "until": "YYYY-MM-DD or null", "label": "2-3 words or null" }

Rules:
- Only titles from the list. If they name something that isn't there, leave it out.
- "main" is the one they call the focus, the priority, the main thing. If they name only one, it is the main.
- "until": turn "Christmas" into 25 December, "end of the year" into 31 December, "the summer" into 31 August,
  using the next one that hasn't passed. null if they gave no time.
- "label": what they'd call the stretch, like "Christmas". null if they didn't.
- "size": "hours" if they say it takes a few hours or an evening; "weekend" if it takes a weekend or longer. null if they didn't say.
- "waiting": only if they say they can't start yet, in their words, like "the wood". null otherwise.
- "from": only if they give a day it can start. Use the next one that hasn't passed. "In a few weeks" is not a day: leave it null and put the reason in "waiting".
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
  const also: ProposalAlso[] = []
  for (const entry of Array.isArray(parsed.also) ? parsed.also : []) {
    // A bare title is still fine: older answers and shorter sentences.
    const obj = entry && typeof entry === 'object' ? entry : { title: entry }
    const p = find(obj.title)
    if (!p || p.id === main?.id || also.some(a => a.id === p.id)) continue
    also.push({
      id: p.id, title: p.title,
      size: obj.size === 'hours' || obj.size === 'weekend' ? obj.size : null,
      waiting: typeof obj.waiting === 'string' && obj.waiting.trim() ? obj.waiting.trim().slice(0, 40) : null,
      from: isRealDate(obj.from) && obj.from >= today ? obj.from : null,
    })
    if (also.length >= MAX_ALSO) break
  }
  const until = isRealDate(parsed.until) && parsed.until >= today ? parsed.until : null
  const label = typeof parsed.label === 'string' && parsed.label.trim() ? parsed.label.trim().slice(0, 30) : null

  if (!main && also.length === 0) return null
  return { main: main ? { id: main.id, title: main.title } : null, also, until, label }
}
