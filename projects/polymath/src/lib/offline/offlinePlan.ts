/**
 * Client-side session plan, built with no network call at all.
 *
 * `session-shaper.ts`'s "next tasks in order" path is already pure,
 * deterministic JS with zero AI dependency (openTasksInOrder/selectByBudget,
 * api/_lib/session-budget.ts) -- only the reshape/split/top-up LAYER on top
 * needs Gemini. This is a small port of that same selection logic, run
 * against the project data already cached in useProjectStore, so a plan
 * screen still shows something real when shapePlan's network call fails.
 *
 * Ported rather than imported from api/_lib/ to avoid any Vite/Rollup
 * cross-directory build risk -- keep this in sync by hand if the
 * server-side selection rules ever change (session-budget.ts,
 * session-shaper.ts's itemCountForWindow, session-split.ts's
 * doneLineForSteps).
 */

import type { Project } from '../../types'
import type { PlanDraft, PlanItem } from '../../stores/useSessionStore'

/** Mirrors session-budget.ts's DEFAULT_ESTIMATE_MINUTES -- the middle of
 *  the server's estimate ladder, neither optimistic nor pessimistic. */
const DEFAULT_ESTIMATE_MINUTES = 20

interface StoredTaskLike {
  id?: unknown
  text?: unknown
  done?: unknown
  order?: unknown
  estimated_minutes?: unknown
  estimate_set?: unknown
  progress_note?: unknown
}

interface OfflineOpenTask {
  id: string
  text: string
  minutes: number
  progressNote: string | null
}

function openTasksInOrder(allTasks: unknown[], limit: number): OfflineOpenTask[] {
  return (allTasks as StoredTaskLike[])
    .filter((t): t is StoredTaskLike & { id: string; text: string } =>
      !!t && !t.done && typeof t.text === 'string' && typeof t.id === 'string')
    .sort((a, b) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0))
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      text: t.text,
      minutes: t.estimate_set && typeof t.estimated_minutes === 'number'
        ? t.estimated_minutes
        : DEFAULT_ESTIMATE_MINUTES,
      progressNote: typeof t.progress_note === 'string' && t.progress_note.trim() ? t.progress_note.trim() : null,
    }))
}

function selectByBudget<T extends { minutes: number }>(
  tasks: T[],
  budgetMinutes: number | null,
  maxCount: number,
): T[] {
  if (budgetMinutes == null) return tasks.slice(0, maxCount)
  const selected: T[] = []
  let used = 0
  for (const t of tasks) {
    if (selected.length >= maxCount) break
    if (selected.length > 0 && used + t.minutes > budgetMinutes) break
    selected.push(t)
    used += t.minutes
  }
  return selected
}

/** "3-6 depending on time" -- same ceiling as itemCountForWindow in
 *  session-shaper.ts. A ceiling, never a target to pad up to. */
function itemCountForWindow(windowMinutes: number | null): number {
  if (windowMinutes == null) return 4
  if (windowMinutes <= 20) return 3
  if (windowMinutes <= 45) return 4
  if (windowMinutes <= 75) return 5
  return 6
}

const OPEN_TASK_LIMIT = 24

/**
 * A real, honest plan drawn straight from the project's own next steps --
 * no reshape, no split, no top-up, since all three need a model call this
 * function will never make. Empty backlog returns an empty, honest plan
 * (source 'offline', items []) rather than inventing one.
 */
export function buildOfflinePlan(project: Project, windowMinutes: number | null): PlanDraft {
  const allTasks: unknown[] = Array.isArray(project.metadata?.tasks) ? project.metadata!.tasks : []
  const openTasks = openTasksInOrder(allTasks, OPEN_TASK_LIMIT)
  const count = itemCountForWindow(windowMinutes)
  const selected = selectByBudget(openTasks, windowMinutes, count)

  const items: PlanItem[] = selected.map(t => ({
    text: t.text,
    source: t.progressNote ? `last time: ${t.progressNote}` : 'already on the project',
    taskId: t.id,
    partial: false,
  }))

  return {
    projectId: project.id,
    windowMinutes,
    items,
    doneLooksLike: doneLineForSteps(selected),
    needsInput: null,
    gapKind: null,
    slotName: null,
    source: 'offline',
    friction: null,
    packdown: null,
    truncatedCount: Math.max(0, openTasks.length - selected.length),
    planned: 0,
    unblocked: null,
    removed: [],
  }
}

/** What "done today" means when the plan is real steps taken verbatim --
 *  no model needed, mirrors session-split.ts's doneLineForSteps. */
function doneLineForSteps(steps: { text: string }[]): string | null {
  if (steps.length === 0) return null
  const last = steps[steps.length - 1].text.replace(/[.!?]+$/, '')
  if (steps.length === 1) return `"${last}" ticked off.`
  return `Through to "${last}".`
}
