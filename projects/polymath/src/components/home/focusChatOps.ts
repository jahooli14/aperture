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
import type { TaskOp } from '../projects/inlineGuideOps'

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
  nextTaskId?: string
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
  /** Minutes the user said they've got, only ever set on start_session — so
   *  the session plan is actually sized to right-now instead of defaulting
   *  to a generic 60 minutes regardless of what they told the chat. */
  minutesAvailable?: number
}

/** A brand-new project the chat wants to start, as opposed to an action on
 *  one that already exists.
 *
 *  This exists because every PortfolioAction requires a projectId that's
 *  already in the portfolio — so when the user asked for "something new,"
 *  the model had no legal move that wasn't an existing project, and kept
 *  mapping the request onto one. That read as not listening; it was
 *  actually the action vocabulary being incomplete. */
export interface PortfolioNewProject {
  title: string
  pitch: string
  firstStep?: string
  reasoning?: string
  /** Set when this came out of the pending ideas queue rather than being
   *  described fresh, so accepting it can also clear it from that queue
   *  instead of leaving a near-duplicate behind. */
  ideaId?: string
}

/** Same defensive posture as parsePortfolioAction — this reaches a real
 *  createProject call once confirmed, so a malformed or empty proposal
 *  must not get that far. */
export function parsePortfolioNewProject(raw: unknown): PortfolioNewProject | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const title = typeof a.title === 'string' ? a.title.trim() : ''
  const pitch = typeof a.pitch === 'string' ? a.pitch.trim() : ''
  if (!title || !pitch) return null
  return {
    title,
    pitch,
    firstStep: typeof a.firstStep === 'string' && a.firstStep.trim() ? a.firstStep.trim() : undefined,
    reasoning: typeof a.reasoning === 'string' ? a.reasoning : undefined,
    ideaId: typeof a.ideaId === 'string' && a.ideaId ? a.ideaId : undefined,
  }
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
    const nextTask = getNextTask(p) as { id?: string; text: string; estimated_minutes?: number } | undefined
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
      nextTaskId: nextTask?.id,
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
  // Clamped to a sane range rather than trusted verbatim — this reaches a
  // real API call (power-hour's duration param) once the user confirms.
  const minutesAvailable = typeof a.minutesAvailable === 'number' && Number.isFinite(a.minutesAvailable)
    ? Math.min(180, Math.max(5, Math.round(a.minutesAvailable)))
    : undefined
  return {
    type: a.type as PortfolioActionType,
    projectId: a.projectId,
    projectTitle: typeof a.projectTitle === 'string' && a.projectTitle ? a.projectTitle : a.projectId,
    reasoning: typeof a.reasoning === 'string' ? a.reasoning : undefined,
    minutesAvailable: a.type === 'start_session' ? minutesAvailable : undefined,
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

const PORTFOLIO_TASK_OP_ACTIONS = ['edit', 'complete', 'add'] as const
type PortfolioTaskOpAction = typeof PORTFOLIO_TASK_OP_ACTIONS[number]

/** A single stale-next-step correction, tied to one project. Deliberately
 *  narrower than the per-project Guide's full taskOps (edit/complete/add
 *  only, no delete/uncomplete) — this exists to fix ONE stale next-step so
 *  a recommendation isn't working off out-of-date data, not to curate a
 *  task list. Wraps a real `TaskOp` (inlineGuideOps.ts) — narrowed to the
 *  3 allowed actions at the type level, not just at runtime via
 *  parsePortfolioTaskOp — so applying it still reuses the same tested
 *  reducer the per-project Guide already uses. */
export interface PortfolioTaskOp {
  projectId: string
  projectTitle: string
  op: TaskOp & { action: PortfolioTaskOpAction }
}

export type Message =
  | {
      kind: 'guide'
      content: string
      action?: PortfolioAction | null
      actionResolved?: boolean
      actionDismissed?: boolean
      // A reply can carry both — e.g. fixing a stale next step AND
      // proposing to start a session on the corrected one — so each gets
      // its own independent confirm/dismiss state.
      taskOp?: PortfolioTaskOp | null
      taskOpResolved?: boolean
      taskOpDismissed?: boolean
      // Mutually exclusive with `action` in practice (the prompt allows
      // exactly one proposal per turn), but tracked separately because it
      // has no projectId to validate against and lands on a different
      // mutation — creating a project rather than acting on one.
      newProject?: PortfolioNewProject | null
      newProjectResolved?: boolean
      newProjectDismissed?: boolean
    }
  | { kind: 'you'; content: string }

/** Same reasoning as parsePortfolioAction: validate before a hallucinated
 *  or malformed op reaches a real mutation. Takes the full summaries (not
 *  just known ids) because "add" is only legitimate when the project has
 *  no existing correctable next task — the prompt (JOB 3) says so, but
 *  that's not something the model is guaranteed to actually follow. */
export function parsePortfolioTaskOp(raw: unknown, knownProjects: ReadonlyMap<string, PortfolioProjectSummary>): PortfolioTaskOp | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  if (typeof a.projectId !== 'string' || !a.projectId) return null
  const project = knownProjects.get(a.projectId)
  if (!project) return null
  if (typeof a.action !== 'string' || !(PORTFOLIO_TASK_OP_ACTIONS as readonly string[]).includes(a.action)) return null
  const action = a.action as 'edit' | 'complete' | 'add'
  const newText = typeof a.newText === 'string' ? a.newText.trim() : ''
  const taskId = typeof a.taskId === 'string' ? a.taskId : ''
  if (action === 'add' && !newText) return null
  if (action !== 'add' && !taskId) return null
  if (action === 'edit' && !newText) return null
  // "add" appends to the end of the list; getNextTask sorts by order and
  // returns the first undone one — so it can never override an existing
  // next task, only pile a redundant duplicate behind it. Checked against
  // nextTaskText, not nextTaskId: an id-less legacy task still blocks
  // "add" from fixing anything (that's the exact case it can't help with).
  if (action === 'add' && project.nextTaskText) return null
  return {
    projectId: a.projectId,
    projectTitle: typeof a.projectTitle === 'string' && a.projectTitle ? a.projectTitle : project.title,
    op: {
      action,
      taskId: taskId || undefined,
      newText: newText || undefined,
      reasoning: typeof a.reasoning === 'string' ? a.reasoning : undefined,
    },
  }
}

export function describePortfolioTaskOp(op: TaskOp): { label: string; verb: string } {
  switch (op.action) {
    case 'edit': return { label: 'Fix the next step', verb: 'Fix' }
    case 'complete': return { label: 'Mark it done', verb: 'Mark done' }
    case 'add': return { label: 'Add the real next step', verb: 'Add' }
    default: return { label: 'Update task', verb: 'Update' }
  }
}
