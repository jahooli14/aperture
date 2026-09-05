/**
 * Minutes-aware selection over a project's real open tasks.
 *
 * itemCountForWindow (session-shaper.ts) caps how many things a session can
 * plausibly hold, but two 30-minute tasks fill an hour just as completely
 * as five ten-minute ones. Capping by COUNT alone either cuts a real task
 * short of the window it could have filled, or crams in more than there's
 * actually time for. This picks by minutes; count stays a ceiling, not a
 * target.
 */

import { DEFAULT_ESTIMATE_MINUTES, type EstimateMinutes } from './session-estimate.js'

export interface BudgetTask {
  id: string
  text: string
  minutes: EstimateMinutes
}

interface StoredTaskLike {
  id?: unknown
  text?: unknown
  done?: unknown
  order?: unknown
  estimated_minutes?: unknown
  estimate_set?: unknown
}

/**
 * Open tasks, in the order the user actually left them (respects manual
 * drag-reorder in TaskList.tsx, rather than whatever order they happen to
 * sit in the stored array) — each carrying its real estimate, or the
 * neutral default when none has been set yet. Never a model call just to
 * find that out; an unestimated task gets estimated for real the next time
 * it's generated or replanned, not guessed at on every single triage.
 */
export function openTasksInOrder(allTasks: unknown[], limit: number): BudgetTask[] {
  return (allTasks as StoredTaskLike[])
    .filter((t): t is StoredTaskLike & { id: string; text: string } =>
      !!t && !t.done && typeof t.text === 'string' && typeof t.id === 'string')
    .sort((a, b) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0))
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      text: t.text,
      minutes: (t.estimate_set && typeof t.estimated_minutes === 'number'
        ? t.estimated_minutes
        : DEFAULT_ESTIMATE_MINUTES) as EstimateMinutes,
    }))
}

/**
 * Greedily fills a time budget from an already-ordered list. Never returns
 * an empty selection just because the very first task alone would exceed
 * the budget — a session with one honest, longer-than-planned task beats
 * an empty plan because nothing "fit".
 */
export function selectByBudget<T extends { minutes: number }>(
  tasks: T[],
  budgetMinutes: number | null,
  maxCount: number,
): { selected: T[]; rest: T[] } {
  if (budgetMinutes == null) {
    return { selected: tasks.slice(0, maxCount), rest: tasks.slice(maxCount) }
  }
  const selected: T[] = []
  let used = 0
  for (const t of tasks) {
    if (selected.length >= maxCount) break
    if (selected.length > 0 && used + t.minutes > budgetMinutes) break
    selected.push(t)
    used += t.minutes
  }
  return { selected, rest: tasks.slice(selected.length) }
}

export function sumMinutes(tasks: { minutes: number }[]): number {
  return tasks.reduce((total, t) => total + t.minutes, 0)
}

/**
 * The hour you actually get to work in.
 *
 * Some projects cannot be started cold. Painting needs the paint got out,
 * a surface covered and, at the other end, brushes cleaned before you can
 * walk away. That time is real and it is spent inside the window, so an
 * hour with ten minutes of setting up and ten of clearing away is a
 * forty-minute session. Planning it as sixty guarantees it overruns, which
 * is the specific way a rare hour gets lost.
 *
 * Floored at 5 rather than 0: a window swallowed whole by its own setup
 * still gets one small thing to do, and the caller can say the window is
 * too short for this project rather than showing an empty plan.
 */
export function workingMinutes(
  windowMinutes: number | null,
  setupMinutes?: number | null,
  packdownMinutes?: number | null,
): number | null {
  if (windowMinutes == null) return null
  const overhead = (setupMinutes ?? 0) + (packdownMinutes ?? 0)
  return Math.max(5, windowMinutes - overhead)
}
