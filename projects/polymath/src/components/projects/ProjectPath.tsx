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

import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, GripVertical, ChevronDown, ChevronRight, Clock, Flame, Hammer, Flag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'
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
  accentBg: string
}

const PHASES: PhaseConfig[] = [
  {
    key: 'ignition',
    label: 'Break the Ice',
    sublabel: 'Small moves to build momentum',
    icon: Flame,
    emptyPrompt: 'What\'s the smallest thing you could do in 10 minutes to start?',
    accent: 'rgb(251,146,60)',
    accentBg: 'rgba(251,146,60,0.1)',
  },
  {
    key: 'core',
    label: 'The Work',
    sublabel: 'Where the real building happens',
    icon: Hammer,
    emptyPrompt: 'What does the main effort look like?',
    accent: 'rgb(59,130,246)',
    accentBg: 'rgba(59,130,246,0.1)',
  },
  {
    key: 'shutdown',
    label: 'Wrap Up',
    sublabel: 'Tying loose ends, shipping it',
    icon: Flag,
    emptyPrompt: 'How do you want to finish this session?',
    accent: 'rgb(16,185,129)',
    accentBg: 'rgba(16,185,129,0.1)',
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
  // Active phase = first phase that has incomplete tasks
  for (const phase of PHASES) {
    const phaseTasks = tasks.filter(t => getPhase(t) === phase.key)
    if (phaseTasks.some(t => !t.done)) return phase.key
  }
  // All done or no tasks — show core
  return 'core'
}

export function ProjectPath({ tasks, highlightedTasks = [], onUpdate, projectId }: ProjectPathProps) {
  const [newTaskText, setNewTaskText] = useState('')
  const [addingInPhase, setAddingInPhase] = useState<PhaseKey | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseKey>>(new Set())
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showBuilt, setShowBuilt] = useState(false)

  const activePhase = determineActivePhase(tasks)

  // Auto-expand active phase
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

    const phaseTasks = tasks.filter(t => getPhase(t) === phase)
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
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        const isDone = !task.done
        return {
          ...task,
          done: isDone,
          completed_at: isDone ? new Date().toISOString() : undefined,
        }
      }
      return task
    })
    onUpdate(updatedTasks)
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

  const handleEstimateChange = (taskId: string, currentEstimate: number = 0) => {
    const options = [5, 10, 15, 25, 45, 60]
    const nextIndex = options.findIndex(o => o > currentEstimate)
    const nextEstimate = nextIndex === -1 ? options[0] : options[nextIndex]
    onUpdate(tasks.map(t =>
      t.id === taskId ? { ...t, estimated_minutes: nextEstimate, estimate_set: true } : t
    ))
  }

  // Separate completed tasks across all phases
  const allCompleted = tasks.filter(t => t.done)
  const totalTasks = tasks.length
  const completedCount = allCompleted.length

  // Check if any phase has tasks (to decide whether to show empty state)
  const hasAnyTasks = totalTasks > 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-grow opacity-50">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-text-primary)]/50">
            The Path
          </span>
          <div className="h-px bg-white/20 flex-grow" />
        </div>
        {totalTasks > 0 && (
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color: 'var(--brand-primary)', opacity: 0.5 }}
          >
            {completedCount}/{totalTasks}
          </span>
        )}
      </div>

      {/* Phase Sections */}
      {PHASES.map((phase) => {
        const phaseTasks = tasks.filter(t => getPhase(t) === phase.key)
        const incomplete = phaseTasks.filter(t => !t.done).sort((a, b) => a.order - b.order)
        const completed = phaseTasks.filter(t => t.done)
        const isActive = phase.key === activePhase
        const isExpanded = expandedPhases.has(phase.key)
        const PhaseIcon = phase.icon

        // Skip phases with no tasks and not active (unless it's core which always shows)
        if (phaseTasks.length === 0 && !isActive && phase.key !== 'core') {
          return null
        }

        return (
          <div key={phase.key} className="relative">
            {/* Phase Header */}
            <button
              onClick={() => togglePhase(phase.key)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                isActive
                  ? "bg-white/[0.04] border border-white/[0.08]"
                  : "hover:bg-white/[0.02] border border-transparent"
              )}
            >
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isActive ? phase.accentBg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? `${phase.accent}30` : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <PhaseIcon
                  className="h-3.5 w-3.5"
                  style={{ color: isActive ? phase.accent : 'var(--brand-text-secondary)', opacity: isActive ? 0.9 : 0.3 }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.15em] block"
                  style={{ color: isActive ? phase.accent : 'var(--brand-text-secondary)', opacity: isActive ? 0.8 : 0.35 }}
                >
                  {phase.label}
                </span>
                {isActive && incomplete.length === 0 && phaseTasks.length === 0 && (
                  <span
                    className="text-[10px] block mt-0.5"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
                  >
                    {phase.sublabel}
                  </span>
                )}
              </div>

              {/* Task count */}
              {phaseTasks.length > 0 && (
                <span
                  className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                  style={{
                    background: completed.length === phaseTasks.length ? `${phase.accent}15` : 'rgba(255,255,255,0.04)',
                    color: completed.length === phaseTasks.length ? phase.accent : 'var(--brand-text-secondary)',
                    opacity: 0.5,
                  }}
                >
                  {completed.length}/{phaseTasks.length}
                </span>
              )}

              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }} />
                : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }} />
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
                  <div className="pl-4 pr-1 pt-1 pb-2 space-y-1.5">
                    {/* Incomplete tasks */}
                    {incomplete.map((task, index) => {
                      const isNext = index === 0 && isActive
                      const isHighlighted = highlightedTasks.some(
                        h => similar(h.task_title || h.title, task.text) || similar(h.task_description || '', task.text)
                      )

                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15, delay: index * 0.03 }}
                          className={cn(
                            "group flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative",
                            isNext
                              ? "bg-white/[0.04] border border-white/[0.08]"
                              : isHighlighted
                                ? "bg-blue-500/5 border border-blue-500/20"
                                : "hover:bg-white/[0.02] border border-transparent"
                          )}
                        >
                          {/* Active indicator */}
                          {isNext && (
                            <div
                              className="absolute -left-0.5 top-2 bottom-2 w-0.5 rounded-full"
                              style={{ background: phase.accent }}
                            />
                          )}

                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleTask(task.id)}
                            className={cn(
                              "flex-shrink-0 h-5.5 w-5.5 rounded-lg flex items-center justify-center transition-all border-2",
                              isNext ? "border-white/25 bg-white/5 hover:border-white/40" : "border-white/15 bg-black/20 hover:border-white/30"
                            )}
                            style={isNext ? { borderColor: `${phase.accent}50` } : {}}
                          >
                            {task.done && <Check className="h-3 w-3 text-[var(--brand-text-primary)]" />}
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
                                className="w-full px-2 py-1 text-sm rounded-lg bg-white/10 outline-none ring-1 ring-blue-500/50"
                                style={{ color: 'var(--brand-text-primary)' }}
                                autoFocus
                              />
                            ) : (
                              <div>
                                <span
                                  className={cn(
                                    "text-[14px] font-medium cursor-text transition-all leading-snug block",
                                    isNext ? "text-[var(--brand-text-primary)]" : "text-[var(--brand-text-primary)]/75"
                                  )}
                                  onClick={() => handleEditStart(task.id, task.text)}
                                >
                                  {task.text}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  {/* Time estimate */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEstimateChange(task.id, task.estimated_minutes)
                                    }}
                                    className={cn(
                                      "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md transition-colors",
                                      task.estimate_set
                                        ? "bg-white/5 text-[var(--brand-text-primary)]/50 hover:bg-white/10"
                                        : "bg-transparent text-[var(--brand-text-primary)]/15 hover:bg-white/5"
                                    )}
                                  >
                                    {task.estimate_set
                                      ? `${task.estimated_minutes}m`
                                      : <Clock className="h-3 w-3 opacity-40" />
                                    }
                                  </button>

                                  {task.is_ai_suggested && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand-primary opacity-50">
                                      suggested
                                    </span>
                                  )}

                                  {isHighlighted && (
                                    <span
                                      className="text-[9px] font-black uppercase tracking-widest"
                                      style={{ color: phase.accent, opacity: 0.5 }}
                                    >
                                      focus
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-40 hover:!opacity-80 active:bg-red-500/10 transition-all text-[var(--brand-text-primary)]"
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      )
                    })}

                    {/* Phase completed tasks (collapsed) */}
                    {completed.length > 0 && (
                      <div className="pt-1">
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-3 block"
                          style={{ color: phase.accent, opacity: 0.3 }}
                        >
                          {completed.length} built
                        </span>
                      </div>
                    )}

                    {/* Add task in this phase */}
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
                          className="flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none bg-white/[0.05] border border-white/10"
                          style={{ color: 'var(--brand-text-primary)' }}
                        />
                        <button
                          onClick={() => handleAddTask(phase.key)}
                          disabled={!newTaskText.trim()}
                          className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-30"
                          style={{
                            background: phase.accentBg,
                            border: `1px solid ${phase.accent}30`,
                            color: phase.accent,
                          }}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingInPhase(phase.key); setNewTaskText('') }}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium transition-colors w-full rounded-lg hover:bg-white/[0.02]"
                        style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}

                    {/* Empty phase prompt */}
                    {incomplete.length === 0 && completed.length === 0 && isActive && (
                      <p
                        className="text-[12px] italic px-3 py-2"
                        style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}
                      >
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

      {/* Built Trail — all completed tasks across phases */}
      {allCompleted.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowBuilt(!showBuilt)}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-white/[0.02] transition-colors text-left"
          >
            {showBuilt ? (
              <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }} />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }} />
            )}
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}
            >
              {allCompleted.length} thing{allCompleted.length !== 1 ? 's' : ''} built
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
                <div className="pl-8 pr-4 pb-2 space-y-1">
                  {allCompleted.map(task => {
                    const phase = PHASES.find(p => p.key === getPhase(task)) || PHASES[1]
                    return (
                      <div
                        key={task.id}
                        className="group flex items-center gap-2.5 py-1.5"
                      >
                        <button
                          onClick={() => handleToggleTask(task.id)}
                          className="flex-shrink-0 h-4 w-4 rounded-md flex items-center justify-center transition-all"
                          style={{ background: `${phase.accent}20`, border: `1px solid ${phase.accent}25` }}
                        >
                          <Check className="h-2.5 w-2.5" style={{ color: phase.accent }} />
                        </button>
                        <span
                          className="text-[12px] leading-snug"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                        >
                          {task.text}
                        </span>
                        {task.completed_at && (
                          <span
                            className="text-[9px] ml-auto flex-shrink-0"
                            style={{ color: 'var(--brand-text-secondary)', opacity: 0.15 }}
                          >
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

      {/* Linked Todos from the Todo system */}
      {projectId && <LinkedTodos projectId={projectId} />}

      {/* Empty State */}
      {!hasAnyTasks && (
        <div className="text-center py-8" style={{ color: 'var(--brand-text-secondary)' }}>
          <p className="text-sm opacity-40">No tasks yet</p>
          <p className="text-xs mt-1 opacity-25">Break your project into phases — start small, build up, wrap clean.</p>
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
    <div className="mt-4 pt-4 border-t border-brand-border">
      <div className="flex items-center gap-2 mb-3 px-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}>
          Linked Todos
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
          {activeTodos.length}
        </span>
      </div>
      <div className="space-y-1 px-3">
        {activeTodos.map(todo => (
          <div key={todo.id} className="flex items-center gap-2.5 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
            <button
              onClick={() => toggleTodo(todo.id)}
              className="flex-shrink-0 h-4.5 w-4.5 rounded-md flex items-center justify-center border-2 border-white/15 bg-black/20 transition-all hover:border-blue-500/40"
            >
              {todo.done && <Check className="h-2.5 w-2.5 text-brand-text-primary" />}
            </button>
            <span className="text-[13px]" style={{ color: 'var(--brand-text-primary)', opacity: 0.7 }}>
              {todo.text}
            </span>
            {todo.source_memory_id && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(6,182,212,0.08)', color: 'var(--brand-text-secondary)', opacity: 0.3 }}>
                from thought
              </span>
            )}
          </div>
        ))}
        {doneTodos.length > 0 && (
          <p className="text-[10px] pt-1" style={{ color: 'var(--brand-text-secondary)', opacity: 0.2 }}>
            {doneTodos.length} completed
          </p>
        )}
      </div>
    </div>
  )
}
