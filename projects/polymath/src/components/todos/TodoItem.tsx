/**
 * TodoItem - Single row in any todo view.
 *
 * Design principles:
 *   - The checkbox is the primary action — it gets the most visual care
 *   - Completion lingers 2s so you feel the satisfaction before it leaves
 *   - Exit is directional (slides right) — the task "goes somewhere"
 *   - Priority is expressed through left-border color weight, not noise
 *   - Stale inbox items surface their age — the app remembers (crow insight)
 */

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Calendar, Tag, Clock, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { parseTodo, describeDate, describeTime, formatMinutes } from '../../lib/todoNLP'
import type { Todo } from '../../stores/useTodoStore'
import { handleInputFocus } from '../../utils/keyboard'
import { SwipeableCard, SwipeActions } from '../SwipeableCard'

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
  const [completingFlash, setCompletingFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]
  const overdueDate =
    (todo.deadline_date && todo.deadline_date < today) ? todo.deadline_date :
    (todo.scheduled_date && todo.scheduled_date < today) ? todo.scheduled_date :
    null
  const isOverdue = !!overdueDate && !todo.done

  const daysOverdue = overdueDate
    ? Math.max(1, Math.floor(
        (new Date(today + 'T00:00:00').getTime() - new Date(overdueDate + 'T00:00:00').getTime()) / 86400000
      ))
    : 0

  // Crow insight: remember how long a task has been sitting
  const daysSinceCreated = todo.created_at
    ? Math.floor((Date.now() - new Date(todo.created_at).getTime()) / 86400000)
    : 0
  const isStale = !todo.done && !todo.scheduled_date && !todo.deadline_date &&
    !todo.tags.includes('someday') && daysSinceCreated >= 3

  const priorityBorderClass =
    !todo.done && todo.priority === 3 ? 'border-l-2 border-l-red-400/70' :
    !todo.done && todo.priority === 2 ? 'border-l-2 border-l-amber-400/70' :
    !todo.done && todo.priority === 1 ? 'border-l-2 border-l-blue-400/60' :
    ''

  const handleToggle = async () => {
    // Guard: ignore tap while already completing
    if (completing) return
    if (todo.done) {
      onToggle(todo.id)
      return
    }

    // Phase 1: immediate visual feedback — looks done
    setCompleting(true)
    setCompletingFlash(true)

    // Flash fades out after 500ms
    setTimeout(() => setCompletingFlash(false), 500)

    // Phase 2: linger 2s so you feel it, then let it leave
    await new Promise(r => setTimeout(r, 2000))
    onToggle(todo.id)
    setCompleting(false)
  }

  const handleEditSave = () => {
    if (!editText.trim()) return
    const parsed = parseTodo(editText)
    if (!parsed.text.trim()) return
    onUpdate(todo.id, {
      text: parsed.text,
      ...(parsed.scheduledDate !== undefined && { scheduled_date: parsed.scheduledDate }),
      ...(parsed.scheduledTime !== undefined && { scheduled_time: parsed.scheduledTime }),
      ...(parsed.deadlineDate !== undefined && { deadline_date: parsed.deadlineDate }),
      ...(parsed.priority > 0 && { priority: parsed.priority }),
      ...(parsed.estimatedMinutes !== undefined && { estimated_minutes: parsed.estimatedMinutes }),
    })
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
      initial={{ opacity: 0, y: -6 }}
      animate={{
        // During completing: visible as "done", not punishingly dim
        opacity: completing ? 0.62 : todo.done ? 0.45 : 1,
        y: 0,
      }}
      // Directional exit: slides right as it collapses — the task "goes somewhere"
      exit={{
        opacity: 0,
        x: 48,
        height: 0,
        marginBottom: 0,
        transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
      }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <SwipeableCard
        leftAction={{ ...SwipeActions.delete(handleToggle), icon: <Check className="h-5 w-5 text-white" />, color: 'bg-blue-600', label: 'Complete' }}
        rightAction={SwipeActions.delete(() => onDelete(todo.id))}
        className={cn('rounded-xl', priorityBorderClass)}
      >
      <div
        className={cn(
          'flex items-start gap-3.5 px-4 py-3.5 rounded-xl transition-colors duration-500',
          'active:bg-white/[0.05]',
        )}
        style={{
          // Satisfaction flash: brief blue tint at the moment of completion
          background: completingFlash
            ? 'rgba(59,130,246,0.10)'
            : todo.done ? 'transparent' : 'rgba(255,255,255,0.035)',
        }}
      >
      {/* Checkbox — extended 44×44 tap target, careful spring animation */}
      <button
        onClick={handleToggle}
        className="flex-shrink-0 flex items-center justify-center p-[13px] -m-[13px]"
        style={{ marginTop: -10, paddingTop: 10 }}
        aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <div className={cn(
          'h-[20px] w-[20px] rounded-[6px] flex items-center justify-center transition-all duration-200 border-2',
          (todo.done || completing)
            ? 'bg-blue-500 border-blue-500'
            : isOverdue
              ? 'border-red-400/55 hover:border-red-400/80'
              : 'border-white/22 hover:border-white/50'
        )}>
          <AnimatePresence>
            {(todo.done || completing) && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 22 }}
              >
                <Check className="h-[11px] w-[11px] text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Task text */}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditSave}
            className="w-full -mx-2.5 -my-0.5 px-2.5 py-0.5 rounded-lg text-[15px] outline-none"
            style={{
              color: 'var(--premium-text-primary)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 0 0 1.5px rgba(99,179,237,0.5)',
            }}
            autoFocus
          />
        ) : (
          <p
            onClick={() => { setEditing(true); setEditText(todo.text) }}
            className={cn(
              'text-[15px] cursor-text leading-snug',
              (todo.done || completing)
                ? 'line-through text-white/32'
                : 'text-white/90',
            )}
          >
            {todo.text}
          </p>
        )}

        {/* Metadata row — only shown on active, non-editing items */}
        {!todo.done && !completing && !editing && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
            {isOverdue && (
              <span className="flex items-center gap-1 text-[11px] text-red-400/80 font-medium">
                <AlertCircle className="h-3 w-3" />
                {daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`}
              </span>
            )}
            {todo.deadline_date && !isOverdue && showDate && (
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <AlertCircle className="h-3 w-3" />
                Due {describeDate(todo.deadline_date)}
              </span>
            )}
            {todo.scheduled_date && showDate && (
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <Calendar className="h-3 w-3" />
                {describeDate(todo.scheduled_date)}
              </span>
            )}
            {todo.scheduled_time && (
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <Clock className="h-3 w-3" />
                {describeTime(todo.scheduled_time)}
              </span>
            )}
            {showArea && areaName && (
              <span className="text-[11px] text-amber-400/55">{areaName}</span>
            )}
            {todo.tags.filter(t => t !== 'someday').map(tag => (
              <span key={tag} className="flex items-center gap-0.5 text-[11px] text-emerald-400/55">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {todo.estimated_minutes && (
              <span className="flex items-center gap-1 text-[11px] text-white/22">
                <Clock className="h-3 w-3" />
                {formatMinutes(todo.estimated_minutes)}
              </span>
            )}
            {/* Crow insight: how long has this sat here? */}
            {isStale && (
              <span
                className="text-[11px] text-white/18 ml-auto"
                title={`Added ${daysSinceCreated} days ago`}
              >
                {daysSinceCreated}d
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {todo.notes && !editing && !completing && (
          <p className="mt-1 text-[12px] text-white/28 leading-snug line-clamp-2">
            {todo.notes}
          </p>
        )}
      </div>

      {/* Delete — touch-friendly, subtle until activated */}
      <button
        onClick={() => onDelete(todo.id)}
        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-all opacity-20 active:opacity-100 active:bg-red-500/15 active:text-red-400 text-white/40"
        aria-label="Delete todo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
    </SwipeableCard>
    </motion.div>
  )
}

// ─── Logbook item ─────────────────────────────────────────────

export function LogbookItem({ todo, onUndo }: { todo: Todo; onUndo: (id: string) => void }) {
  const completedAt = todo.completed_at
    ? new Date(todo.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  return (
    <div className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl opacity-40 hover:opacity-60 transition-opacity">
      <div className="flex-shrink-0 h-[16px] w-[16px] rounded-[5px] bg-blue-500/35 flex items-center justify-center">
        <Check className="h-[9px] w-[9px] text-white" strokeWidth={3} />
      </div>
      <span className="flex-1 text-[15px] line-through text-white/40 truncate">{todo.text}</span>
      {completedAt && (
        <span className="text-[11px] text-white/22 flex-shrink-0">{completedAt}</span>
      )}
      <button
        onClick={() => onUndo(todo.id)}
        className="text-[11px] text-white/18 hover:text-blue-400 transition-colors flex-shrink-0 ml-1 active:text-blue-400"
      >
        Undo
      </button>
    </div>
  )
}
