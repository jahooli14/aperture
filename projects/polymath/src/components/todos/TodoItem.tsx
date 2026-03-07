/**
 * TodoItem - Single row in any todo view.
 *
 * Visual design:
 *   - Uses --premium-surface-1 (#141f32) as card background — real elevation
 *     against the #0f1829 base, not an invisible rgba hack
 *   - Priority is expressed through left border weight and color
 *   - Completion: green flash (done = emerald, not blue), 2s linger, rightward exit
 *   - Stale inbox items surface their age quietly (crow insight)
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

// Priority border: left border only — color + weight signal urgency
function getPriorityStyle(priority: number, done: boolean): React.CSSProperties {
  if (done) return {}
  if (priority === 3) return { borderLeft: '3px solid rgba(248,113,113,0.75)' }
  if (priority === 2) return { borderLeft: '2px solid rgba(251,191,36,0.65)' }
  if (priority === 1) return { borderLeft: '2px solid rgba(96,165,250,0.5)' }
  return { borderLeft: '1px solid rgba(255,255,255,0.065)' }
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

  // Crow insight: quietly remember how long a task has been sitting
  const daysSinceCreated = todo.created_at
    ? Math.floor((Date.now() - new Date(todo.created_at).getTime()) / 86400000)
    : 0
  const isStale = !todo.done && !todo.scheduled_date && !todo.deadline_date &&
    !todo.tags.includes('someday') && daysSinceCreated >= 3

  const handleToggle = async () => {
    if (completing) return  // guard against double-tap during linger
    if (todo.done) {
      onToggle(todo.id)
      return
    }

    // Phase 1: immediate visual — it's done
    setCompleting(true)
    setCompletingFlash(true)

    // Flash: emerald tint fades after 600ms (completion = green = success)
    setTimeout(() => setCompletingFlash(false), 600)

    // Phase 2: linger 2s so the completion registers, then exit
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

  // Compose background + border together
  const itemBackground = completingFlash
    ? 'rgba(16,185,129,0.12)'   // emerald flash on completion
    : todo.done
      ? 'transparent'
      : 'var(--premium-surface-1)'  // #141f32 — proper elevation, not invisible rgba

  const priorityStyle = getPriorityStyle(todo.priority, todo.done)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{
        opacity: completing ? 0.62 : todo.done ? 0.45 : 1,
        y: 0,
      }}
      // Slides right on exit — the task goes somewhere, it doesn't just vanish
      exit={{
        opacity: 0,
        x: 52,
        height: 0,
        marginBottom: 0,
        transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
      }}
      // Subtle hover lift on desktop
      whileHover={!todo.done && !completing ? { y: -1 } : undefined}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <SwipeableCard
        leftAction={{ ...SwipeActions.delete(handleToggle), icon: <Check className="h-5 w-5 text-white" />, color: 'bg-emerald-600', label: 'Complete' }}
        rightAction={SwipeActions.delete(() => onDelete(todo.id))}
        className="rounded-xl"
      >
        <div
          className={cn(
            'flex items-start gap-3.5 px-4 py-3.5 rounded-xl',
            'active:brightness-110 transition-[background,box-shadow] duration-200',
          )}
          style={{
            background: itemBackground,
            // Border via priority style (overrides default 1px border)
            borderTop: '1px solid rgba(255,255,255,0.055)',
            borderRight: '1px solid rgba(255,255,255,0.055)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            ...priorityStyle,
            boxShadow: todo.done ? 'none' : '0 1px 3px rgba(0,0,0,0.3), 0 2px 10px rgba(0,0,0,0.15)',
          }}
        >
          {/* Checkbox — 44×44 touch target via padding */}
          <button
            onClick={handleToggle}
            className="flex-shrink-0 flex items-center justify-center"
            style={{ padding: 11, margin: -11, marginTop: -9, paddingTop: 9 }}
            aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
          >
            <div className={cn(
              'h-[20px] w-[20px] rounded-[6px] flex items-center justify-center transition-all duration-200 border-2',
              (todo.done || completing)
                ? 'bg-emerald-500 border-emerald-500'
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
                className="text-[15px] cursor-text leading-snug"
                style={{
                  color: (todo.done || completing)
                    ? 'rgba(255,255,255,0.3)'
                    : 'var(--premium-text-primary)',
                  textDecoration: (todo.done || completing) ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(255,255,255,0.25)',
                }}
              >
                {todo.text}
              </p>
            )}

            {/* Metadata — only on active items */}
            {!todo.done && !completing && !editing && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                {isOverdue && (
                  <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'rgba(248,113,113,0.85)' }}>
                    <AlertCircle className="h-3 w-3" />
                    {daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`}
                  </span>
                )}
                {todo.deadline_date && !isOverdue && showDate && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    <AlertCircle className="h-3 w-3" />
                    Due {describeDate(todo.deadline_date)}
                  </span>
                )}
                {todo.scheduled_date && showDate && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    <Calendar className="h-3 w-3" />
                    {describeDate(todo.scheduled_date)}
                  </span>
                )}
                {todo.scheduled_time && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <Clock className="h-3 w-3" />
                    {describeTime(todo.scheduled_time)}
                  </span>
                )}
                {showArea && areaName && (
                  <span className="text-[11px]" style={{ color: 'rgba(251,191,36,0.6)' }}>{areaName}</span>
                )}
                {todo.tags.filter(t => t !== 'someday').map(tag => (
                  <span key={tag} className="flex items-center gap-0.5 text-[11px]" style={{ color: 'rgba(52,211,153,0.6)' }}>
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
                {todo.estimated_minutes && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    <Clock className="h-3 w-3" />
                    {formatMinutes(todo.estimated_minutes)}
                  </span>
                )}
                {/* Crow insight: age of stale inbox items */}
                {isStale && (
                  <span
                    className="text-[11px] ml-auto"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    title={`Added ${daysSinceCreated} days ago`}
                  >
                    {daysSinceCreated}d
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {todo.notes && !editing && !completing && (
              <p className="mt-1.5 text-[12px] leading-snug line-clamp-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {todo.notes}
              </p>
            )}
          </div>

          {/* Delete — subtle until pressed */}
          <button
            onClick={() => onDelete(todo.id)}
            className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.22)', opacity: 0.7 }}
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
    <div
      className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-opacity"
      style={{ opacity: 0.38 }}
    >
      <div
        className="flex-shrink-0 h-[16px] w-[16px] rounded-[5px] flex items-center justify-center"
        style={{ background: 'rgba(52,211,153,0.3)' }}
      >
        <Check className="h-[9px] w-[9px] text-white" strokeWidth={3} />
      </div>
      <span
        className="flex-1 text-[15px] truncate"
        style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.45)', textDecorationColor: 'rgba(255,255,255,0.2)' }}
      >
        {todo.text}
      </span>
      {completedAt && (
        <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {completedAt}
        </span>
      )}
      <button
        onClick={() => onUndo(todo.id)}
        className="text-[11px] flex-shrink-0 ml-1 transition-colors"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        Undo
      </button>
    </div>
  )
}
