import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { TurnMode } from '../lib/types'

export function NewStoryForm({
  onCreated,
  onCancel,
}: {
  onCreated: (storyId: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [turnMode, setTurnMode] = useState<TurnMode>('rotation')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { story } = await api.createStory({ title, blurb: blurb || undefined, turn_mode: turnMode })
      onCreated(story.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start that story')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5">
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          className="field"
          required
          maxLength={120}
          autoFocus
          placeholder="The one about the peanut"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="blurb">
          What is it? <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="blurb"
          className="field"
          maxLength={400}
          placeholder="A line each, no plan, see where it goes"
          value={blurb}
          onChange={(event) => setBlurb(event.target.value)}
        />
      </div>

      <fieldset>
        <legend className="label">Turns</legend>
        <div className="space-y-2">
          {(
            [
              ['rotation', 'Take turns', 'Strict order. Best for two of you.'],
              ['open', 'Anyone next', 'Anyone but whoever wrote last. Best for a group.'],
            ] as const
          ).map(([value, name, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                turnMode === value ? 'border-accent bg-accent/5' : 'border-rule'
              }`}
            >
              <input
                type="radio"
                name="turn-mode"
                className="mt-1 accent-current"
                checked={turnMode === value}
                onChange={() => setTurnMode(value)}
              />
              <span>
                <span className="block text-sm font-medium">{name}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy || !title.trim()}>
          {busy ? 'Starting…' : 'Start it'}
        </button>
        <button type="button" className="btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
