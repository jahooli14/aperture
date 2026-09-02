/**
 * Pure reducer for project-chat task operations.
 *
 * Lives in its own file (with no React / Supabase imports) so the rules can
 * be unit-tested without booting the whole component tree.
 */

import type { Task } from './TaskList'

export interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit' | 'add' | 'move'
  taskId?: string
  newText?: string
  /** move: the task this one goes after. Null/absent means the top. */
  afterTaskId?: string | null
  task_type?: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

/** Every write renumbers, so `order` stays contiguous and meaningful --
 *  the session takes the top open tasks in this order, so a gap or a tie
 *  is a session spent on the wrong thing. Mirrors task-order.ts on the
 *  server. */
function renumber(tasks: Task[]): Task[] {
  return tasks.map((t, order) => (t.order === order ? t : { ...t, order }))
}

export function applyOpToTasks(tasks: Task[], op: TaskOp): Task[] {
  if (op.action === 'add') {
    if (!op.newText) return tasks
    const now = new Date().toISOString()
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: op.newText,
      done: false,
      created_at: now,
      order: tasks.length,
      is_ai_suggested: true,
      ai_reasoning: op.reasoning,
      task_type: op.task_type,
      estimated_minutes: op.estimated_minutes,
    }
    return renumber([...tasks, newTask])
  }
  if (!op.taskId) return tasks
  switch (op.action) {
    case 'complete':
      return tasks.map(t => t.id === op.taskId ? { ...t, done: true, completed_at: new Date().toISOString() } : t)
    case 'uncomplete':
      return tasks.map(t => t.id === op.taskId ? { ...t, done: false, completed_at: undefined } : t)
    case 'delete':
      return renumber(tasks.filter(t => t.id !== op.taskId))
    case 'edit':
      if (!op.newText) return tasks
      return tasks.map(t => t.id === op.taskId ? { ...t, text: op.newText! } : t)
    case 'move': {
      // The order is the plan: a step that can't start until another is
      // finished belongs below it. Moving to a target that doesn't exist
      // (or onto itself) is a no-op rather than a silent reshuffle.
      const from = tasks.findIndex(t => t.id === op.taskId)
      if (from === -1) return tasks
      const after = op.afterTaskId ?? null
      if (after === op.taskId) return tasks
      if (after !== null && !tasks.some(t => t.id === after)) return tasks
      const next = [...tasks]
      const [moved] = next.splice(from, 1)
      const at = after === null ? 0 : next.findIndex(t => t.id === after) + 1
      next.splice(at, 0, moved)
      return renumber(next)
    }
    default:
      return tasks
  }
}

export function opKey(op: TaskOp, i: number): string {
  return `${op.action}:${op.taskId ?? op.newText ?? ''}:${i}`
}
