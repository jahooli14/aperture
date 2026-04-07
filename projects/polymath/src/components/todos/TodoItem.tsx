/**
 * TodoItem - Single row in any todo view.
 *
 * Design: Neobrutalist  hard shadows, thick borders, flat fills, sharp corners.
 */

import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Calendar, Tag, Clock, AlertCircle, Trash2, Play, Square, FolderKanban, Brain } from 'lucide-react'
import { cn } from '../../lib/utils'
import { parseTodo, describeDate, describeTime, formatMinutes } from '../../lib/todoNLP'
import type { Todo } from '../../stores/useTodoStore'
import { handleInputFocus } from '../../utils/keyboard'
import { SwipeableCard, SwipeActions } from '../SwipeableCard'
import { useProjectStore } from '../../stores/useProjectStore'
import { useMemoryStore } from '../../stores/useMemoryStore'

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

// Priority config — neon glow borders
const PRIORITY_CONFIG = {
  3: {
    label: 'URGENT',
    dot: 'rgb(248,113,113)',
    border: '1.5px solid rgba(248,113,113,0.5)',
    cardTint: 'rgba(239,68,68,0.07)',
    chipBg: 'rgba(239,68,68,0.2)',
    chipColor: 'rgb(252,165,165)',
    shadow: '0 0 24px rgba(248,113,113,0.15)',
  },
  2: {
    label: 'HIGH',
    dot: 'rgb(251,191,36)',
    border: '1.5px solid rgba(251,191,36,0.4)',
    cardTint: 'rgba(251,191,36,0.06)',
    chipBg: 'rgba(251,191,36,0.18)',
    chipColor: 'rgb(253,224,71)',
    shadow: '0 0 24px rgba(251,191,36,0.12)',
  },
  1: {
    label: 'LOW',
    dot: 'rgb(96,165,250)',
    border: '1.5px solid rgba(96,165,250,0.3)',
    cardTint: 'rgba(59,130,246,0.05)',
    chipBg: 'rgba(59,130,246,0.18)',
    chipColor: 'rgb(147,197,253)',
    shadow: '0 0 24px rgba(96,165,250,0.12)',
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

  // Resolve project name for context badge
  const projects = useProjectStore(state => state.projects)
  const projectName = useMemo(() => {
    if (!todo.project_id) return null
    return projects.find(p => p.id === todo.project_id)?.title ?? null
  }, [todo.project_id, projects])

  // Resolve source memory title for "from thought" indicator
  const memories = useMemoryStore(state => state.memories)
  const sourceMemoryTitle = useMemo(() => {
    if (!todo.source_memory_id) return null
    return memories.find(m => m.id === todo.source_memory_id)?.title ?? null
  }, [todo.source_memory_id, memories])

  const isAiGenerated = todo.tags?.includes('ai-suggested') || todo.tags?.includes('triage')

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

  // Flat, opaque card backgrounds  no glass
  const itemBackground = completingFlash
    ? 'rgba(16,185,129,0.18)'
    : todo.done
      ? 'transparent'
      : isInProgress
        ? 'rgba(251,146,60,0.08)'
        : priorityCfg
          ? priorityCfg.cardTint
          : 'var(--glass-surface)'

  // Thick left border for status/priority  neobrutalist accent
  const borderLeft = todo.done || completing
    ? '1.5px solid var(--glass-surface)'
    : isInProgress
      ? '4px solid rgba(251,146,60,0.95)'
      : priorityCfg
        ? priorityCfg.border
        : '4px solid rgba(255,255,255,0.28)'

  const boxShadow = todo.done || completing
    ? 'none'
    : isInProgress
      ? '0 0 20px rgba(251,146,60,0.12)'
      : priorityCfg
        ? priorityCfg.shadow
        : '0 4px 12px rgba(0,0,0,0.15)'

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
        rightAction={{ icon: <Check className="h-5 w-5 text-[var(--brand-text-primary)]" />, color: 'bg-brand-primary', label: 'Complete', threshold: 100, onAction: handleToggle }}
        className="rounded-xl"
      >
        <div
          className={cn(
            'flex items-start gap-3.5 px-4 py-3.5 rounded-xl',
            'active:brightness-110 transition-[background,box-shadow] duration-200',
          )}
          style={{
            background: itemBackground,
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft,
            boxShadow,
          }}
        >
          {/* Checkbox  4444 touch target, square neobrutalist */}
          <button
            onClick={handleToggle}
            className="flex-shrink-0 flex items-center justify-center"
            style={{ padding: 11, margin: -11, marginTop: -9, paddingTop: 9 }}
            aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
          >
            <div
              className="h-[18px] w-[18px] rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                border: (todo.done || completing)
                  ? '2px solid rgb(16,185,129)'
                  : isOverdue
                    ? '2px solid rgba(248,113,113,0.65)'
                    : isInProgress
                      ? '2px solid rgba(251,146,60,0.75)'
                      : priorityCfg
                        ? `2px solid ${priorityCfg.dot}`
                        : '2px solid rgba(255,255,255,0.40)',
                background: (todo.done || completing) ? 'rgb(16,185,129)' : 'transparent',
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
                    <Check className="h-[11px] w-[11px] text-[var(--brand-text-primary)]" strokeWidth={3} />
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
                  color: 'var(--brand-text-primary)',
                  backgroundColor: 'var(--glass-surface)',
                  boxShadow: 'inset 0 0 0 2px rgba(99,179,237,0.5)',
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
                    : 'var(--brand-text-primary)',
                  textDecoration: (todo.done || completing) ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(255,255,255,0.30)',
                }}
              >
                {todo.text}
              </p>
            )}

            {/* Metadata chips  active items only */}
            {!todo.done && !completing && !editing && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">

                {/* Priority chip  uppercase, square, bordered */}
                {priorityCfg && !isInProgress && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg tracking-wider uppercase"
                    style={{
                      background: priorityCfg.chipBg,
                      color: priorityCfg.chipColor,
                      border: `1px solid ${priorityCfg.dot}55`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0"
                      style={{ background: priorityCfg.dot }}
                    />
                    {priorityCfg.label}
                  </span>
                )}

                {/* In-progress badge */}
                {isInProgress && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg tracking-wider uppercase"
                    style={{
                      background: 'rgba(251,146,60,0.18)',
                      color: "var(--brand-text-secondary)",
                      border: '1px solid rgba(251,146,60,0.35)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 bg-brand-primary animate-pulse flex-shrink-0" />
                    Working
                  </span>
                )}

                {/* Overdue badge */}
                {isOverdue && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg tracking-wider uppercase"
                    style={{
                      background: 'rgba(239,68,68,0.18)',
                      color: "var(--brand-text-secondary)",
                      border: '1px solid rgba(248,113,113,0.35)',
                    }}
                  >
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {daysOverdue === 1 ? '1d late' : `${daysOverdue}d late`}
                  </span>
                )}

                {/* Deadline */}
                {todo.deadline_date && !isOverdue && showDate && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-primary)" }}>
                    <AlertCircle className="h-3 w-3" />
                    Due {describeDate(todo.deadline_date)}
                  </span>
                )}

                {/* Scheduled date */}
                {todo.scheduled_date && showDate && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-primary)" }}>
                    <Calendar className="h-3 w-3" />
                    {describeDate(todo.scheduled_date)}
                  </span>
                )}

                {/* Scheduled time */}
                {todo.scheduled_time && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-lg"
                    style={{ background: 'rgba(99,179,237,0.12)', color: "var(--brand-text-secondary)" }}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {describeTime(todo.scheduled_time)}
                  </span>
                )}

                {/* Area chip */}
                {showArea && areaName && (
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded-lg"
                    style={{ background: 'rgba(251,191,36,0.14)', color: "var(--brand-text-secondary)" }}
                  >
                    {areaName}
                  </span>
                )}

                {/* Tags */}
                {todo.tags.filter(t => t !== 'someday').map(tag => (
                  <span key={tag} className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-lg"
                    style={{ background: 'rgba(52,211,153,0.12)', color: "var(--brand-text-secondary)" }}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}

                {/* Estimated time chip */}
                {todo.estimated_minutes && (
                  <span
                    className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-lg ml-auto"
                    style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {formatMinutes(todo.estimated_minutes)}
                  </span>
                )}

                {/* Crow insight: stale age indicator */}
                {isStale && !todo.estimated_minutes && (
                  <span
                    className="text-[11px] ml-auto"
                    style={{ color: "var(--brand-primary)" }}
                    title={`Added ${daysSinceCreated} days ago`}
                  >
                    {daysSinceCreated}d
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {todo.notes && !editing && !completing && (
              <p className="mt-1.5 text-[12px] leading-snug line-clamp-2" style={{ color: "var(--brand-primary)" }}>
                {todo.notes}
              </p>
            )}

            {/* Context indicators  project badge, source thought, AI label */}
            {!editing && !completing && (projectName || sourceMemoryTitle || isAiGenerated) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {projectName && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(139,92,246,0.1)', color: "var(--brand-text-secondary)" }}
                  >
                    <FolderKanban className="h-2.5 w-2.5" />
                    {projectName}
                  </span>
                )}
                {sourceMemoryTitle && (
                  <span
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-[200px]"
                    style={{ background: 'rgba(6,182,212,0.08)', color: "var(--brand-text-secondary)" }}
                    title={`From thought: ${sourceMemoryTitle}`}
                  >
                    <Brain className="h-2.5 w-2.5 flex-shrink-0" />
                    {sourceMemoryTitle}
                  </span>
                )}
                {isAiGenerated && !sourceMemoryTitle && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(99,102,241,0.1)', color: "var(--brand-text-secondary)" }}
                  >
                    AI suggested
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions: Start/Stop + Delete */}
          {!todo.done && !completing && (
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <button
                onClick={handleStartToggle}
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all border"
                style={isInProgress ? {
                  color: "var(--brand-text-secondary)",
                  background: 'rgba(251,146,60,0.14)',
                  borderColor: 'rgba(251,146,60,0.4)',
                } : {
                  color: "var(--brand-text-secondary)",
                  borderColor: 'rgba(255,255,255,0.1)',
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
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all border"
                style={{ color: "var(--brand-primary)" }}
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
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-all border"
              style={{ color: "var(--brand-primary)" }}
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

//  Logbook item 

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
        className="flex-shrink-0 h-[16px] w-[16px] rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(52,211,153,0.22)', border: '1px solid rgba(52,211,153,0.35)' }}
      >
        <Check className="h-[9px] w-[9px] text-[var(--brand-text-primary)]" strokeWidth={3} />
      </div>
      <span
        className="flex-1 text-[15px] truncate"
        style={{ textDecoration: 'line-through', color: "var(--brand-text-secondary)" }}
      >
        {todo.text}
      </span>
      {completedAt && (
        <span className="text-[11px] flex-shrink-0" style={{ color: "var(--brand-primary)" }}>
          {completedAt}
        </span>
      )}
      <button
        onClick={() => onUndo(todo.id)}
        className="text-[11px] flex-shrink-0 ml-1 transition-colors"
        style={{ color: "var(--brand-primary)" }}
      >
        Undo
      </button>
    </div>
  )
}
