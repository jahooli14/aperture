/**
 * The pure parts of a running session, out of the component so they can be
 * tested. SessionContract.tsx reaches the stores, which reach apiClient and
 * Supabase's build-time constants, so it can't be imported under vitest —
 * same reason reviewRotationOps.ts and focusProjectOps.ts exist.
 *
 * Everything here was found by walking the session rather than reading it,
 * so each function is the fix for a real way the hour got lost.
 */

import type { SessionShape } from '../../stores/useSessionStore'

/** Ticks are a fact about this sitting: they must survive a remount (you
 *  stepped off home to capture a thought) and must not survive the day. */
export function ticksKey(sessionId: string): string {
  return `aperture-session-ticks:${sessionId}`
}

export function loadTicks(sessionId: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(ticksKey(sessionId))
    const parsed = raw ? JSON.parse(raw) : null
    return new Set(Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === 'number') : [])
  } catch {
    return new Set()
  }
}

export function saveTicks(sessionId: string, ticked: Set<number>) {
  try {
    sessionStorage.setItem(ticksKey(sessionId), JSON.stringify([...ticked]))
  } catch {
    // Storage unavailable — the ticks still work for this mount.
  }
}

/**
 * A wall clock, not an accumulator. Counting `setInterval` ticks meant a
 * phone locking mid-session suspended the timer: an hour of real work came
 * back reading four minutes, on the one screen this whole product is about
 * not losing the hour on.
 */
export function elapsedSeconds(startedAt: string, nowMs: number): number {
  const started = new Date(startedAt).getTime()
  if (!Number.isFinite(started)) return 0
  return Math.max(0, Math.floor((nowMs - started) / 1000))
}

/**
 * The spark is a punt with a time box on it, agreed to as something you
 * can ignore. Starting the session doesn't turn it into a step you owe, so
 * it comes out of the numbered work and can never be promoted to "Right
 * now" just because the real list is done.
 */
export function partitionRunningShapes(shapes: SessionShape[]): {
  workIndexes: number[]
  sparkIndex: number
} {
  const workIndexes: number[] = []
  let sparkIndex = -1
  shapes.forEach((shape, i) => {
    if (shape.source === 'spark' && sparkIndex < 0) sparkIndex = i
    else workIndexes.push(i)
  })
  return { workIndexes, sparkIndex }
}

/**
 * The honest first draft of a close-out, so the box is never empty at the
 * moment attention is lowest. Setup and pack-down are ticked like anything
 * else but they are not what you did — "Did: Got the paints out. Cleaned
 * the brushes." is a worse answer than saying nothing.
 */
export function closeoutDraft(shapes: SessionShape[], ticked: Set<number>): string {
  const done = shapes
    .filter((sh, i) => ticked.has(i) && sh.source !== 'friction')
    .map(sh => sh.text.trim().replace(/[.!?]+$/, ''))
    .filter(Boolean)
  return done.length > 0 ? `Did: ${done.join('. ')}.` : ''
}
