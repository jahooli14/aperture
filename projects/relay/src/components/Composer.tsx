import { useState, type FormEvent } from 'react'

/**
 * Writing the next line.
 *
 * The line you're following sits above the box, greyed out — you're
 * continuing a sentence someone else started, not replying to a message.
 * That framing is most of the difference between this and a chat app.
 */
export function Composer({
  canWrite,
  waitingOn,
  previousLine,
  onSubmit,
}: {
  canWrite: boolean
  waitingOn: string | null
  previousLine: { body: string; display_name: string } | null
  onSubmit: (body: string, chapterTitle?: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [newChapter, setNewChapter] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) {
    return (
      <p className="px-4 py-4 text-center text-sm text-muted">
        {waitingOn ? (
          <>
            Waiting on <span className="font-medium text-ink">{waitingOn}</span>.
          </>
        ) : (
          'You wrote the last line — someone else goes next.'
        )}
      </p>
    )
  }

  /**
   * The box empties the moment you hit send — waiting on a round trip to clear
   * it is what makes an app feel slow. If the send fails the text comes
   * straight back, so a line is never lost to a dropped connection.
   */
  async function submit(event: FormEvent) {
    event.preventDefault()
    const draft = body.trim()
    if (!draft) return

    const draftChapter = newChapter ? chapterTitle.trim() || undefined : undefined
    setBody('')
    setChapterTitle('')
    setNewChapter(false)
    setError(null)

    try {
      await onSubmit(draft, draftChapter)
    } catch (e) {
      setBody(draft)
      if (draftChapter) {
        setNewChapter(true)
        setChapterTitle(draftChapter)
      }
      setError(e instanceof Error ? e.message : 'Could not add that line')
    }
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0

  return (
    <form onSubmit={submit} className="px-4 pb-3 pt-2.5">
      {previousLine && !newChapter && (
        <p
          className="prose-story mb-2 line-clamp-1 border-l-2 pl-3 text-[0.9rem] italic"
          style={{ borderColor: 'rgb(var(--rule))', color: 'rgb(var(--faint))' }}
        >
          {previousLine.body}
        </p>
      )}

      {newChapter && (
        <input
          className="field mb-2 font-story"
          placeholder="Chapter name"
          maxLength={120}
          value={chapterTitle}
          onChange={(event) => setChapterTitle(event.target.value)}
        />
      )}

      <textarea
        className="field prose-story resize-none"
        rows={2}
        maxLength={2000}
        placeholder={previousLine ? 'Carry it on…' : 'The first line…'}
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
          New chapter
        </label>
        <div className="flex items-center gap-3">
          {words > 0 && (
            <span className="text-xs tabular-nums text-faint">
              {words} {words === 1 ? 'word' : 'words'}
            </span>
          )}
          <button type="submit" className="btn-accent" disabled={!body.trim()}>
            Add line
          </button>
        </div>
      </div>
    </form>
  )
}
