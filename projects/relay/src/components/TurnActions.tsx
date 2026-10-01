import { useState } from 'react'
import { api } from '../lib/api'

/**
 * What you can do while you wait: nudge whoever's up, or skip them if they're
 * away. A nudge is one push, once per turn — the button goes once it's used.
 */
export function TurnActions({
  storyId,
  canWrite,
  canNudge,
  canSkip,
  waitingOn,
  onChanged,
}: {
  storyId: string
  canWrite: boolean
  canNudge: boolean
  canSkip: boolean
  waitingOn: string | null
  onChanged: () => Promise<void> | void
}) {
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (canWrite) return null

  async function nudge() {
    setBusy(true)
    try {
      const { sent } = await api.nudge(storyId)
      setNote(sent > 0 ? 'Nudged.' : "Sent — but they don't have notifications on.")
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not nudge')
    } finally {
      setBusy(false)
      void onChanged()
    }
  }

  async function skip() {
    await api.skipTurn(storyId).catch(() => {})
    void onChanged()
  }

  if (!canNudge && !canSkip && !note) return null

  return (
    <div className="mb-3 flex items-center justify-center gap-4 text-xs text-faint">
      {note && <span>{note}</span>}
      {canNudge && !note && (
        <button className="underline hover:text-ink disabled:opacity-60" disabled={busy} onClick={nudge}>
          Nudge {waitingOn ?? 'everyone'}
        </button>
      )}
      {canSkip && (
        <button className="underline hover:text-ink" onClick={skip}>
          They're away — skip their turn
        </button>
      )}
    </div>
  )
}
