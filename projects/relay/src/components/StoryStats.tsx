import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'
import { duration, hoursLeftLabel, replyTimeLabel } from '../lib/format'
import { PeakTimes } from './PeakTimes'
import { computeWritingStyle, findLongestLine } from '../lib/writingStyle'
import type { Line, Member, StoryStats as Stats } from '../lib/types'

/** The story so far — all of it derived from the lines, none of it guessed at. */
export function StoryStats({
  stats,
  members,
  lines,
  printHref,
  onJumpToLine,
  onClose,
}: {
  stats: Stats
  members: Member[]
  lines: Line[]
  printHref: string
  onJumpToLine: (position: number) => void
  onClose: () => void
}) {
  const byUser = new Map(members.map((m) => [m.user_id, m]))
  const writingStyle = computeWritingStyle(lines)
  const longestLine = findLongestLine(lines)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center">
      <div className="sheet w-full max-w-reading overflow-y-auto p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="display text-xl font-semibold">The story so far</h2>
          <button className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-3">
          <Figure
            label="Streak"
            value={stats.streak.current > 0 ? `${stats.streak.current} ${stats.streak.current === 1 ? 'day' : 'days'}` : 'None yet'}
          />
          <Figure label="Best streak" value={`${stats.streak.longest} ${stats.streak.longest === 1 ? 'day' : 'days'}`} />
          <Figure label="Lines" value={stats.lineCount.toLocaleString()} />
          <Figure label="Words" value={stats.wordCount.toLocaleString()} />
          <Figure label="Running" value={duration(stats.daysRunning)} />
          <Figure
            label="Longest silence"
            value={stats.longestGapDays > 0 ? duration(stats.longestGapDays) : 'none yet'}
          />
        </dl>

        {stats.streak.hoursLeft !== null && (
          <p className="-mt-3 mb-6 text-xs font-medium text-amber-700 dark:text-amber-400">
            {hoursLeftLabel(stats.streak.hoursLeft)} before the streak resets — get a line in.
          </p>
        )}

        {writingStyle.length > 0 && (
          <section className="mb-6">
            <h3 className="label">Writing style</h3>
            <ul className="space-y-2.5">
              {writingStyle.map((writer) => {
                const member = byUser.get(writer.user_id)
                return (
                  <li key={writer.user_id} className="flex items-center gap-2 text-sm">
                    <Avatar
                      name={member?.display_name ?? 'Writer'}
                      turnOrder={member?.turn_order ?? 0}
                      size={22}
                    />
                    <span className="flex-1">{member?.display_name ?? 'Writer'}</span>
                    <span className="text-muted">
                      {writer.avgWords} words/line
                      {writer.medianReplyHours !== null && ` · replies in ~${replyTimeLabel(writer.medianReplyHours)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {longestLine && (
          <button
            className="mb-6 flex w-full items-center justify-between gap-3 rounded-lg border border-rule p-3 text-left text-sm hover:bg-paper"
            onClick={() => onJumpToLine(longestLine.position)}
          >
            <span>
              Longest line: <strong>{longestLine.words} words</strong>, by{' '}
              {byUser.get(longestLine.user_id)?.display_name ?? 'Writer'}
            </span>
            <span className="whitespace-nowrap text-xs text-muted">line {longestLine.position}</span>
          </button>
        )}

        <PeakTimes timestamps={lines.map((l) => l.created_at)} />

        <Link to={printHref} className="btn-quiet mb-6 mt-6 w-full">
          Make a book of it
        </Link>

        {stats.chapters.length > 0 && (
          <section>
            <h3 className="label">Chapters</h3>
            <ul className="space-y-1">
              {stats.chapters.map((chapter) => (
                <li key={chapter.position}>
                  <button
                    className="w-full rounded px-2 py-2 text-left font-story hover:bg-paper"
                    onClick={() => onJumpToLine(chapter.position)}
                  >
                    {chapter.title}
                    <span className="ml-2 text-xs text-muted">line {chapter.position}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rule p-3">
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 display text-xl font-semibold">{value}</dd>
    </div>
  )
}
