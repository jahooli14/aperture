/**
 * Pure reducer for project-chat task operations.
 *
 * Lives in its own file (with no React / Supabase imports) so the rules can
 * be unit-tested without booting the whole component tree.
 */

import type { Task } from './TaskList'

export interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit' | 'add'
  taskId?: string
  newText?: string
  task_type?: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
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
    return [...tasks, newTask]
  }
  if (!op.taskId) return tasks
  switch (op.action) {
    case 'complete':
      return tasks.map(t => t.id === op.taskId ? { ...t, done: true, completed_at: new Date().toISOString() } : t)
    case 'uncomplete':
      return tasks.map(t => t.id === op.taskId ? { ...t, done: false, completed_at: undefined } : t)
    case 'delete':
      return tasks.filter(t => t.id !== op.taskId)
    case 'edit':
      if (!op.newText) return tasks
      return tasks.map(t => t.id === op.taskId ? { ...t, text: op.newText! } : t)
    default:
      return tasks
  }
}

export function opKey(op: TaskOp, i: number): string {
  return `${op.action}:${op.taskId ?? op.newText ?? ''}:${i}`
}
