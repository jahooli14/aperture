import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { duration } from '../lib/format'
import type { Line, StoryDetail } from '../lib/types'

/**
 * The story as a book.
 *
 * Set for paper rather than for a screen, and printed through the browser —
 * which on a phone means Share, then Print, then Save as PDF. No attribution
 * in the body: this is the thing you'd hand someone, and the two of you know
 * who wrote what. The colophon at the back says it properly.
 */
export default function PrintPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<StoryDetail | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([api.getStory(id), api.listLines(id)])
      .then(([storyDetail, { lines: loaded }]) => {
        setDetail(storyDetail)
        setLines(loaded)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load that story'))
  }, [id])

  if (error) return <p className="p-8 text-sm">{error}</p>
  if (!detail) return <p className="p-8 text-sm text-muted">Setting the pages…</p>

  const { story, members, stats } = detail
  const started = stats.startedAt ? new Date(stats.startedAt) : null
  const finished = stats.lastLineAt ? new Date(stats.lastLineAt) : null

  const chapters: { title: string | null; lines: Line[] }[] = []
  for (const line of lines) {
    if (line.chapter_title || chapters.length === 0) chapters.push({ title: line.chapter_title, lines: [line] })
    else chapters[chapters.length - 1].lines.push(line)
  }

  const year = (date: Date | null) => (date ? date.getFullYear() : '')

  return (
    <div className="book">
      <div className="no-print mx-auto flex max-w-reading items-center justify-between gap-3 px-4 py-3">
        <Link to={`/story/${story.id}`} className="text-sm text-muted hover:text-ink">
          Back to the story
        </Link>
        <button className="btn-accent" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <section className="title-page">
        <h1>{story.title}</h1>
        {story.blurb && <p className="blurb">{story.blurb}</p>}
        <p className="byline">
          {members.map((m) => m.display_name).join(' and ')}
        </p>
        {started && (
          <p className="dates">
            {year(started)}
            {finished && year(finished) !== year(started) ? `–${year(finished)}` : ''}
          </p>
        )}
      </section>

      {chapters.map((chapter) => (
        <section key={chapter.lines[0].id} className="chapter">
          {chapter.title && <h2>{chapter.title}</h2>}
          {chapter.lines.map((line, index) => (
            <p key={line.id} className={index === 0 ? 'opening' : undefined}>
              {line.body}
            </p>
          ))}
        </section>
      ))}

      <section className="colophon">
        <h2>How this was made</h2>
        <p>
          Written a line at a time, turn by turn, by{' '}
          {members.map((m) => m.display_name).join(' and ')}.
        </p>
        <p>
          {stats.lineCount} lines, {stats.wordCount.toLocaleString()} words, over{' '}
          {duration(stats.daysRunning)}.
          {stats.longestGapDays >= 3 && ` The longest silence was ${duration(stats.longestGapDays)}.`}
        </p>
        <ul>
          {stats.authors.map((author) => {
            const member = members.find((m) => m.user_id === author.user_id)
            return (
              <li key={author.user_id}>
                {member?.display_name ?? 'Writer'} — {author.lines} lines,{' '}
                {author.words.toLocaleString()} words
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
