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
    <div className="p-4 sm:p-6 pb-32 flex flex-col items-start w-full">
      {/* Header */}
      <h4 className="text-sm font-semibold mb-4 w-full uppercase tracking-wider text-[var(--brand-text-secondary)]">
        Tasks ({tasks.filter(t => t.done).length}/{tasks.length})
      </h4>

      {/* Task list */}
      <div className="space-y-2 w-full">
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
              className="group w-full flex items-center gap-2 text-sm p-3 rounded-lg transition-colors text-left cursor-move min-h-[48px]"
              style={{
                opacity: draggedTaskId === task.id ? 0.5 : 1,
                background: isNextTask ? 'rgba(var(--brand-primary-rgb),0.08)' : 'rgba(15,24,41,0.5)',
                border: `1px solid ${isNextTask ? 'rgba(var(--brand-primary-rgb),0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="flex-shrink-0 opacity-40 cursor-grab active:cursor-grabbing text-[var(--brand-text-secondary)]">
                <GripVertical className="h-4 w-4" />
              </div>
              <button
                onClick={() => onToggle(task.id)}
                className="flex items-center gap-2.5 flex-1 text-left min-h-[40px]"
              >
                <div
                  className="h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all hover:bg-brand-primary/20"
                  style={{
                    border: '1.5px solid rgba(255, 255, 255, 0.35)',
                  }}
                />
                <span className="text-[14px]" style={{
                  color: isNextTask ? 'var(--brand-text-primary)' : 'var(--brand-text-secondary)',
                  fontWeight: isNextTask ? 600 : 400
                }}>
                  {task.text}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add task input */}
      <div className="mt-4 pt-4 border-t w-full" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex items-center gap-2 px-3 rounded-lg min-h-[48px]" style={{ backgroundColor: 'rgba(var(--brand-primary-rgb), 0.12)', border: '1px solid rgba(var(--brand-primary-rgb), 0.35)' }}>
          <Plus className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
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
            className="flex-1 py-2.5 text-[15px] focus:outline-none bg-transparent"
            style={{
              color: 'var(--brand-text-primary)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
