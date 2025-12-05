import React, { useState, useRef, useCallback } from 'react'
import { Plus, GripVertical } from 'lucide-react'
import type { Task } from '../../types'

interface PinnedTaskListProps {
  tasks: Task[]
  onToggle: (taskId: string) => void
  onAdd: (text: string) => void
  onReorder: (draggedId: string, targetId: string) => void
  draggedTaskId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

export function PinnedTaskList({ 
  tasks, 
  onToggle, 
  onAdd, 
  onReorder,
  draggedTaskId,
  onDragStart,
  onDragEnd
}: PinnedTaskListProps) {
  const [newTaskText, setNewTaskText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (newTaskText.trim()) {
        onAdd(newTaskText)
        setNewTaskText('')
      }
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedTaskId || draggedTaskId === targetId) return
    onReorder(draggedTaskId, targetId)
  }, [draggedTaskId, onReorder])

  return (
    <div className="p-6 pb-32 flex flex-col items-start w-full">
      {/* Header */}
      <h4 className="text-sm font-semibold mb-4 w-full" style={{ color: 'var(--premium-text-primary)' }}>
        Tasks ({tasks.filter(t => t.done).length}/{tasks.length})
      </h4>

      {/* Task list */}
      <div className="space-y-1.5 w-full">
        {/* Incomplete tasks only */}
        {tasks.filter(t => !t.done).map((task, index) => {
          const isNextTask = index === 0
          return (
            <div
              key={task.id}
              draggable
              onDragStart={() => onDragStart(task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragEnd={onDragEnd}
              className="group w-full flex items-center gap-2 text-sm p-3 rounded-lg transition-colors text-left cursor-move"
              style={{
                opacity: draggedTaskId === task.id ? 0.5 : 1,
                background: isNextTask ? 'var(--premium-bg-3)' : 'var(--premium-bg-2)'
              }}
            >
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" style={{ color: 'var(--premium-text-tertiary)' }}>
                <GripVertical className="h-3 w-3" />
              </div>
              <button
                onClick={() => onToggle(task.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <div
                  className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0 transition-all hover:bg-blue-500/20"
                  style={{
                    border: '1.5px solid rgba(255, 255, 255, 0.3)',
                    color: 'rgba(59, 130, 246, 0.9)'
                  }}
                >
                </div>
                <span style={{
                  color: isNextTask ? 'var(--premium-text-primary)' : 'var(--premium-text-secondary)',
                  fontWeight: isNextTask ? 600 : 400
                }}>
                  {task.text}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add task input - fixed at bottom */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}>
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
          <Plus className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--premium-blue)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Add task..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.focus()
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="flex-1 px-3 py-2 text-sm rounded-md focus:outline-none bg-transparent"
            style={{
              color: 'var(--premium-text-primary)',
              border: '1px solid rgba(59, 130, 246, 0.4)'
            }}
          />
        </div>
      </div>
    </div>
  )
}
