import { Avatar } from './Avatar'
import { duration } from '../lib/format'
import type { Member, StoryStats as Stats } from '../lib/types'

/** The story so far — all of it derived from the lines, none of it guessed at. */
export function StoryStats({
  stats,
  members,
  onJumpToChapter,
  onClose,
}: {
  stats: Stats
  members: Member[]
  onJumpToChapter: (position: number) => void
  onClose: () => void
}) {
  const byUser = new Map(members.map((m) => [m.user_id, m]))
  const busiest = stats.authors[0]?.lines ?? 1

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85dvh] w-full max-w-reading overflow-y-auto rounded-t-2xl border border-rule bg-card p-5 sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="font-story text-xl">The story so far</h2>
          <button className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-3">
          <Figure label="Lines" value={stats.lineCount.toLocaleString()} />
          <Figure label="Words" value={stats.wordCount.toLocaleString()} />
          <Figure label="Running" value={duration(stats.daysRunning)} />
          <Figure
            label="Longest silence"
            value={stats.longestGapDays > 0 ? duration(stats.longestGapDays) : 'none yet'}
          />
        </dl>

        {stats.authors.length > 0 && (
          <section className="mb-6">
            <h3 className="label">Who wrote what</h3>
            <ul className="space-y-2.5">
              {stats.authors.map((author) => {
                const member = byUser.get(author.user_id)
                return (
                  <li key={author.user_id}>
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar
                        name={member?.display_name ?? 'Writer'}
                        turnOrder={member?.turn_order ?? 0}
                        size={22}
                      />
                      <span className="flex-1">{member?.display_name ?? 'Writer'}</span>
                      <span className="text-muted">
                        {author.lines} {author.lines === 1 ? 'line' : 'lines'} ·{' '}
                        {author.words.toLocaleString()} words
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-rule">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.round((author.lines / busiest) * 100)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {stats.chapters.length > 0 && (
          <section>
            <h3 className="label">Chapters</h3>
            <ul className="space-y-1">
              {stats.chapters.map((chapter) => (
                <li key={chapter.position}>
                  <button
                    className="w-full rounded px-2 py-2 text-left font-story hover:bg-paper"
                    onClick={() => onJumpToChapter(chapter.position)}
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
      <dd className="mt-1 font-story text-xl">{value}</dd>
    </div>
  )
}
