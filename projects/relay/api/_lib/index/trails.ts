/**
 * Where each index entry actually turns up, counted from the lines.
 *
 * The model only cites a handful of lines per entry, so "last seen" can't come
 * from it. This scans the whole story for the name instead, which also keeps
 * it right when the index is a few lines behind. Nothing here is generated.
 *
 * Pure — no IO, no model, no network.
 */
import { normalise, type IndexEntry, type StoryIndex } from './ground.js'

export interface TrailLine {
  position: number
  body: string
  chapter_title?: string | null
}

export interface TrailChapter {
  /** Null for the stretch before the first named chapter. */
  title: string | null
  lines: number[]
}

export interface Trail {
  count: number
  last: number
  /** Lines written since it last appeared. */
  ago: number
  chapters: TrailChapter[]
}

export type TrailedEntry = IndexEntry & { trail: Trail }

export interface TrailedIndex {
  people: TrailedEntry[]
  places: TrailedEntry[]
  threads: TrailedEntry[]
}

/** Strip a trailing plural or possessive so "peanuts" matches "peanut". */
function stem(word: string): string {
  return word.replace(/(?:'s|s)$/, '')
}

function stemmed(text: string): string[] {
  return normalise(text).split(' ').filter(Boolean).map(stem)
}

/**
 * Whether a line is about `name`. Stricter than the grounding check: the whole
 * name has to appear as whole words, or — for a name of several words — one
 * distinctive word of it ("Stewart" for "Rod Stewart"). A short name never
 * matches inside a longer word, so "Rod" is not found in "product".
 */
export function appearsIn(body: string, name: string): boolean {
  const words = stemmed(body)
  const needle = stemmed(name)
  if (words.length === 0 || needle.length === 0) return false

  const padded = ` ${words.join(' ')} `
  if (padded.includes(` ${needle.join(' ')} `)) return true
  if (needle.length === 1) return false

  const present = new Set(words)
  return needle.filter((word) => word.length >= 4).some((word) => present.has(word))
}

export function trailFor(name: string, lines: TrailLine[], lastPosition: number): Trail | null {
  const chapters: TrailChapter[] = []
  let current: TrailChapter | null = null
  let count = 0
  let last = 0
  let title: string | null = null

  for (const line of lines) {
    if (line.chapter_title) {
      title = line.chapter_title
      current = null
    }
    if (!appearsIn(line.body, name)) continue

    if (!current) {
      current = { title, lines: [] }
      chapters.push(current)
    }
    current.lines.push(line.position)
    count += 1
    last = line.position
  }

  if (count === 0) return null
  return { count, last, ago: Math.max(0, lastPosition - last), chapters }
}

/** Attaches a trail to every entry. Entries the scan can't find keep their cited lines. */
export function withTrails(index: StoryIndex, lines: TrailLine[]): TrailedIndex {
  const lastPosition = lines.reduce((max, line) => Math.max(max, line.position), 0)

  const attach = (entries: IndexEntry[]): TrailedEntry[] =>
    entries.map((entry) => {
      const found = trailFor(entry.name, lines, lastPosition)
      const trail: Trail = found ?? {
        count: entry.lines.length,
        last: entry.lines[entry.lines.length - 1],
        ago: Math.max(0, lastPosition - entry.lines[entry.lines.length - 1]),
        chapters: [{ title: null, lines: entry.lines }],
      }
      return { ...entry, trail }
    })

  return {
    people: attach(index.people),
    places: attach(index.places),
    threads: attach(index.threads),
  }
}

/** How many lines of silence before something counts as gone quiet. */
export function quietAfter(lastPosition: number): number {
  return Math.max(12, Math.round(lastPosition * 0.2))
}

/** Chapter openings in order, including an unnamed first line when it has no title. */
export function chapterList(lines: TrailLine[]): { position: number; title: string | null }[] {
  const out: { position: number; title: string | null }[] = []
  for (const line of lines) {
    if (line.chapter_title) out.push({ position: line.position, title: line.chapter_title })
  }
  const first = lines[0]
  if (first && !first.chapter_title) out.unshift({ position: first.position, title: null })
  return out
}
