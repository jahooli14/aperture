/**
 * TodoItem - Single row in any todo view.
 *
 * Interactions:
 *   - Tap checkbox → optimistic complete + strikethrough → fades out
 *   - Tap text → inline edit
 *   - Hover → reveals delete
 */

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Calendar, Tag, Clock, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { describeDate, describeTime, PRIORITY_COLORS } from '../../lib/todoNLP'
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

  const priorityBorderClass =
    !todo.done && todo.priority === 3 ? 'border-l-2 border-l-red-400/70' :
    !todo.done && todo.priority === 2 ? 'border-l-2 border-l-amber-400/70' :
    !todo.done && todo.priority === 1 ? 'border-l-2 border-l-blue-400/60' :
    ''

  const handleToggle = async () => {
    if (todo.done) {
      onToggle(todo.id)
      return
    }
    setCompleting(true)
    await new Promise(r => setTimeout(r, 500))
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
      animate={{ opacity: completing ? 0.35 : todo.done ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors',
        'hover:bg-white/[0.04]',
        priorityBorderClass,
      )}
    >
      {/* Checkbox — extended tap target (44×44) via padding trick */}
      <button
        onClick={handleToggle}
        className="flex-shrink-0 flex items-center justify-center p-[13px] -m-[13px]"
        style={{ marginTop: -11, paddingTop: 11 }}
        aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <div className={cn(
          'h-[18px] w-[18px] rounded-[5px] flex items-center justify-center transition-all border-2',
          todo.done
            ? 'bg-blue-500 border-blue-500'
            : isOverdue
              ? 'border-red-400/60 hover:border-red-400'
              : 'border-white/20 hover:border-white/45'
        )}>
        <AnimatePresence>
          {(todo.done || completing) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 700, damping: 28 }}
            >
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
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
            className="w-full -mx-2.5 -my-0.5 px-2.5 py-0.5 bg-white/8 rounded-lg text-sm outline-none ring-1 ring-blue-500/60"
            style={{ color: 'var(--premium-text-primary)' }}
            autoFocus
          />
        ) : (
          <p
            onClick={() => { setEditing(true); setEditText(todo.text) }}
            className={cn(
              'text-sm cursor-text leading-snug',
              todo.done ? 'line-through text-white/35' : 'text-white/90',
              completing && 'line-through text-white/50'
            )}
          >
            {todo.text}
          </p>
        )}

        {/* Metadata row */}
        {!todo.done && !editing && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {isOverdue && (
              <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
                <AlertCircle className="h-3 w-3" />
                Overdue
              </span>
            )}
            {todo.deadline_date && !isOverdue && showDate && (
              <span className="flex items-center gap-1 text-[11px] text-white/35">
                <AlertCircle className="h-3 w-3" />
                Due {describeDate(todo.deadline_date)}
              </span>
            )}
            {todo.scheduled_date && showDate && (
              <span className="flex items-center gap-1 text-[11px] text-white/35">
                <Calendar className="h-3 w-3" />
                {describeDate(todo.scheduled_date)}
                {todo.scheduled_time && (
                  <span className="text-white/45">{describeTime(todo.scheduled_time)}</span>
                )}
              </span>
            )}
            {!todo.scheduled_date && todo.scheduled_time && (
              <span className="flex items-center gap-1 text-[11px] text-white/35">
                <Clock className="h-3 w-3" />
                {describeTime(todo.scheduled_time)}
              </span>
            )}
            {showArea && areaName && (
              <span className="text-[11px] text-amber-400/60">{areaName}</span>
            )}
            {todo.tags.filter(t => t !== 'someday').map(tag => (
              <span key={tag} className="flex items-center gap-0.5 text-[11px] text-emerald-400/60">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {todo.estimated_minutes && (
              <span className="flex items-center gap-1 text-[11px] text-white/25">
                <Clock className="h-3 w-3" />
                {todo.estimated_minutes >= 60
                  ? `${todo.estimated_minutes / 60}h`
                  : `${todo.estimated_minutes}m`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(todo.id)}
        className={cn(
          'flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg transition-all',
          'opacity-20 group-hover:opacity-100',
          'hover:bg-red-500/15 text-white/40 hover:text-red-400'
        )}
        aria-label="Delete todo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

// ─── Logbook item ─────────────────────────────────────────────

export function LogbookItem({ todo, onUndo }: { todo: Todo; onUndo: (id: string) => void }) {
  const completedAt = todo.completed_at
    ? new Date(todo.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-45 hover:opacity-65 transition-opacity">
      <div className="flex-shrink-0 h-[14px] w-[14px] rounded-[4px] bg-blue-500/40 flex items-center justify-center">
        <Check className="h-2 w-2 text-white" strokeWidth={3} />
      </div>
      <span className="flex-1 text-sm line-through text-white/40 truncate">{todo.text}</span>
      {completedAt && (
        <span className="text-[11px] text-white/25 flex-shrink-0">{completedAt}</span>
      )}
      <button
        onClick={() => onUndo(todo.id)}
        className="text-[11px] text-white/20 hover:text-blue-400 transition-colors flex-shrink-0 ml-1"
      >
        Undo
      </button>
    </div>
  )
}
