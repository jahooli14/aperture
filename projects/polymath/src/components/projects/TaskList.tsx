/**
 * Task List Component
 * Checklist for project tasks with inline add/edit/delete
 */

import { useState } from 'react'
import { Plus, Trash2, Check, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { handleInputFocus } from '../../utils/keyboard'

export interface Task {
  id: string
  text: string
  done: boolean
  created_at: string
  order: number
  completed_at?: string
}

interface TaskListProps {
  tasks: Task[]
  onUpdate: (tasks: Task[]) => void
}

export function TaskList({ tasks, onUpdate }: TaskListProps) {
  const [newTaskText, setNewTaskText] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)
  const incompleteTasks = sortedTasks.filter(t => !t.done)
  const completedTasks = sortedTasks.filter(t => t.done)

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
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        const isDone = !task.done
        return {
          ...task,
          done: isDone,
          completed_at: isDone ? new Date().toISOString() : undefined
        }
      }
      return task
    })
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

  const handleEditStart = (taskId: string, text: string) => {
    setEditingTaskId(taskId)
    setEditingText(text)
  }

  const handleEditSave = (taskId: string) => {
    if (!editingText.trim()) return

    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, text: editingText.trim() } : task
    )
    onUpdate(updatedTasks)
    setEditingTaskId(null)
    setEditingText('')
  }

  const handleEditCancel = () => {
    setEditingTaskId(null)
    setEditingText('')
  }

  const completedCount = tasks.filter(t => t.done).length
  const totalCount = tasks.length

  return (
    <div className="rounded-xl" style={{
      background: 'var(--premium-bg-2)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      padding: '1.25rem'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold premium-text-platinum">
            Task Checklist
          </h3>
          {totalCount > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--premium-text-tertiary)' }}>
              {completedCount} of {totalCount} completed
            </p>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {/* Incomplete Tasks */}
        {incompleteTasks.map((task, index) => {
          const isNextTask = index === 0
          return (
            <div
              key={task.id}
              draggable
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragEnd={handleDragEnd}
              className="group flex items-center gap-2 p-2.5 rounded-lg transition-all cursor-move"
              style={{
                background: isNextTask ? 'var(--premium-bg-3)' : 'rgba(255, 255, 255, 0.03)',
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
                className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all"
                style={{
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                {task.done && <Check className="h-3 w-3 text-white" />}
              </button>

              {/* Task Text */}
              {editingTaskId === task.id ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onFocus={handleInputFocus}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSave(task.id)
                    if (e.key === 'Escape') handleEditCancel()
                  }}
                  className="flex-1 px-2 py-1 text-sm rounded focus:outline-none focus:ring-2 bg-white/10"
                  style={{ color: 'var(--premium-text-primary)' }}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-sm cursor-text hover:opacity-70 transition-opacity"
                  onClick={() => handleEditStart(task.id, task.text)}
                  style={{ color: 'var(--premium-text-primary)' }}
                >
                  {task.text}
                </span>
              )}

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
          )
        })}

        {/* Completed Tasks - Collapsible */}
        {completedTasks.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
              style={{ color: 'var(--premium-text-tertiary)' }}
            >
              {showCompleted ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium">
                {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
              </span>
            </button>

            {showCompleted && (
              <div className="space-y-2 mt-2">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2 p-2.5 rounded-lg transition-all"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)'
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: 'var(--premium-blue)',
                        border: '2px solid var(--premium-blue)'
                      }}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </button>

                    {/* Task Text */}
                    {editingTaskId === task.id ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onFocus={handleInputFocus}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(task.id)
                          if (e.key === 'Escape') handleEditCancel()
                        }}
                        className="flex-1 px-2 py-1 text-sm rounded focus:outline-none focus:ring-2 bg-white/10"
                        style={{ color: 'var(--premium-text-primary)' }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm line-through cursor-text hover:opacity-70 transition-opacity"
                        onClick={() => handleEditStart(task.id, task.text)}
                        style={{ color: 'var(--premium-text-tertiary)' }}
                      >
                        {task.text}
                      </span>
                    )}

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
            )}
          </div>
        )}
      </div>

      {/* Add Task Input */}
      {isAdding ? (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask()
              if (e.key === 'Escape') {
                setIsAdding(false)
                setNewTaskText('')
              }
            }}
            placeholder="Task description..."
            autoFocus
            className="flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 premium-glass"
            style={{
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
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
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
    </div>
  )
}
