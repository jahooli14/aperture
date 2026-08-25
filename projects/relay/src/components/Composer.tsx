import { useState, type FormEvent } from 'react'

export function Composer({
  canWrite,
  waitingOn,
  onSubmit,
}: {
  canWrite: boolean
  /** Who we're waiting for, when it isn't you. */
  waitingOn: string | null
  onSubmit: (body: string, chapterTitle?: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [newChapter, setNewChapter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) {
    return (
      <p className="px-4 py-3 text-center text-sm text-muted">
        {waitingOn ? `Waiting on ${waitingOn}.` : 'You wrote the last line — someone else goes next.'}
      </p>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(body.trim(), newChapter ? chapterTitle.trim() || undefined : undefined)
      setBody('')
      setChapterTitle('')
      setNewChapter(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that line')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="px-4 py-3">
      {newChapter && (
        <input
          className="field mb-2"
          placeholder="Chapter name"
          maxLength={120}
          value={chapterTitle}
          onChange={(event) => setChapterTitle(event.target.value)}
        />
      )}

      <textarea
        className="field resize-none font-story"
        rows={3}
        maxLength={2000}
        placeholder="Your line…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}

      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={newChapter}
            onChange={(event) => setNewChapter(event.target.checked)}
          />
          Starts a new chapter
        </label>
        <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>
          {busy ? 'Adding…' : 'Add line'}
        </button>
      </div>
    </form>
  )
}
