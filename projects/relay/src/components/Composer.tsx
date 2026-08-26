import { useEffect, useRef, useState, type FormEvent } from 'react'
import { clearDraft, readDraft, saveDraft } from '../lib/outbox'

/**
 * Writing the next line.
 *
 * The line you're following sits above the box, greyed out — you're continuing
 * a sentence someone else started, not replying to a message.
 *
 * You can type when it isn't your turn. Ideas don't wait for permission, and a
 * half-formed line kept until your go is better than one lost because the app
 * wouldn't let you start it.
 */
export function Composer({
  storyId,
  canWrite,
  waitingOn,
  previousLine,
  queuedBody,
  onSubmit,
}: {
  storyId: string
  canWrite: boolean
  waitingOn: string | null
  previousLine: { body: string; display_name: string } | null
  /** A line that failed to send and is waiting for the connection to return. */
  queuedBody?: string | null
  onSubmit: (body: string, chapterTitle?: string) => Promise<void>
}) {
  const [body, setBody] = useState(() => readDraft(storyId))
  const [chapterTitle, setChapterTitle] = useState('')
  const [newChapter, setNewChapter] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Keep what's typed, per story, as it's typed.
  useEffect(() => {
    saveDraft(storyId, body)
  }, [storyId, body])

  // Grow with the writing rather than making people scroll a small box.
  useEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [body])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const draft = body.trim()
    if (!draft || !canWrite) return

    const draftChapter = newChapter ? chapterTitle.trim() || undefined : undefined
    setBody('')
    setChapterTitle('')
    setNewChapter(false)
    clearDraft(storyId)
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
      {queuedBody && (
        <p className="mb-2 rounded-lg border border-rule bg-sunk px-3 py-2 text-xs text-muted">
          One line is waiting to send. It'll go as soon as you're back online.
        </p>
      )}

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
        ref={textarea}
        className="field prose-story resize-none"
        rows={2}
        maxLength={2000}
        placeholder={canWrite ? (previousLine ? 'Carry it on…' : 'The first line…') : 'Get one ready…'}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}

      <div className="mt-2 flex items-center justify-between gap-3">
        {canWrite ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={newChapter}
              onChange={(event) => setNewChapter(event.target.checked)}
            />
            New chapter
          </label>
        ) : (
          <span className="text-xs text-muted">
            {waitingOn ? (
              <>
                With <span className="font-medium text-ink">{waitingOn}</span>
                {body.trim() ? ' — saved for your go' : ''}
              </>
            ) : (
              'You wrote the last line'
            )}
          </span>
        )}

        <div className="flex items-center gap-3">
          {words > 0 && (
            <span className="text-xs tabular-nums text-faint">
              {words} {words === 1 ? 'word' : 'words'}
            </span>
          )}
          <button type="submit" className="btn-accent" disabled={!canWrite || !body.trim()}>
            Add line
          </button>
        </div>
      </div>
    </form>
  )
}
