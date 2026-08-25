/**
 * "The story so far" — everything derived from the lines themselves.
 * Pure, so the same numbers render on the client without a second call.
 */
export interface StatLine {
  author_id: string
  body: string
  position: number
  created_at: string
  chapter_title?: string | null
}

export interface AuthorTally {
  user_id: string
  lines: number
  words: number
}

export interface StoryStats {
  lineCount: number
  wordCount: number
  authors: AuthorTally[]
  chapters: { title: string; position: number }[]
  startedAt: string | null
  lastLineAt: string | null
  daysRunning: number
  daysSinceLastLine: number | null
  longestGapDays: number
  averageWordsPerLine: number
}

const DAY = 86_400_000

export function countWords(body: string): number {
  const matches = body.trim().match(/[\p{L}\p{N}'’-]+/gu)
  return matches ? matches.length : 0
}

function wholeDaysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / DAY)
}

export function summarise(lines: StatLine[], now: string = new Date().toISOString()): StoryStats {
  const ordered = [...lines].sort((a, b) => a.position - b.position)

  const tallies = new Map<string, AuthorTally>()
  const chapters: { title: string; position: number }[] = []
  let wordCount = 0
  let longestGapDays = 0

  ordered.forEach((line, index) => {
    const words = countWords(line.body)
    wordCount += words

    const tally = tallies.get(line.author_id) ?? { user_id: line.author_id, lines: 0, words: 0 }
    tally.lines += 1
    tally.words += words
    tallies.set(line.author_id, tally)

    if (line.chapter_title) chapters.push({ title: line.chapter_title, position: line.position })

    if (index > 0) {
      const gap = wholeDaysBetween(ordered[index - 1].created_at, line.created_at)
      if (gap > longestGapDays) longestGapDays = gap
    }
  })

  const startedAt = ordered[0]?.created_at ?? null
  const lastLineAt = ordered[ordered.length - 1]?.created_at ?? null

  return {
    lineCount: ordered.length,
    wordCount,
    authors: [...tallies.values()].sort((a, b) => b.lines - a.lines),
    chapters,
    startedAt,
    lastLineAt,
    daysRunning: startedAt ? Math.max(0, wholeDaysBetween(startedAt, now)) : 0,
    daysSinceLastLine: lastLineAt ? Math.max(0, wholeDaysBetween(lastLineAt, now)) : null,
    longestGapDays,
    averageWordsPerLine: ordered.length ? Math.round(wordCount / ordered.length) : 0,
  }
}
