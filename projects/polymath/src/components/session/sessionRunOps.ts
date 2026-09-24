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
    .map(sh => splitDoneWhen(sh.text).move.trim().replace(/[.!?]+$/, ''))
    .filter(Boolean)
  return done.length > 0 ? `Did: ${done.join('. ')}.` : ''
}

/**
 * A first move ends "Done when …" (plain-english.ts, FIRST_MOVE_RULES).
 * On screen that's two things: the move, which is what you do, and the
 * stopping point, which is quieter and sits under it. Text without one
 * comes back whole.
 */
export function splitDoneWhen(text: string): { move: string; doneWhen: string | null } {
  const m = text.match(/^(.*?[.!?])\s+(done when\b.*)$/i)
  if (!m) return { move: text, doneWhen: null }
  return { move: m[1].trim(), doneWhen: m[2].trim().replace(/^done when/i, 'Done when') }
}

/** Under this, with nothing ticked, the session didn't really get going. */
export const SHORT_SESSION_SECONDS = 10 * 60

/**
 * SPEC.md, closing: normally "where'd you get to?", but after a short or
 * abandoned session, "what got in the way?" -- a bad session is data about
 * conditions, and the wrong question there gets no answer. Either way the
 * breadcrumb asks for where you stopped and what's next, because that is
 * the next session's opening move.
 */
export function closeoutPrompt(elapsedSec: number, tickedCount: number): {
  question: string
  placeholder: string
} {
  if (elapsedSec < SHORT_SESSION_SECONDS && tickedCount === 0) {
    return {
      question: 'What got in the way?',
      placeholder: 'Got interrupted… couldn’t find the file… wasn’t feeling it…',
    }
  }
  return {
    question: 'Where did you stop, and what’s next?',
    placeholder: 'Stopped at … Next … What’s bugging me …',
  }
}

interface ListTask { id?: unknown; text?: unknown; done?: unknown; order?: unknown }

/**
 * The list ran out before the session did. Rather than an empty screen or
 * a new plan, the next step already on the project -- the one this
 * session didn't include -- offered quietly as a way to keep going.
 */
export function nextOffList(tasks: unknown, shapes: SessionShape[]): string | null {
  if (!Array.isArray(tasks)) return null
  const inSession = new Set(shapes.map(sh => sh.taskId).filter(Boolean))
  const open = (tasks as ListTask[])
    .filter(t => t && t.done !== true && typeof t.text === 'string' && typeof t.id === 'string' && !inSession.has(t.id))
    .sort((a, b) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0))
  return open.length > 0 ? (open[0].text as string) : null
}
