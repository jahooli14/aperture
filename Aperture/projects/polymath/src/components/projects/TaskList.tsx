/**
 * Task List Component
 * Checklist for project tasks with inline add/edit/delete
 */

import { useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface Task {
  id: string
  text: string
  done: boolean
  created_at: string
  order: number
}

interface TaskListProps {
  tasks: Task[]
  onUpdate: (tasks: Task[]) => void
}

export function TaskList({ tasks, onUpdate }: TaskListProps) {
  const [newTaskText, setNewTaskText] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)

  const handleAddTask = () => {
    if (!newTaskText.trim()) return

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: tasks.length
    }

    onUpdate([...tasks, newTask])
    setNewTaskText('')
    setIsAdding(false)
  }

  const handleToggleTask = (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, done: !task.done } : task
    )
    onUpdate(updatedTasks)
  }

  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId)
    // Reorder remaining tasks
    const reorderedTasks = updatedTasks.map((task, index) => ({
      ...task,
      order: index
    }))
    onUpdate(reorderedTasks)
  }

  const completedCount = tasks.filter(t => t.done).length
  const totalCount = tasks.length

  return (
    <Card className="pro-card">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <span className="text-lg">✓</span>
              Task Checklist
            </h3>
            {totalCount > 0 && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {completedCount} of {totalCount} completed
              </p>
            )}
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-green-700">
                {Math.round((completedCount / totalCount) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "group flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                task.done
                  ? "bg-neutral-50 border-neutral-200"
                  : "bg-white border-neutral-200 hover:border-blue-300 hover:bg-blue-50/30"
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggleTask(task.id)}
                className={cn(
                  "flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
                  task.done
                    ? "bg-green-600 border-green-600"
                    : "border-neutral-300 hover:border-blue-600 hover:bg-blue-50"
                )}
              >
                {task.done && <Check className="h-3 w-3 text-white" />}
              </button>

              {/* Task Text */}
              <span
                className={cn(
                  "flex-1 text-sm transition-all",
                  task.done
                    ? "text-neutral-500 line-through"
                    : "text-neutral-900"
                )}
              >
                {task.text}
              </span>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full hover:bg-red-50 text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Task Input */}
        {isAdding ? (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask()
                if (e.key === 'Escape') {
                  setIsAdding(false)
                  setNewTaskText('')
                }
              }}
              placeholder="Task description..."
              autoFocus
              className="flex-1 px-3 py-2 text-sm border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleAddTask}
              disabled={!newTaskText.trim()}
              size="sm"
              className="bg-blue-900 hover:bg-blue-800"
            >
              Add
            </Button>
            <Button
              onClick={() => {
                setIsAdding(false)
                setNewTaskText('')
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-900 hover:text-blue-700 transition-colors w-full p-2 rounded-lg hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}

        {/* Empty State */}
        {tasks.length === 0 && !isAdding && (
          <div className="text-center py-8 text-neutral-500">
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Break down your project into steps</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
