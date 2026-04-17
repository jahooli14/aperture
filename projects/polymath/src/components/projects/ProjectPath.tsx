/**
 * The Path — Project Journey View
 *
 * Replaces the flat "Task Checklist" with a phased journey.
 * Tasks are grouped by task_type (ignition → core → shutdown).
 * The current phase is expanded and prominent; others collapse.
 * Completed items form a "built" trail that reinforces progress.
 *
 * Tasks without a task_type default to 'core'.
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, ChevronDown, ChevronRight, Clock, Flame, Hammer, Flag, GripVertical } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'
import { handleInputFocus } from '../../utils/keyboard'
import { useTodoStore, selectByProject } from '../../stores/useTodoStore'
import type { Task } from './TaskList'

interface ProjectPathProps {
  tasks: Task[]
  highlightedTasks?: any[]
  onUpdate: (tasks: Task[]) => void
  projectId?: string
}

type PhaseKey = 'ignition' | 'core' | 'shutdown'

interface PhaseConfig {
  key: PhaseKey
  label: string
  sublabel: string
  icon: typeof Flame
  emptyPrompt: string
  accent: string
}

const PHASES: PhaseConfig[] = [
  {
    key: 'ignition',
    label: 'Break the Ice',
    sublabel: 'Small moves to build momentum',
    icon: Flame,
    emptyPrompt: 'What\'s the smallest thing you could do in 10 minutes to start?',
    accent: 'rgb(251,146,60)',
  },
  {
    key: 'core',
    label: 'The Work',
    sublabel: 'Where the real building happens',
    icon: Hammer,
    emptyPrompt: 'What does the main effort look like?',
    accent: 'rgb(var(--brand-primary-rgb))',
  },
  {
    key: 'shutdown',
    label: 'Wrap Up',
    sublabel: 'Tying loose ends, shipping it',
    icon: Flag,
    emptyPrompt: 'How do you want to finish this session?',
    accent: 'rgb(16,185,129)',
  },
]

function getPhase(task: Task): PhaseKey {
  return task.task_type || 'core'
}

function similar(a: string, b: string) {
  const s1 = a.toLowerCase()
  const s2 = b.toLowerCase()
  return s1.includes(s2) || s2.includes(s1)
}

function determineActivePhase(tasks: Task[]): PhaseKey {
  for (const phase of PHASES) {
    const phaseTasks = tasks.filter(t => getPhase(t) === phase.key)
    if (phaseTasks.some(t => !t.done)) return phase.key
  }
  return 'core'
}

export function ProjectPath({ tasks, highlightedTasks = [], onUpdate, projectId }: ProjectPathProps) {
  const [newTaskText, setNewTaskText] = useState('')
  const [addingInPhase, setAddingInPhase] = useState<PhaseKey | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseKey>>(new Set())
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showBuilt, setShowBuilt] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const activePhase = determineActivePhase(tasks)

  useEffect(() => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      next.add(activePhase)
      return next
    })
  }, [activePhase])

  const togglePhase = (phase: PhaseKey) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
  }

  const handleAddTask = (phase: PhaseKey) => {
    if (!newTaskText.trim()) return
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: tasks.length,
      task_type: phase,
      estimated_minutes: phase === 'ignition' ? 10 : phase === 'shutdown' ? 5 : 15,
    }
    onUpdate([...tasks, newTask])
    setNewTaskText('')
    setAddingInPhase(null)
  }

  const handleToggleTask = (taskId: string) => {
    onUpdate(tasks.map(task =>
      task.id === taskId
        ? { ...task, done: !task.done, completed_at: !task.done ? new Date().toISOString() : undefined }
        : task
    ))
  }

  const handleDeleteTask = (taskId: string) => {
    onUpdate(tasks.filter(t => t.id !== taskId).map((t, i) => ({ ...t, order: i })))
  }

  const handleEditStart = (taskId: string, text: string) => {
    setEditingTaskId(taskId)
    setEditingText(text)
  }

  const handleEditSave = (taskId: string) => {
    if (!editingText.trim()) return
    onUpdate(tasks.map(t => t.id === taskId ? { ...t, text: editingText.trim() } : t))
    setEditingTaskId(null)
    setEditingText('')
  }

  const handleReorderInPhase = useCallback((draggedTaskId: string, targetTaskId: string) => {
    if (draggedTaskId === targetTaskId) return
    const draggedTask = tasks.find(t => t.id === draggedTaskId)
    const targetTask = tasks.find(t => t.id === targetTaskId)
    if (!draggedTask || !targetTask) return
    if (getPhase(draggedTask) !== getPhase(targetTask)) return
    if (draggedTask.done || targetTask.done) return

    const phase = getPhase(draggedTask)
    const phaseTasks = tasks
      .filter(t => getPhase(t) === phase && !t.done)
      .sort((a, b) => a.order - b.order)
    const otherTasks = tasks.filter(t => !(getPhase(t) === phase && !t.done))

    const fromIdx = phaseTasks.findIndex(t => t.id === draggedTaskId)
    const toIdx = phaseTasks.findIndex(t => t.id === targetTaskId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...phaseTasks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const merged = [...otherTasks, ...reordered]
    onUpdate(merged.map((t, i) => ({ ...t, order: i })))
  }, [tasks, onUpdate])

  const handleEstimateChange = (taskId: string, currentEstimate: number = 0) => {
    const options = [5, 10, 15, 25, 45, 60]
    const nextIndex = options.findIndex(o => o > currentEstimate)
    const nextEstimate = nextIndex === -1 ? options[0] : options[nextIndex]
    onUpdate(tasks.map(t =>
      t.id === taskId ? { ...t, estimated_minutes: nextEstimate, estimate_set: true } : t
    ))
  }

  const allCompleted = tasks.filter(t => t.done)
  const totalTasks = tasks.length
  const completedCount = allCompleted.length
  const hasAnyTasks = totalTasks > 0

  // Progress bar
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  return (
    <div className="space-y-2">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)]">
          The Path
        </span>
        {totalTasks > 0 && (
          <span className="text-[11px] font-bold tabular-nums text-[var(--brand-text-secondary)]">
            {completedCount}/{totalTasks}
          </span>
        )}
      </div>

      {/* Thin progress bar */}
      {totalTasks > 0 && (
        <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'rgb(52,211,153)', boxShadow: '0 0 8px rgba(52,211,153,0.5)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Phase Sections */}
      <div className="space-y-1.5">
        {PHASES.map((phase) => {
          const phaseTasks = tasks.filter(t => getPhase(t) === phase.key)
          const incomplete = phaseTasks.filter(t => !t.done).sort((a, b) => a.order - b.order)
          const completed = phaseTasks.filter(t => t.done)
          const isActive = phase.key === activePhase
          const isExpanded = expandedPhases.has(phase.key)
          const PhaseIcon = phase.icon

          if (phaseTasks.length === 0 && !isActive && phase.key !== 'core') return null

          return (
            <div key={phase.key} className="rounded-2xl overflow-hidden" style={{ background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent', border: isExpanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent' }}>
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.key)}
                className="w-full flex items-center gap-3 px-4 min-h-[48px] transition-all text-left hover:bg-white/[0.03]"
              >
                <PhaseIcon
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: isActive ? phase.accent : 'var(--brand-text-muted)' }}
                />

                <span
                  className="text-[12px] font-bold uppercase tracking-wider flex-1"
                  style={{ color: isActive ? phase.accent : 'var(--brand-text-secondary)' }}
                >
                  {phase.label}
                </span>

                {phaseTasks.length > 0 && (
                  <span className="text-[11px] font-bold tabular-nums text-[var(--brand-text-muted)]">
                    {completed.length}/{phaseTasks.length}
                  </span>
                )}

                {isExpanded
                  ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--brand-text-muted)]" />
                  : <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--brand-text-muted)]" />
                }
              </button>

              {/* Phase Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-0.5">
                      {/* Incomplete tasks */}
                      {incomplete.map((task, index) => {
                        const isNext = index === 0 && isActive
                        const isHighlighted = highlightedTasks.some(
                          h => similar(h.task_title || h.title, task.text) || similar(h.task_description || '', task.text)
                        )

                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15, delay: index * 0.03 }}
                            draggable={editingTaskId !== task.id}
                            onDragStart={() => setDraggedId(task.id)}
                            onDragOver={(e) => {
                              e.preventDefault()
                              if (!draggedId || draggedId === task.id) return
                              handleReorderInPhase(draggedId, task.id)
                            }}
                            onDragEnd={() => setDraggedId(null)}
                            className={cn(
                              "group flex items-start gap-2 px-3 py-2.5 rounded-xl transition-all relative",
                              isHighlighted && "bg-brand-primary/[0.04]"
                            )}
                            style={{ opacity: draggedId === task.id ? 0.4 : 1 }}
                          >
                            {/* Drag handle */}
                            <div
                              className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 transition-opacity"
                              style={{ color: 'var(--brand-text-secondary)' }}
                              aria-label="Drag to reorder"
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleTask(task.id)}
                              className="flex-shrink-0 h-5 w-5 rounded-lg flex items-center justify-center transition-all mt-0.5"
                              style={{
                                border: `1.5px solid ${isNext ? `${phase.accent}40` : 'rgba(255,255,255,0.12)'}`,
                                background: isNext ? `${phase.accent}08` : 'transparent',
                              }}
                            >
                              {task.done && <Check className="h-3 w-3" style={{ color: phase.accent }} />}
                            </button>

                            {/* Task content */}
                            <div className="flex-1 min-w-0">
                              {editingTaskId === task.id ? (
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onFocus={handleInputFocus}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSave(task.id)
                                    if (e.key === 'Escape') { setEditingTaskId(null); setEditingText('') }
                                  }}
                                  className="w-full px-2 py-1 text-[14px] rounded-lg bg-white/[0.06] outline-none border border-white/[0.1] focus:border-white/[0.2]"
                                  style={{ color: 'var(--brand-text-primary)' }}
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <div
                                    className="cursor-text"
                                    style={{ color: 'var(--brand-text-primary)', opacity: isNext ? 0.9 : 0.65 }}
                                    onClick={() => handleEditStart(task.id, task.text)}
                                  >
                                    <MarkdownRenderer content={task.text} className="text-[14px] leading-snug [&_p]:m-0" />
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEstimateChange(task.id, task.estimated_minutes) }}
                                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors hover:bg-white/[0.04]"
                                      style={{ color: 'var(--brand-text-secondary)', opacity: task.estimate_set ? 0.35 : 0.15 }}
                                    >
                                      {task.estimate_set ? `${task.estimated_minutes}m` : <Clock className="h-2.5 w-2.5" />}
                                    </button>
                                    {task.is_ai_suggested && (
                                      <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--brand-primary)', opacity: 0.35 }}>suggested</span>
                                    )}
                                    {isHighlighted && (
                                      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: phase.accent, opacity: 0.5 }}>focus</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-30 hover:!opacity-60 transition-all"
                              style={{ color: 'var(--brand-text-primary)' }}
                              aria-label="Delete task"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </motion.div>
                        )
                      })}

                      {/* Completed count */}
                      {completed.length > 0 && (
                        <p className="text-[10px] font-medium px-3 pt-1" style={{ color: phase.accent, opacity: 0.25 }}>
                          {completed.length} done
                        </p>
                      )}

                      {/* Add task */}
                      {addingInPhase === phase.key ? (
                        <div className="flex gap-2 px-3 pt-1">
                          <input
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onFocus={handleInputFocus}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddTask(phase.key)
                              if (e.key === 'Escape') { setAddingInPhase(null); setNewTaskText('') }
                            }}
                            placeholder={phase.emptyPrompt}
                            autoFocus
                            className="flex-1 px-3 py-2 text-[13px] rounded-xl focus:outline-none border border-white/[0.08] focus:border-white/[0.15]"
                            style={{ color: 'var(--brand-text-primary)', background: 'rgba(255,255,255,0.03)' }}
                          />
                          <button
                            onClick={() => handleAddTask(phase.key)}
                            disabled={!newTaskText.trim()}
                            className="px-3 py-2 text-[11px] font-medium rounded-xl transition-all disabled:opacity-20"
                            style={{ background: `${phase.accent}12`, color: phase.accent }}
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingInPhase(phase.key); setNewTaskText('') }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors w-full rounded-lg hover:bg-white/[0.02]"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      )}

                      {/* Empty phase prompt */}
                      {incomplete.length === 0 && completed.length === 0 && isActive && (
                        <p className="text-[12px] px-3 py-2" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }}>
                          {phase.emptyPrompt}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Built Trail */}
      {allCompleted.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowBuilt(!showBuilt)}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/[0.02] transition-colors text-left"
          >
            {showBuilt
              ? <ChevronDown className="h-3 w-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.15 }} />
              : <ChevronRight className="h-3 w-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.15 }} />
            }
            <span className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }}>
              {allCompleted.length} thing{allCompleted.length !== 1 ? 's' : ''} done
            </span>
          </button>

          <AnimatePresence>
            {showBuilt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pl-8 pr-4 pb-2 space-y-0.5">
                  {allCompleted.map(task => {
                    const phase = PHASES.find(p => p.key === getPhase(task)) || PHASES[1]
                    return (
                      <div key={task.id} className="group flex items-center gap-2.5 py-1.5">
                        <button
                          onClick={() => handleToggleTask(task.id)}
                          className="flex-shrink-0 h-4 w-4 rounded-md flex items-center justify-center transition-all"
                          style={{ background: `${phase.accent}12`, border: `1px solid ${phase.accent}18` }}
                        >
                          <Check className="h-2.5 w-2.5" style={{ color: phase.accent, opacity: 0.7 }} />
                        </button>
                        <span className="text-[12px] leading-snug" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}>
                          {task.text}
                        </span>
                        {task.completed_at && (
                          <span className="text-[9px] ml-auto flex-shrink-0" style={{ color: 'var(--brand-text-secondary)', opacity: 0.12 }}>
                            {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Linked Todos */}
      {projectId && <LinkedTodos projectId={projectId} />}

      {/* Empty State */}
      {!hasAnyTasks && (
        <div className="text-center py-10">
          <p className="text-[14px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}>No tasks yet</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--brand-text-secondary)', opacity: 0.18 }}>Break it into phases — start small, build up, wrap clean.</p>
        </div>
      )}
    </div>
  )
}

/**
 * Linked Todos — shows todos linked to this project from the todo store.
 */
function LinkedTodos({ projectId }: { projectId: string }) {
  const todos = useTodoStore(state => state.todos)
  const toggleTodo = useTodoStore(state => state.toggleTodo)
  const fetchTodos = useTodoStore(state => state.fetchTodos)
  const linkedTodos = selectByProject(todos, projectId)

  useEffect(() => {
    if (todos.length === 0) fetchTodos()
  }, [todos.length, fetchTodos])

  if (linkedTodos.length === 0) return null

  const activeTodos = linkedTodos.filter(t => !t.done)
  const doneTodos = linkedTodos.filter(t => t.done)

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-2 mb-3 px-3">
        <span className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}>
          Linked Todos
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', color: 'var(--brand-text-secondary)', opacity: 0.3 }}>
          {activeTodos.length}
        </span>
      </div>
      <div className="space-y-0.5 px-3">
        {activeTodos.map(todo => (
          <div key={todo.id} className="flex items-center gap-2.5 py-2 rounded-xl hover:bg-white/[0.02] transition-colors px-2">
            <button
              onClick={() => toggleTodo(todo.id)}
              className="flex-shrink-0 h-4 w-4 rounded-md flex items-center justify-center transition-all"
              style={{ border: '1.5px solid rgba(255,255,255,0.12)', background: 'transparent' }}
            >
              {todo.done && <Check className="h-2.5 w-2.5 text-brand-text-primary" />}
            </button>
            <span className="text-[13px]" style={{ color: 'var(--brand-text-primary)', opacity: 0.6 }}>
              {todo.text}
            </span>
            {todo.source_memory_id && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md ml-auto" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--brand-text-secondary)', opacity: 0.2 }}>
                from thought
              </span>
            )}
          </div>
        ))}
        {doneTodos.length > 0 && (
          <p className="text-[10px] pt-1 px-2" style={{ color: 'var(--brand-text-secondary)', opacity: 0.15 }}>
            {doneTodos.length} completed
          </p>
        )}
      </div>
    </div>
  )
}
