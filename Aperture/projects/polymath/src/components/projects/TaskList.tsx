/**
 * Task List Component
 * Checklist for project tasks with inline add/edit/delete
 */

import { useState } from 'react'
import { Plus, Trash2, Check, GripVertical } from 'lucide-react'
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
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

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

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId)
  }

  const handleDragOver = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    if (!draggedTaskId || draggedTaskId === targetTaskId) return

    const draggedIndex = sortedTasks.findIndex(t => t.id === draggedTaskId)
    const targetIndex = sortedTasks.findIndex(t => t.id === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder tasks
    const newTasks = [...sortedTasks]
    const [draggedTask] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    // Update order property
    const reorderedTasks = newTasks.map((task, index) => ({
      ...task,
      order: index
    }))

    onUpdate(reorderedTasks)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
  }

  const completedCount = tasks.filter(t => t.done).length
  const totalCount = tasks.length

  return (
    <Card className="premium-card">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold premium-text-platinum flex items-center gap-2">
              <span className="text-lg">✓</span>
              Task Checklist
            </h3>
            {totalCount > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--premium-text-tertiary)' }}>
                {completedCount} of {totalCount} completed
              </p>
            )}
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${(completedCount / totalCount) * 100}%`,
                    background: 'linear-gradient(90deg, #10b981, #059669)'
                  }}
                />
              </div>
              <span className="text-xs font-semibold" style={{ color: '#10b981' }}>
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
              draggable
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragEnd={handleDragEnd}
              className="group flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-move"
              style={{
                borderColor: task.done ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: task.done ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.03)',
                opacity: draggedTaskId === task.id ? 0.5 : 1
              }}
            >
              {/* Drag Handle */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" style={{ color: 'var(--premium-text-tertiary)' }}>
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Checkbox */}
              <button
                onClick={() => handleToggleTask(task.id)}
                className="flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: task.done ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                  backgroundColor: task.done ? '#10b981' : 'transparent'
                }}
              >
                {task.done && <Check className="h-3 w-3 text-white" />}
              </button>

              {/* Task Text */}
              <span
                className={cn(
                  "flex-1 text-sm transition-all",
                  task.done && "line-through"
                )}
                style={{
                  color: task.done ? 'var(--premium-text-tertiary)' : 'var(--premium-text-primary)'
                }}
              >
                {task.text}
              </span>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--premium-text-tertiary)' }}
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
              className="flex-1 px-3 py-2 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 premium-glass"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: 'var(--premium-text-primary)'
              }}
            />
            <button
              onClick={handleAddTask}
              disabled={!newTaskText.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                color: 'white'
              }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setNewTaskText('')
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-all"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'var(--premium-text-primary)'
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="mt-3 flex items-center gap-2 text-sm font-medium transition-colors w-full p-2 rounded-lg hover:bg-white/5"
            style={{ color: 'var(--premium-blue)' }}
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}

        {/* Empty State */}
        {tasks.length === 0 && !isAdding && (
          <div className="text-center py-8" style={{ color: 'var(--premium-text-tertiary)' }}>
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Break down your project into steps</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
