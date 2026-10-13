/**
 * "Bring me up to speed" — for a project you've put down and want back.
 *
 * Opening a project that's been quiet for weeks, the questions are: what
 * was this, where did I get to, and what was still up in the air. The
 * answers are all in their own notes, scattered across captures, session
 * notes and ticked moves. This puts them in one place, in plain words,
 * with the date each one came from.
 *
 * The way back in is NOT here: the move (next-move.ts) already writes one
 * for a project that's been away, and it sits right under this on the
 * project page. Two ways back in would be a menu.
 *
 * Grounded like everything else the app writes about you: every line
 * except "what it is" cites a row, the row has to share its wording, and
 * nothing named in it may be missing from the evidence. A line that fails
 * is dropped; if nothing survives, nothing is shown.
 */

import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './plain-english.js'
import { citationSupports, evidenceHaystack, hasOnlyKnownSpecifics, type Evidence } from './session-grounding.js'

/** Quiet this long and the project page leads with the catch-up. */
export const UP_TO_SPEED_AFTER_DAYS = 14
export const MAX_OPEN = 2

export interface CitedLine {
  text: string
  /** The label of the evidence row it came from ("note, 3 Aug 2026"). */
  from: string
}

export interface UpToSpeed {
  what: string | null
  where: CitedLine | null
  open: CitedLine[]
  /** Newest material it was built from; a newer row means rebuild. */
  basis_at: string | null
  built_at: string
}

export function buildUpToSpeedPrompt(input: {
  title: string
  description: string | null
  endGoal: string | null
  daysAway: number
  evidence: Evidence[]
}): string {
  const rows = input.evidence.map(e => `[${e.id}] (${e.label}) ${e.text}`).join('\n')
  return `Someone is coming back to a creative project after ${input.daysAway} days away.
They can't remember where they were. Using ONLY what they wrote below, bring them
up to speed, the way a friend who'd read their notes would.

Project: "${input.title}"
${input.description ? `What it is: ${input.description}\n` : ''}${input.endGoal ? `Where it's heading: ${input.endGoal}\n` : ''}
What they wrote, newest first:
${rows}

Return JSON only:
{
  "what": "one sentence: what this project is, in plain words",
  "where": { "text": "one sentence: the last real thing they got done or got to", "from": "ROW_ID" },
  "open": [ { "text": "one sentence: something they hadn't decided or sorted yet", "from": "ROW_ID" } ]
}

Rules:
- "where" is about the LATEST real progress. Prefer newer rows.
- "open" is at most ${MAX_OPEN} things they left unsettled — a question they asked
  themselves, a problem they named, a choice not made. Empty list if there are none.
  Never invent a problem to fill it.
- Every "from" is the id of the row it came from.
- Name nothing (people, places, tools, numbers) the rows don't name.
- Say it to them: "you", past tense for what happened. Under 25 words each.
- No advice, no next step, no encouragement. Just where things stand.
- Use null for "where" if the rows don't show any progress.

GOOD: { "text": "You'd rewritten the first three chapters in the new voice.", "from": "N2" }
BAD:  { "text": "You were making great progress on your creative journey." }  (says nothing)
BAD:  { "text": "You should tackle chapter four next." }  (advice — not this card's job)

${PLAIN_ENGLISH_RULES}`
}

function cleanSentence(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t || t.split(/\s+/).length > 35) return null
  if (findVoiceViolations(t).length > 0) return null
  return t
}

function citedLine(raw: unknown, evidence: Evidence[], haystack: string): CitedLine | null {
  const text = cleanSentence((raw as { text?: unknown })?.text)
  if (!text) return null
  const row = evidence.find(e => e.id === (raw as { from?: unknown })?.from)
  if (!row || !citationSupports(text, row.text)) return null
  if (!hasOnlyKnownSpecifics(text, haystack)) return null
  return { text, from: row.label }
}

/** Null when nothing honest survived: show nothing rather than a guess. */
export function parseUpToSpeed(
  raw: string,
  evidence: Evidence[],
  title: string,
  basisAt: string | null,
  now = new Date(),
): UpToSpeed | null {
  let parsed: any
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const haystack = evidenceHaystack(evidence, title)

  const whatText = cleanSentence(parsed.what)
  const what = whatText && hasOnlyKnownSpecifics(whatText, haystack) ? whatText : null
  const where = parsed.where ? citedLine(parsed.where, evidence, haystack) : null
  const open = (Array.isArray(parsed.open) ? parsed.open : [])
    .map((o: unknown) => citedLine(o, evidence, haystack))
    .filter((o: CitedLine | null): o is CitedLine => !!o)
    .filter((o: CitedLine) => o.text !== where?.text)
    .slice(0, MAX_OPEN)

  if (!where && open.length === 0) return null
  return { what, where, open, basis_at: basisAt, built_at: now.toISOString() }
}

export function readUpToSpeed(metadata: unknown): UpToSpeed | null {
  const raw = (metadata as { up_to_speed?: unknown } | null)?.up_to_speed as Partial<UpToSpeed> | undefined
  if (!raw || typeof raw.built_at !== 'string') return null
  return {
    what: typeof raw.what === 'string' ? raw.what : null,
    where: raw.where && typeof raw.where.text === 'string' ? raw.where : null,
    open: Array.isArray(raw.open) ? raw.open.filter(o => o && typeof o.text === 'string') : [],
    basis_at: typeof raw.basis_at === 'string' ? raw.basis_at : null,
    built_at: raw.built_at,
  }
}

/** The cached one still describes everything there is. */
export function isFresh(cached: UpToSpeed | null, newestMaterialAt: string | null): boolean {
  if (!cached) return false
  return (cached.basis_at ?? null) === (newestMaterialAt ?? null)
}
