import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { hoursLeftLabel, timeAgo } from '../lib/format'
import { Avatar } from '../components/Avatar'
import { NewStoryForm } from '../components/NewStoryForm'
import { isPushSupported, isSubscribed } from '../lib/push'
import type { StorySummary } from '../lib/types'

export default function StoriesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stories, setStories] = useState<StorySummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pushOff, setPushOff] = useState(false)

  const load = useCallback(() => {
    api
      .listStories()
      .then(({ stories: loaded }) => setStories(loaded))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your stories'))
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    if (!isPushSupported()) return
    isSubscribed().then((subscribed) => setPushOff(!subscribed))
  }, [])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-reading items-center justify-between px-4 py-3">
          <h1 className="display text-2xl font-semibold">Relay</h1>
          <Link to="/settings" className="text-sm text-muted hover:text-ink">
            {profile?.display_name ?? 'Settings'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-reading space-y-4 px-4 py-5">
        {pushOff && stories && stories.length > 0 && (
          <Link to="/settings" className="surface block p-4 text-sm">
            <span className="font-medium">Turn on notifications</span>
            <span className="mt-0.5 block text-muted">
              Otherwise you won't know when it's your turn.
            </span>
          </Link>
        )}

        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

        {creating ? (
          <NewStoryForm onCreated={(id) => navigate(`/story/${id}`)} onCancel={() => setCreating(false)} />
        ) : (
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => setCreating(true)}>
              Start a story
            </button>
            <Link to="/join" className="btn-quiet">
              Join with a code
            </Link>
          </div>
        )}

        {stories === null && !error && <p className="text-sm text-muted">Loading…</p>}

        {stories?.length === 0 && !creating && (
          <div className="surface p-6 text-center">
            <p className="display text-lg font-semibold">Nothing on the go.</p>
            <p className="mt-1 text-sm text-muted">
              Start one and invite a friend, or join theirs with a code.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {stories?.map((story) => {
            const waitingOn = story.members.find((m) => m.user_id === story.whose_turn)?.display_name ?? 'them'
            return (
              <li key={story.id}>
                <Link to={`/story/${story.id}`} className="surface block p-4 transition-colors hover:border-accent/60">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="display text-[1.15rem] font-semibold leading-snug">{story.title}</h2>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {story.streak.current > 0 && (
                        <span className="pill border border-rule" style={{ color: 'rgb(var(--accent))' }}>
                          {story.streak.current}-day streak
                        </span>
                      )}
                      {story.can_write && (
                        <span
                          className="pill"
                          style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-ink))' }}
                        >
                          Your turn
                        </span>
                      )}
                    </div>
                  </div>

                  {story.last_line ? (
                    <p
                      className="prose-story mt-2 line-clamp-3 text-[0.95rem]"
                      style={{ color: 'rgb(var(--muted))' }}
                    >
                      {story.last_line.body}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">No lines yet — you go first.</p>
                  )}

                  {story.streak.hoursLeft !== null && (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {hoursLeftLabel(story.streak.hoursLeft)} to keep the streak —{' '}
                      {story.can_write ? "it's your turn" : `waiting on ${waitingOn}`}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {story.members.map((member) => (
                        <Avatar
                          key={member.user_id}
                          name={member.display_name}
                          turnOrder={member.turn_order}
                          size={22}
                          dim={story.whose_turn !== null && story.whose_turn !== member.user_id}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted">
                      {story.members.length} {story.members.length === 1 ? 'writer' : 'writers'} ·{' '}
                      {timeAgo(story.last_line_at)}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
