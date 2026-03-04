/**
 * TodoItem - Single row in any todo view.
 *
 * Interactions:
 *   - Tap checkbox → optimistic complete + brief strikethrough → disappears to logbook
 *   - Tap text → inline edit
 *   - Swipe left → delete (mobile)
 *   - Long press → context menu (reschedule, set priority, move area)
 */

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Calendar, Tag, Clock, AlertCircle,
  Trash2, ChevronDown, ChevronRight, MoreHorizontal
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { describeDate, PRIORITY_COLORS } from '../../lib/todoNLP'
import type { Todo } from '../../stores/useTodoStore'
import { handleInputFocus } from '../../utils/keyboard'

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
  showDate?: boolean
  showArea?: boolean
  areaName?: string
}

export function TodoItem({
  todo,
  onToggle,
  onUpdate,
  onDelete,
  showDate = true,
  showArea = false,
  areaName,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [completing, setCompleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]
  const isOverdue = todo.deadline_date && todo.deadline_date < today && !todo.done

  const handleToggle = async () => {
    if (todo.done) {
      onToggle(todo.id)
      return
    }
    // Animate completion
    setCompleting(true)
    await new Promise(r => setTimeout(r, 400))
    onToggle(todo.id)
    setCompleting(false)
  }

  const handleEditSave = () => {
    if (!editText.trim()) return
    onUpdate(todo.id, { text: editText.trim() })
    setEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEditSave()
    if (e.key === 'Escape') {
      setEditText(todo.text)
      setEditing(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: completing ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors',
        'hover:bg-white/[0.04]',
        todo.done && 'opacity-50'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={cn(
          'flex-shrink-0 mt-0.5 h-5 w-5 rounded-md flex items-center justify-center transition-all border-2',
          todo.done
            ? 'bg-blue-500 border-blue-500'
            : isOverdue
              ? 'border-red-400/60 hover:border-red-400'
              : 'border-white/25 hover:border-white/50'
        )}
        aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <AnimatePresence>
          {(todo.done || completing) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            >
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Priority stripe */}
        {todo.priority > 0 && !todo.done && (
          <div className={cn(
            'absolute left-0 w-0.5 h-full rounded-full',
            todo.priority === 3 ? 'bg-red-400' : todo.priority === 2 ? 'bg-amber-400' : 'bg-blue-400'
          )} />
        )}

        {/* Text */}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditSave}
            className="w-full bg-white/10 rounded px-2 py-0.5 text-sm outline-none ring-1 ring-blue-500/50"
            style={{ color: 'var(--premium-text-primary)' }}
            autoFocus
          />
        ) : (
          <p
            onClick={() => { setEditing(true); setEditText(todo.text) }}
            className={cn(
              'text-sm cursor-text leading-snug',
              todo.done ? 'line-through text-white/40' : 'text-white/90',
              completing && 'line-through'
            )}
          >
            {todo.text}
          </p>
        )}

        {/* Metadata row */}
        {!todo.done && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
            {/* Overdue warning */}
            {isOverdue && (
              <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                <AlertCircle className="h-3 w-3" />
                Overdue
              </span>
            )}

            {/* Deadline */}
            {todo.deadline_date && !isOverdue && showDate && (
              <span className="flex items-center gap-1 text-[10px] text-white/40">
                <AlertCircle className="h-3 w-3" />
                Due {describeDate(todo.deadline_date)}
              </span>
            )}

            {/* Scheduled date */}
            {todo.scheduled_date && showDate && (
              <span className="flex items-center gap-1 text-[10px] text-white/40">
                <Calendar className="h-3 w-3" />
                {describeDate(todo.scheduled_date)}
              </span>
            )}

            {/* Area */}
            {showArea && areaName && (
              <span className="text-[10px] text-amber-400/70">{areaName}</span>
            )}

            {/* Tags */}
            {todo.tags.filter(t => t !== 'someday').map(tag => (
              <span key={tag} className="text-[10px] text-emerald-400/70">#{tag}</span>
            ))}

            {/* Time estimate */}
            {todo.estimated_minutes && (
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <Clock className="h-3 w-3" />
                {todo.estimated_minutes >= 60
                  ? `${todo.estimated_minutes / 60}h`
                  : `${todo.estimated_minutes}m`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete button (revealed on hover) */}
      <button
        onClick={() => onDelete(todo.id)}
        className={cn(
          'flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg transition-all',
          'opacity-0 group-hover:opacity-100',
          'hover:bg-red-500/15 text-white/20 hover:text-red-400'
        )}
        aria-label="Delete todo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

// ─── Logbook item (completed, read-only) ─────────────────────

export function LogbookItem({ todo, onUndo }: { todo: Todo; onUndo: (id: string) => void }) {
  const completedAt = todo.completed_at
    ? new Date(todo.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50 hover:opacity-70 transition-opacity">
      <div className="flex-shrink-0 h-4 w-4 rounded bg-blue-500/50 flex items-center justify-center">
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </div>
      <span className="flex-1 text-sm line-through text-white/50 truncate">{todo.text}</span>
      {completedAt && (
        <span className="text-[10px] text-white/30 flex-shrink-0">{completedAt}</span>
      )}
      <button
        onClick={() => onUndo(todo.id)}
        className="text-[10px] text-white/25 hover:text-blue-400 transition-colors flex-shrink-0"
      >
        Undo
      </button>
    </div>
  )
}
