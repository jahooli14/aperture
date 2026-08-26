import { useEffect, useState } from 'react'
import { api } from './api'
import { dequeueLine, queuedFor } from './outbox'
import type { Line } from './types'

/**
 * A line that failed to send goes out again as soon as there's a connection.
 * Returns the body still waiting, so the composer can say so.
 */
export function useOutbox(storyId: string | undefined, onSent: () => void) {
  const [queued, setQueued] = useState<string | null>(null)

  useEffect(() => {
    if (!storyId) return
    setQueued(queuedFor(storyId)?.body ?? null)

    async function flush() {
      const pending = queuedFor(storyId as string)
      if (!pending) return
      try {
        await api.addLine(pending.storyId, pending.body, pending.chapterTitle)
        dequeueLine(pending.storyId)
        setQueued(null)
        onSent()
      } catch {
        // Still not going through. It stays queued.
      }
    }

    void flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [storyId, onSent])

  return [queued, setQueued] as const
}

/**
 * Remembers how far you've read, on the server, so it follows you from the
 * phone to the laptop. Only ever moves forward, and only after a pause — so
 * scrolling past something doesn't count as having read it.
 */
export function useReadPosition(
  storyId: string | undefined,
  lines: Line[],
  currentPosition: number
) {
  useEffect(() => {
    if (!storyId || lines.length === 0) return
    const newest = lines[lines.length - 1].position
    if (newest <= currentPosition) return
    const timer = setTimeout(() => void api.setReadPosition(storyId, newest).catch(() => {}), 4000)
    return () => clearTimeout(timer)
  }, [storyId, lines, currentPosition])
}
