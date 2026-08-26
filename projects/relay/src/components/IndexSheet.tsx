import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { IndexEntry, StoryIndexResponse } from '../lib/types'

/**
 * The index — who turns up, where things happen, what keeps coming back.
 *
 * It's built by reading the lines and pointing back at their numbers, and
 * every entry is checked against the text before it gets here. Tapping a
 * number takes you to that line. Nothing in it is ever added to the story.
 */
export function IndexSheet({
  storyId,
  onJumpToLine,
  onClose,
}: {
  storyId: string
  onJumpToLine: (position: number) => void
  onClose: () => void
}) {
  const [state, setState] = useState<StoryIndexResponse | null>(null)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getIndex(storyId)
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the index'))
  }, [storyId])

  async function build() {
    setBuilding(true)
    setError(null)
    try {
      setState(await api.buildIndex(storyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the index')
    } finally {
      setBuilding(false)
    }
  }

  const index = state?.index

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center">
      <div className="sheet w-full max-w-reading overflow-y-auto p-5">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="display text-xl font-semibold">The index</h2>
          <button className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>
        <p className="mb-5 text-sm text-muted">Read from your lines. Never added to them.</p>

        {error && <p className="mb-4 text-sm text-red-700 dark:text-red-400">{error}</p>}

        {state && !state.storage_ready && (
          <Blocked
            what="The index has nowhere to live yet."
            fix="Run 0002_story_index.sql in the Supabase SQL editor. It's one table."
          />
        )}

        {state && state.storage_ready && !state.available && (
          <Blocked
            what="The server can't see a Gemini key."
            fix={
              state.key_env_names && state.key_env_names.length > 0
                ? `The deployment does have ${state.key_env_names.join(', ')}, but the value is empty. Re-enter it in Vercel and redeploy.`
                : 'This deployment received no Gemini variable at all. Environment variables only reach the running app on a new deployment, so redeploy after adding GEMINI_KEY — and check it is enabled for Production.'
            }
          />
        )}

        {state && state.storage_ready && state.available && !state.enough_lines && (
          <p className="text-sm text-muted">
            Write a few more lines first — there isn't enough here to index yet.
          </p>
        )}

        {state && state.storage_ready && state.available && state.enough_lines && !index && (
          <div>
            <p className="mb-4 text-sm text-muted">
              Nothing built yet. It'll pull out the people, the places, and anything that keeps
              turning up — each one pointing at the lines it came from.
            </p>
            <button className="btn-accent w-full" onClick={build} disabled={building}>
              {building ? 'Reading the story…' : 'Build the index'}
            </button>
          </div>
        )}

        {index && (
          <div className="flex flex-col gap-7">
            <Section title="People" entries={index.people} onJump={onJumpToLine} />
            <Section title="Places" entries={index.places} onJump={onJumpToLine} />
            <Section title="Keeps coming back" entries={index.threads} onJump={onJumpToLine} />

            <div className="border-t border-rule pt-4">
              {state && state.behind_by > 0 ? (
                <>
                  <p className="mb-3 text-sm text-muted">
                    {state.behind_by} {state.behind_by === 1 ? 'line' : 'lines'} written since this
                    was built.
                  </p>
                  <button className="btn-quiet w-full" onClick={build} disabled={building}>
                    {building ? 'Reading the story…' : 'Bring it up to date'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-faint">
                  Up to date, through line {state?.up_to_position}.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Blocked({ what, fix }: { what: string; fix: string }) {
  return (
    <div className="rounded-lg border border-rule bg-sunk p-4">
      <p className="text-sm font-medium text-ink">{what}</p>
      <p className="mt-1 text-sm text-muted">{fix}</p>
    </div>
  )
}

function Section({
  title,
  entries,
  onJump,
}: {
  title: string
  entries: IndexEntry[]
  onJump: (position: number) => void
}) {
  if (entries.length === 0) return null

  return (
    <section>
      <h3 className="label">{title}</h3>
      <ul className="flex flex-col gap-3.5">
        {entries.map((entry) => (
          <li key={entry.name}>
            <div className="display text-[1.02rem] font-semibold leading-snug">{entry.name}</div>
            {entry.note && <p className="mt-0.5 text-sm text-muted">{entry.note}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.lines.map((position) => (
                <button
                  key={position}
                  onClick={() => onJump(position)}
                  className="rounded border border-rule px-1.5 py-0.5 text-[0.7rem] tabular-nums text-muted hover:border-accent hover:text-accent"
                  aria-label={`Go to line ${position}`}
                >
                  {position}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
