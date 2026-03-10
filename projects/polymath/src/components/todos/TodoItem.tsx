/**
 * TodoItem - Single row in any todo view.
 *
 * Visual design:
 *   - Priority expressed as colored pill badge + left border + card tint
 *   - Area shown as a colored pill, not plain faint text
 *   - Estimated time shown as a distinct chip
 *   - In-progress: amber glow card, pulsing dot, left border
 *   - Completion: emerald flash (done = green), 2s linger, rightward exit
 *
 * Behavioral UX:
 *   - Zeigarnik Effect: "Start" creates a visible open loop commitment
 *   - Crow insight: stale inbox items show their age quietly
 */

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Calendar, Tag, Clock, AlertCircle, Trash2, Play, Square } from 'lucide-react'
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
  onStart: (id: string) => void
  onUnstart: (id: string) => void
  isInProgress?: boolean
  showDate?: boolean
  showArea?: boolean
  areaName?: string
}

// Priority config — color, label, border, card tint
const PRIORITY_CONFIG = {
  3: {
    label: 'Urgent',
    dot: 'rgba(248,113,113,1)',
    border: '3px solid rgba(248,113,113,0.7)',
    cardTint: 'rgba(239,68,68,0.07)',
    chipBg: 'rgba(239,68,68,0.15)',
    chipColor: 'rgba(252,165,165,0.95)',
  },
  2: {
    label: 'High',
    dot: 'rgba(251,191,36,1)',
    border: '2.5px solid rgba(251,191,36,0.65)',
    cardTint: 'rgba(251,191,36,0.06)',
    chipBg: 'rgba(251,191,36,0.14)',
    chipColor: 'rgba(253,224,71,0.95)',
  },
  1: {
    label: 'Low',
    dot: 'rgba(96,165,250,1)',
    border: '2px solid rgba(96,165,250,0.5)',
    cardTint: 'rgba(59,130,246,0.05)',
    chipBg: 'rgba(59,130,246,0.12)',
    chipColor: 'rgba(147,197,253,0.9)',
  },
} as const

export function TodoItem({
  todo,
  onToggle,
  onUpdate,
  onDelete,
  onStart,
  onUnstart,
  isInProgress = false,
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

  // Crow insight: quietly surface how long a task has been sitting
  const daysSinceCreated = todo.created_at
    ? Math.floor((Date.now() - new Date(todo.created_at).getTime()) / 86400000)
    : 0
  const isStale = !todo.done && !todo.scheduled_date && !todo.deadline_date &&
    !todo.tags.includes('someday') && daysSinceCreated >= 3

  const handleToggle = async () => {
    if (completing) return
    if (todo.done) {
      onToggle(todo.id)
      return
    }

    setCompleting(true)
    setCompletingFlash(true)
    setTimeout(() => setCompletingFlash(false), 600)
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

  const handleStartToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInProgress) onUnstart(todo.id)
    else onStart(todo.id)
  }

  const priorityCfg = PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG]

  // Card background: completing flash > done state > in-progress > priority tint > default
  const itemBackground = completingFlash
    ? 'rgba(16,185,129,0.14)'
    : todo.done
      ? 'transparent'
      : isInProgress
        ? 'rgba(251,146,60,0.09)'
        : priorityCfg
          ? priorityCfg.cardTint
          : 'rgba(24,24,27,0.55)'  // zinc-900 glass — matches home/lists cards

  const borderLeft = todo.done || completing
    ? '1px solid rgba(255,255,255,0.07)'
    : isInProgress
      ? '3px solid rgba(251,146,60,0.85)'
      : priorityCfg
        ? priorityCfg.border
        : '1px solid rgba(255,255,255,0.07)'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{
        opacity: completing ? 0.62 : todo.done ? 0.45 : 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        x: 52,
        height: 0,
        marginBottom: 0,
        transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
      }}
      whileHover={!todo.done && !completing ? { y: -1 } : undefined}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <SwipeableCard
        leftAction={SwipeActions.delete(() => onDelete(todo.id))}
        rightAction={{ icon: <Check className="h-5 w-5 text-white" />, color: 'bg-emerald-600', label: 'Complete', threshold: 100, onAction: handleToggle }}
        className="rounded-xl"
      >
        <div
          className={cn(
            'flex items-start gap-3.5 px-4 py-3.5 rounded-xl',
            'active:brightness-110 transition-[background,box-shadow] duration-200',
          )}
          style={{
            background: itemBackground,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            borderLeft: borderLeft ?? '1px solid rgba(255,255,255,0.07)',
            boxShadow: todo.done ? 'none' : '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          {/* Checkbox — 44×44 touch target */}
          <button
            onClick={handleToggle}
            className="flex-shrink-0 flex items-center justify-center"
            style={{ padding: 11, margin: -11, marginTop: -9, paddingTop: 9 }}
            aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
          >
            <div
              className="h-[20px] w-[20px] rounded-full flex items-center justify-center transition-all duration-200"
              style={{
                border: (todo.done || completing)
                  ? '1.5px solid rgb(16,185,129)'
                  : isOverdue
                    ? '1.5px solid rgba(248,113,113,0.55)'
                    : isInProgress
                      ? '1.5px solid rgba(251,146,60,0.6)'
                      : priorityCfg
                        ? `1.5px solid ${priorityCfg.dot}`
                        : '1.5px solid rgba(255,255,255,0.18)',
                background: (todo.done || completing) ? 'rgb(16,185,129)' : 'transparent',
                opacity: priorityCfg && !todo.done && !completing && !isOverdue && !isInProgress ? 0.7 : 1,
              }}
            >
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
                    ? 'rgba(255,255,255,0.45)'
                    : 'var(--premium-text-primary)',
                  textDecoration: (todo.done || completing) ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(255,255,255,0.30)',
                }}
              >
                {todo.text}
              </p>
            )}

            {/* Metadata chips row — only on active items */}
            {!todo.done && !completing && !editing && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">

                {/* Priority pill */}
                {priorityCfg && !isInProgress && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: priorityCfg.chipBg, color: priorityCfg.chipColor }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: priorityCfg.dot }}
                    />
                    {priorityCfg.label}
                  </span>
                )}

                {/* In-progress badge */}
                {isInProgress && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,146,60,0.15)', color: 'rgba(251,146,60,0.95)' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                    In progress
                  </span>
                )}

                {/* Overdue badge */}
                {isOverdue && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.14)', color: 'rgba(252,165,165,0.95)' }}
                  >
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {daysOverdue === 1 ? '1d overdue' : `${daysOverdue}d overdue`}
                  </span>
                )}

                {/* Deadline */}
                {todo.deadline_date && !isOverdue && showDate && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(248,113,113,0.7)' }}>
                    <AlertCircle className="h-3 w-3" />
                    Due {describeDate(todo.deadline_date)}
                  </span>
                )}

                {/* Scheduled date */}
                {todo.scheduled_date && showDate && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <Calendar className="h-3 w-3" />
                    {describeDate(todo.scheduled_date)}
                  </span>
                )}

                {/* Scheduled time */}
                {todo.scheduled_time && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(99,179,237,0.1)', color: 'rgba(147,197,253,0.85)' }}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {describeTime(todo.scheduled_time)}
                  </span>
                )}

                {/* Area chip */}
                {showArea && areaName && (
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(251,191,36,0.12)', color: 'rgba(253,224,71,0.8)' }}
                  >
                    {areaName}
                  </span>
                )}

                {/* Tags */}
                {todo.tags.filter(t => t !== 'someday').map(tag => (
                  <span key={tag} className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(52,211,153,0.1)', color: 'rgba(52,211,153,0.8)' }}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}

                {/* Estimated time chip */}
                {todo.estimated_minutes && (
                  <span
                    className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md ml-auto"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {formatMinutes(todo.estimated_minutes)}
                  </span>
                )}

                {/* Crow insight: stale age indicator */}
                {isStale && !todo.estimated_minutes && (
                  <span
                    className="text-[11px] ml-auto"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    title={`Added ${daysSinceCreated} days ago`}
                  >
                    {daysSinceCreated}d
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {todo.notes && !editing && !completing && (
              <p className="mt-1.5 text-[12px] leading-snug line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {todo.notes}
              </p>
            )}
          </div>

          {/* Actions: Start/Stop + Delete */}
          {!todo.done && !completing && (
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <button
                onClick={handleStartToggle}
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all"
                style={isInProgress ? {
                  color: 'rgba(251,146,60,0.9)',
                  background: 'rgba(251,146,60,0.14)',
                } : {
                  color: 'rgba(255,255,255,0.35)',
                }}
                aria-label={isInProgress ? 'Stop working on this' : 'Start working on this'}
                title={isInProgress ? 'Stop' : 'Start'}
              >
                {isInProgress
                  ? <Square className="h-3 w-3" />
                  : <Play className="h-3 w-3" />
                }
              </button>

              <button
                onClick={() => onDelete(todo.id)}
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all"
                style={{ color: 'rgba(255,255,255,0.30)' }}
                aria-label="Delete todo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Completed: just delete */}
          {(todo.done || completing) && (
            <button
              onClick={() => onDelete(todo.id)}
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,0.35)', opacity: 0.7 }}
              aria-label="Delete todo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
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
        style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.65)', textDecorationColor: 'rgba(255,255,255,0.30)' }}
      >
        {todo.text}
      </span>
      {completedAt && (
        <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {completedAt}
        </span>
      )}
      <button
        onClick={() => onUndo(todo.id)}
        className="text-[11px] flex-shrink-0 ml-1 transition-colors"
        style={{ color: 'rgba(255,255,255,0.40)' }}
      >
        Undo
      </button>
    </div>
  )
}
