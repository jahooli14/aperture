/**
 * Task Utilities
 * Shared helpers for project task operations
 */

import type { Project } from '../types'

interface Task {
  id?: string
  text: string
  done: boolean
  order: number
}

/**
 * Returns the first uncompleted task from a project's task list,
 * sorted by order. Returns undefined if no tasks or all complete.
 */
export function getNextTask(project: Project): Task | undefined {
  const tasks = (project.metadata?.tasks || []) as Task[]
  return [...tasks].sort((a, b) => a.order - b.order).find(task => !task.done)
}
