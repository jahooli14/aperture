/**
 * Keeping the index honest.
 *
 * The model is asked to point at line numbers rather than describe the story,
 * and everything it returns is checked against the actual text before anyone
 * sees it: the cited line has to exist, and the name has to genuinely appear
 * in one of the lines cited for it. Anything that fails is dropped.
 *
 * That check is the whole reason this can be trusted. Without it an index is
 * just a model's impression of a story, which is exactly the thing Relay is
 * not supposed to produce.
 *
 * Pure — no IO, no model, no network.
 */
import { findVoiceViolations } from '../plain-english.js'

export interface IndexEntry {
  name: string
  note: string
  lines: number[]
}

export interface StoryIndex {
  people: IndexEntry[]
  places: IndexEntry[]
  threads: IndexEntry[]
}

export interface SourceLine {
  position: number
  body: string
}

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip a trailing plural or possessive so "peanuts" matches "peanut". */
function stem(word: string): string {
  return word.replace(/(?:'s|s)$/, '')
}

/**
 * Whether `name` is genuinely present in `body`.
 *
 * A whole-phrase match counts. Otherwise any single distinctive word of the
 * name counts — "John P Pasco" is present in a line that only says "Pasco".
 * Words under four characters must match whole, so "Rome" never matches
 * "Roderick" and "a" never matches everything.
 */
export function mentions(body: string, name: string): boolean {
  const haystack = normalise(body)
  const needle = normalise(name)
  if (!haystack || !needle) return false
  if (haystack.includes(needle)) return true

  const haystackWords = new Set(haystack.split(' ').map(stem))
  return needle
    .split(' ')
    .filter((word) => word.length >= 4)
    .some((word) => haystackWords.has(stem(word)))
}

const LIMITS = { people: 12, places: 10, threads: 6 } as const
const MAX_NOTE = 160

function cleanEntry(entry: IndexEntry, byPosition: Map<number, string>): IndexEntry | null {
  const name = entry.name?.trim()
  if (!name || name.length > 60) return null

  // Only cite lines that exist, in order, without repeats.
  const cited = [...new Set((entry.lines ?? []).filter((n) => byPosition.has(n)))].sort((a, b) => a - b)
  if (cited.length === 0) return null

  // The name has to actually appear in at least one line cited for it.
  const grounded = cited.some((position) => mentions(byPosition.get(position) as string, name))
  if (!grounded) return null

  // A note that slipped into critic voice is dropped; the entry still stands
  // on its citations, which is the part that carries the value.
  let note = (entry.note ?? '').trim()
  if (note.length > MAX_NOTE || findVoiceViolations(note).length > 0) note = ''

  return { name, note, lines: cited }
}

/**
 * Filters a model's raw index down to what the text supports. Entries are
 * ordered by where they first appear, so the index reads in story order.
 */
export function groundIndex(raw: Partial<StoryIndex>, lines: SourceLine[]): StoryIndex {
  const byPosition = new Map(lines.map((line) => [line.position, line.body]))

  const clean = (entries: IndexEntry[] | undefined, limit: number): IndexEntry[] => {
    const seen = new Set<string>()
    return (entries ?? [])
      .map((entry) => cleanEntry(entry, byPosition))
      .filter((entry): entry is IndexEntry => entry !== null)
      .filter((entry) => {
        const key = normalise(entry.name)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => a.lines[0] - b.lines[0])
      .slice(0, limit)
  }

  return {
    people: clean(raw.people, LIMITS.people),
    places: clean(raw.places, LIMITS.places),
    threads: clean(raw.threads, LIMITS.threads),
  }
}

export function isEmptyIndex(index: StoryIndex): boolean {
  return index.people.length === 0 && index.places.length === 0 && index.threads.length === 0
}
