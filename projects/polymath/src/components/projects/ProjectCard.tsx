import React, { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'
import { ArrowRight, Clock, Star, Zap, X, CheckCircle, Archive, Plus } from 'lucide-react'
import type { Project } from '../../types'
import { useContextEngineStore } from '../../stores/useContextEngineStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { handleInputFocus } from '../../utils/keyboard'
import { getTheme, PROJECT_COLORS } from '../../lib/projectTheme'
import { getNextTask } from '../../lib/taskUtils'

interface Task {
  id: string
  text: string
  done: boolean
  created_at: string
  order: number
}

const CARD_HOVER_STYLES = {
  enter: { background: 'var(--glass-surface)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)', transform: 'translateY(-2px)' },
  leave: { background: 'var(--brand-glass-bg)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transform: 'translateY(0)' }
}

// Re-export for backwards compatibility
export { PROJECT_COLORS } from '../../lib/projectTheme'

const LONG_PRESS_DURATION = 450

export function ProjectCard({ project, prominent = false }: { project: Project, prominent?: boolean }) {
  const { setContext, toggleSidebar } = useContextEngineStore()
  const { setPriority, updateProject } = useProjectStore()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const tasks = (project.metadata?.tasks || []) as Task[]
  const nextTask = getNextTask(project)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showQuickAddTask, setShowQuickAddTask] = useState(false)
  const [quickTaskText, setQuickTaskText] = useState('')
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const theme = getTheme(project.type ?? '', project.title)

  const handleTouchStart = () => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setShowContextMenu(true)
    }, LONG_PRESS_DURATION)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleViewInsights = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContext('project', project.id, project.title, `${project.title}\n\n${project.description || ''}`)
    toggleSidebar(true)
    setShowContextMenu(false)
  }

  const handleTogglePriority = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await setPriority(project.id)
    setShowContextMenu(false)
  }

  const handleMarkComplete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await updateProject(project.id, { status: 'completed' })
    addToast({ title: 'Project completed!', description: `"${project.title}" marked as complete.`, variant: 'success' })
    setShowContextMenu(false)
  }

  const handleSendToGraveyard = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await updateProject(project.id, { status: 'graveyard' })
    addToast({ title: 'Sent to Graveyard', description: `"${project.title}" archived.` })
    setShowContextMenu(false)
  }

  const handleQuickAddTask = async () => {
    if (!quickTaskText.trim()) return
    const existingTasks = (project.metadata?.tasks || []) as Task[]
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: quickTaskText.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: existingTasks.length
    }
    await updateProject(project.id, {
      metadata: { ...project.metadata, tasks: [...existingTasks, newTask] }
    })
    addToast({ title: 'Task added', description: `Added to "${project.title}"`, variant: 'success' })
    setQuickTaskText('')
    setShowQuickAddTask(false)
    setShowContextMenu(false)
  }

  const handleOpenProject = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowContextMenu(false)
    navigate(`/projects/${project.id}`)
  }

  return (
    <>
      <Link
        to={`/projects/${project.id}`}
        className={`group block glass-card glass-card-hover transition-all duration-300 break-inside-avoid ${prominent ? 'p-5 scale-[1.02]' : 'p-4'}`}
        style={{
          borderColor: project.is_priority ? 'var(--brand-primary)' : theme.border,
          background: `rgba(${theme.rgb}, 0.08)`,
          boxShadow: project.is_priority ? `0 8px 32px rgba(${theme.rgb}, 0.2)` : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onClick={handleClick}
      >
        {/* Header — full-width title, no icon buttons */}
        <div className="mb-3 flex items-start gap-2">
          {project.is_priority && (
            <Star className="h-3 w-3 mt-1 flex-shrink-0 fill-current" style={{ color: 'var(--brand-primary)' }} />
          )}
          <h4 className="font-bold leading-tight aperture-header text-[var(--brand-text-primary)]" style={{ fontSize: prominent ? '1.125rem' : '0.875rem' }}>
            {project.title}
          </h4>
        </div>

        {/* Next Action — no icon, just text */}
        {nextTask ? (
          <div className="mb-4">
            <div
              className="rounded-lg p-3 transition-all group-hover:bg-[var(--glass-surface)]"
              style={{
                background: `rgba(${theme.rgb}, 0.1)`,
                boxShadow: `inset 0 0 0 1px rgba(${theme.rgb}, 0.2)`
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70 aperture-header" style={{ color: theme.text }}>
                Next Step
              </p>
              <MarkdownRenderer
                content={nextTask.text}
                className="text-sm font-medium leading-snug text-[var(--brand-text-primary)] line-clamp-3 aperture-body"
              />
            </div>
          </div>
        ) : (
          project.description && (
            <MarkdownRenderer
              content={`"${project.description}"`}
              className={`mb-4 italic opacity-90 aperture-body ${prominent ? 'text-sm line-clamp-3' : 'text-xs line-clamp-4'}`}
              style={{ color: `rgba(${theme.rgb}, 0.9)` }}
            />
          )
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid rgba(${theme.rgb}, 0.1)` }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {totalTasks > 0 ? (
              <div className="flex flex-col gap-1 w-full">
                <div className="w-full h-1 bg-[var(--glass-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: progress >= 80 ? 'var(--brand-primary)' : theme.text
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header">
                  {progress >= 80 ? 'Concept Proved' : `${Math.round(progress)}% Momentum`}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)] flex items-center gap-1 aperture-header">
                <Clock className="h-3 w-3" />
                {new Date(project.last_active || project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {prominent && (
            <div className="p-1.5 rounded-full bg-[var(--glass-surface)] transition-colors flex-shrink-0" style={{ color: `rgba(${theme.rgb}, 0.8)` }}>
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      </Link>

      {/* Long-press context overlay */}
      {showContextMenu && createPortal(
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 z-[200] flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowContextMenu(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Bottom sheet */}
            <motion.div
              className="relative w-full"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="mx-3 mb-8 rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--brand-bg)',
                  border: `1.5px solid rgba(${theme.rgb}, 0.3)`,
                  boxShadow: `0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(${theme.rgb}, 0.1)`
                }}
              >
                {/* Header */}
                <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid rgba(${theme.rgb}, 0.15)` }}>
                  <div>
                    {project.type && (
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-50" style={{ color: theme.text }}>
                        {project.type}
                      </span>
                    )}
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-none mt-0.5">
                      {project.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowContextMenu(false)}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
                    style={{ color: 'var(--brand-text-muted)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="p-4 space-y-3">
                  <button
                    onClick={handleTogglePriority}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                    style={{
                      background: project.is_priority ? 'rgba(245,158,11,0.12)' : 'var(--glass-surface)',
                      border: project.is_priority ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid rgba(255,255,255,0.06)',
                      color: project.is_priority ? 'rgb(245,158,11)' : 'var(--brand-text-primary)'
                    }}
                  >
                    <Star className={`h-5 w-5 flex-shrink-0 ${project.is_priority ? 'fill-current' : ''}`} />
                    <div>
                      <p className="text-sm font-bold">
                        {project.is_priority ? 'Remove Priority' : 'Set as Priority'}
                      </p>
                      <p className="text-[11px] opacity-60 mt-0.5">
                        {project.is_priority ? 'Clear this project\'s focus status' : 'Pin this project as your main focus'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={handleViewInsights}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                    style={{
                      background: 'var(--glass-surface)',
                      border: '1.5px solid rgba(255,255,255,0.06)',
                      color: 'var(--brand-text-primary)'
                    }}
                  >
                    <Zap className="h-5 w-5 flex-shrink-0" style={{ color: theme.text }} />
                    <div>
                      <p className="text-sm font-bold">View Insights</p>
                      <p className="text-[11px] opacity-60 mt-0.5">See related memories and context</p>
                    </div>
                  </button>

                  <button
                    onClick={handleMarkComplete}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                    style={{
                      background: 'var(--glass-surface)',
                      border: '1.5px solid rgba(255,255,255,0.06)',
                      color: 'var(--brand-text-primary)'
                    }}
                  >
                    <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(34,197,94)' }} />
                    <div>
                      <p className="text-sm font-bold">Mark Complete</p>
                      <p className="text-[11px] opacity-60 mt-0.5">Finish it and celebrate</p>
                    </div>
                  </button>

                  <button
                    onClick={handleSendToGraveyard}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                    style={{
                      background: 'var(--glass-surface)',
                      border: '1.5px solid rgba(255,255,255,0.06)',
                      color: 'var(--brand-text-primary)'
                    }}
                  >
                    <Archive className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(161,161,170)' }} />
                    <div>
                      <p className="text-sm font-bold">Send to Graveyard</p>
                      <p className="text-[11px] opacity-60 mt-0.5">Archive this project for now</p>
                    </div>
                  </button>

                  {showQuickAddTask ? (
                    <div
                      className="w-full px-4 py-3.5 rounded-xl"
                      style={{
                        background: 'var(--glass-surface)',
                        border: '1.5px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickTaskText}
                          onChange={(e) => setQuickTaskText(e.target.value)}
                          onFocus={handleInputFocus}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickAddTask()
                            if (e.key === 'Escape') { setShowQuickAddTask(false); setQuickTaskText('') }
                          }}
                          placeholder="Task description..."
                          autoFocus
                          className="flex-1 bg-transparent border-0 outline-none text-sm text-[var(--brand-text-primary)] placeholder-[var(--brand-text-muted)]"
                        />
                        <button
                          onClick={handleQuickAddTask}
                          disabled={!quickTaskText.trim()}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                          style={{ background: `rgba(${theme.rgb}, 0.2)`, color: theme.text }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQuickAddTask(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                      style={{
                        background: 'var(--glass-surface)',
                        border: '1.5px solid rgba(255,255,255,0.06)',
                        color: 'var(--brand-text-primary)'
                      }}
                    >
                      <Plus className="h-5 w-5 flex-shrink-0" style={{ color: theme.text }} />
                      <div>
                        <p className="text-sm font-bold">Quick Add Task</p>
                        <p className="text-[11px] opacity-60 mt-0.5">Add an action item right now</p>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={handleOpenProject}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black uppercase tracking-widest text-sm transition-all"
                    style={{
                      background: `rgba(${theme.rgb}, 0.15)`,
                      border: `1.5px solid rgba(${theme.rgb}, 0.3)`,
                      color: theme.text
                    }}
                  >
                    Open Project →
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
