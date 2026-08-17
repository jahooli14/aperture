/**
 * Pure logic for the Focus chat (portfolio-level triage).
 *
 * Lives in its own file (no React / Supabase imports) so summarizing,
 * the deterministic opening line, and validating what the AI proposes can
 * be unit-tested without booting the component tree — same reasoning as
 * inlineGuideOps.ts for the per-project Guide.
 */

import type { Project } from '../../types'
import { getNextTask } from '../../lib/taskUtils'

export interface PortfolioProjectSummary {
  id: string
  title: string
  type?: string
  status: string
  is_priority: boolean
  up_next_position: number | null
  daysSinceActive: number
  progressPercent: number
  totalTasks: number
  completedTasks: number
  nextTaskText?: string
  nextTaskMinutes?: number
  heatReason?: string
  evolvedDescription?: string
}

export const PORTFOLIO_ACTION_TYPES = [
  'set_priority', 'add_up_next', 'remove_up_next', 'bury', 'start_session',
] as const

export type PortfolioActionType = typeof PORTFOLIO_ACTION_TYPES[number]

export interface PortfolioAction {
  type: PortfolioActionType
  projectId: string
  projectTitle: string
  reasoning?: string
}

export function daysSince(dateStr?: string): number {
  if (!dateStr) return 0
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

export function toPortfolioSummaries(projects: Project[]): PortfolioProjectSummary[] {
  return projects.map(p => {
    const tasks = (p.metadata?.tasks as { done: boolean }[] | undefined) || []
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.done).length
    const nextTask = getNextTask(p) as { text: string; estimated_minutes?: number } | undefined
    return {
      id: p.id,
      title: p.title,
      type: p.type || undefined,
      status: p.status,
      is_priority: !!p.is_priority,
      up_next_position: p.up_next_position ?? null,
      daysSinceActive: daysSince(p.last_active || p.created_at),
      progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalTasks,
      completedTasks,
      nextTaskText: nextTask?.text,
      nextTaskMinutes: nextTask?.estimated_minutes,
      heatReason: p.heat_reason,
      evolvedDescription: p.metadata?.evolved_description as string | undefined,
    }
  })
}

/** No AI, no network call — built from data already loaded on Home so the
 *  pill has something to say the instant it renders. */
export function buildOpeningLine(summaries: PortfolioProjectSummary[]): string {
  const count = summaries.length
  const stalest = [...summaries]
    .filter(p => !p.is_priority)
    .sort((a, b) => b.daysSinceActive - a.daysSinceActive)[0]

  if (stalest && stalest.daysSinceActive >= 14) {
    const reason = stalest.heatReason || stalest.evolvedDescription
    return `${count} things going. "${stalest.title}" has been quiet ${stalest.daysSinceActive} days${reason ? ` — ${reason}` : ''}. What sounds right today?`
  }
  const warmed = summaries.find(p => !p.is_priority && p.heatReason)
  if (warmed) {
    return `${count} things going. Something new connects to "${warmed.title}". What sounds right today?`
  }
  const priority = summaries.find(p => p.is_priority)
  if (priority) {
    return `${count} things going, priority's on "${priority.title}". Still feels right, or want something else today?`
  }
  return `${count} things going. What sounds right today?`
}

export function describeAction(type: PortfolioActionType): { label: string; verb: string } {
  switch (type) {
    case 'start_session': return { label: 'Start a session', verb: 'Start' }
    case 'set_priority': return { label: 'Make this the priority', verb: 'Make priority' }
    case 'add_up_next': return { label: 'Add to Up Next', verb: 'Add' }
    case 'remove_up_next': return { label: 'Take off Up Next', verb: 'Remove' }
    case 'bury': return { label: 'Send to the graveyard', verb: 'Bury' }
  }
}

/** Validates a raw action from the API response — the server only checks
 *  `typeof type === 'string'`, not that it's one of the known enum values,
 *  so an off-spec or hallucinated type must not reach the UI unchecked.
 *  `knownProjectIds` guards against a hallucinated or stale project id
 *  (e.g. one that got buried between the summaries being sent and the
 *  reply coming back) reaching a real mutation call with just a generic
 *  error toast as the backstop. */
export function parsePortfolioAction(raw: unknown, knownProjectIds: ReadonlySet<string>): PortfolioAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string' || !(PORTFOLIO_ACTION_TYPES as readonly string[]).includes(a.type)) return null
  if (typeof a.projectId !== 'string' || !a.projectId) return null
  if (!knownProjectIds.has(a.projectId)) return null
  return {
    type: a.type as PortfolioActionType,
    projectId: a.projectId,
    projectTitle: typeof a.projectTitle === 'string' && a.projectTitle ? a.projectTitle : a.projectId,
    reasoning: typeof a.reasoning === 'string' ? a.reasoning : undefined,
  }
}

/** Up Next is a toggle server-side, keyed off current pin state — not off
 *  which action the AI proposed. If the project's actual pin state already
 *  matches the requested end state (e.g. "remove" on something that isn't
 *  pinned), calling the toggle would silently do the opposite. */
export function isUpNextActionNoOp(currentPosition: number | null | undefined, type: PortfolioActionType): boolean {
  const isPinned = currentPosition != null
  if (type === 'add_up_next') return isPinned
  if (type === 'remove_up_next') return !isPinned
  return false
}

/** setPriority is also a toggle server-side (keyed off the project's
 *  current is_priority, cap 1) — same class of bug as isUpNextActionNoOp.
 *  Without this, confirming "make X priority" on a project that's already
 *  the priority would silently unstar it instead. */
export function isSetPriorityNoOp(currentIsPriority: boolean, type: PortfolioActionType): boolean {
  return type === 'set_priority' && currentIsPriority
}
