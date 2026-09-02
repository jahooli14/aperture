/**
 * What replaces "who wrote what" in a rotation story: line counts there are
 * forced to a near-even split by the turn order itself, so a bar chart of
 * them says nothing anyone didn't already know. Word count per line and
 * reply speed aren't forced by anything — they're the closest thing to a
 * writing fingerprint the lines actually carry.
 */
import type { Line } from './types'

export function countWords(body: string): number {
  const matches = body.trim().match(/[\p{L}\p{N}'’-]+/gu)
  return matches ? matches.length : 0
}

export interface WriterStyle {
  user_id: string
  avgWords: number
  /** Median hours between the previous line and this writer's reply to it.
   *  Null when this writer has never followed on from someone else's line. */
  medianReplyHours: number | null
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Ordered by whoever's busiest, same convention as the old tally. */
export function computeWritingStyle(lines: Line[]): WriterStyle[] {
  const ordered = [...lines].sort((a, b) => a.position - b.position)
  const wordsByAuthor = new Map<string, number[]>()
  const replyHoursByAuthor = new Map<string, number[]>()

  ordered.forEach((line, index) => {
    const words = wordsByAuthor.get(line.author_id) ?? []
    words.push(countWords(line.body))
    wordsByAuthor.set(line.author_id, words)

    if (index === 0) return
    const previous = ordered[index - 1]
    if (previous.author_id === line.author_id) return
    const hours = (Date.parse(line.created_at) - Date.parse(previous.created_at)) / 3_600_000
    if (!Number.isFinite(hours) || hours < 0) return
    const replies = replyHoursByAuthor.get(line.author_id) ?? []
    replies.push(hours)
    replyHoursByAuthor.set(line.author_id, replies)
  })

  return [...wordsByAuthor.entries()]
    .map(([user_id, words]) => {
      const replies = replyHoursByAuthor.get(user_id) ?? null
      return {
        user_id,
        avgWords: Math.round(words.reduce((sum, n) => sum + n, 0) / words.length),
        medianReplyHours: replies && replies.length > 0 ? median(replies) : null,
      }
    })
    .sort((a, b) => b.avgWords - a.avgWords)
}

export interface LongestLine {
  user_id: string
  position: number
  words: number
}

/** The single longest line in the story, for one bragging-rights fact. */
export function findLongestLine(lines: Line[]): LongestLine | null {
  let best: LongestLine | null = null
  for (const line of lines) {
    const words = countWords(line.body)
    if (!best || words > best.words) best = { user_id: line.author_id, position: line.position, words }
  }
  return best
}
