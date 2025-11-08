/**
 * ProjectCard Component - Stunning Visual Design
 */

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Clock, Zap, Edit, Trash2, Link2, Pencil, Copy, Share2, Archive, Star, MoreVertical } from 'lucide-react'
import type { ProjectCardProps } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { haptic } from '../../utils/haptics'
import { useLongPress } from '../../hooks/useLongPress'
import { ContextMenu, type ContextMenuItem } from '../ui/context-menu'
import { SuggestionBadge } from '../SuggestionBadge'

export const ProjectCard = React.memo(function ProjectCard({
  project: initialProject,
  onDelete,
  onClick,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  // Get fresh project data from store every render
  const projects = useProjectStore(state => state.projects)
  const project = projects.find(p => p.id === initialProject.id) || initialProject

  const relativeTime = formatRelativeTime(project.last_active)
  const [connectionCount, setConnectionCount] = useState(0)
  const [exitX, setExitX] = useState(0)
  const [showQuickNote, setShowQuickNote] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const { updateProject, setPriority } = useProjectStore()
  const { addToast } = useToast()

  // Motion values for swipe gesture - stable references, no memoization needed
  const x = useMotionValue(0)
  const noteIndicatorOpacity = useTransform(x, [0, 100], [0, 1])
  const backgroundColor = useTransform(
    x,
    [0, 150],
    ['rgba(20, 27, 38, 0.4)', 'rgba(59, 130, 246, 0.3)']
  )

  // Long-press for context menu
  const longPressHandlers = useLongPress(() => {
    setShowContextMenu(true)
  }, {
    threshold: 500,
  })

  useEffect(() => {
    // Temporarily disabled to reduce console noise during debugging
    // fetchConnectionCount()
  }, [project.id])

  const fetchConnectionCount = async () => {
    // Temporarily disabled
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    // Navigate immediately on click (removed expand-then-navigate pattern)
    onClick?.(project.id)
  }

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x

    // Swipe right = Quick note
    if (offset > 100 || velocity > 500) {
      haptic.light()
      setShowQuickNote(true)
      // Reset position
      x.set(0)
    }
  }

  const handleQuickNoteSubmit = async () => {
    if (!quickNote.trim()) return

    try {
      // Add as first incomplete task
      const tasks = project.metadata?.tasks || []
      const newTask = {
        id: crypto.randomUUID(),
        text: quickNote.trim(),
        done: false,
        created_at: new Date().toISOString(),
        order: tasks.length
      }

      await updateProject(project.id, {
        metadata: {
          ...project.metadata,
          tasks: [...tasks, newTask]
        }
      })
      addToast({
        title: 'Updated!',
        description: 'Task added to project',
        variant: 'success',
      })
      setShowQuickNote(false)
      setQuickNote('')
      haptic.success()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      })
    }
  }

  const handleCopyText = () => {
    const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
    const nextTask = tasks
      .sort((a, b) => a.order - b.order)
      .find(t => !t.done)
    const textToCopy = `${project.title}\n\n${project.description || ''}\n\nNext Step: ${nextTask?.text || 'Not set'}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      haptic.success()
      addToast({
        title: 'Copied!',
        description: 'Project details copied to clipboard',
        variant: 'success',
      })
    })
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: project.description || '',
        })
        haptic.success()
      } catch (error) {
        console.warn('Share cancelled or failed:', error)
      }
    } else {
      handleCopyText()
    }
  }

  const handleMarkComplete = async () => {
    try {
      await updateProject(project.id, {
        status: 'completed'
      })
      addToast({
        title: 'Completed!',
        description: 'Project marked as complete',
        variant: 'success',
      })
      haptic.success()
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      })
    }
  }

  const handleTogglePriority = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click

    try {
      await setPriority(project.id)
      haptic.success()
      addToast({
        title: project.is_priority ? 'Priority Removed' : 'Priority Set!',
        description: project.is_priority
          ? 'Project is no longer priority'
          : 'This project is now your priority',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to set priority',
        variant: 'destructive',
      })
    }
  }

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Add Quick Note',
      icon: <Pencil className="h-5 w-5" />,
      onClick: () => setShowQuickNote(true),
    },
    {
      label: 'Copy Details',
      icon: <Copy className="h-5 w-5" />,
      onClick: handleCopyText,
    },
    {
      label: 'Share',
      icon: <Share2 className="h-5 w-5" />,
      onClick: handleShare,
    },
    ...(project.status !== 'completed' ? [{
      label: 'Mark Complete',
      icon: <Archive className="h-5 w-5" />,
      onClick: handleMarkComplete,
    }] : []),
    ...(onDelete ? [{
      label: 'Delete',
      icon: <Trash2 className="h-5 w-5" />,
      onClick: () => onDelete(project.id),
      variant: 'destructive' as const,
    }] : []),
  ]

  const statusConfig: Record<string, { label: string; style: React.CSSProperties; bgStyle: React.CSSProperties }> = {
    upcoming: {
      label: 'Upcoming',
      style: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        color: '#fbbf24',
        borderColor: 'rgba(251, 191, 36, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.2)'
      }
    },
    active: {
      label: 'Active',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--premium-blue)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.2)'
      }
    },
    dormant: {
      label: 'Dormant',
      style: {
        backgroundColor: 'rgba(156, 163, 175, 0.2)',
        color: '#9ca3af',
        borderColor: 'rgba(156, 163, 175, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 0.2)'
      }
    },
    completed: {
      label: 'Completed',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--premium-blue)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.2)'
      }
    },
    archived: {
      label: 'Archived',
      style: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        color: 'var(--premium-indigo)',
        borderColor: 'rgba(139, 92, 246, 0.3)'
      },
      bgStyle: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderColor: 'rgba(139, 92, 246, 0.2)'
      }
    }
  }


  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        title={project.title}
      />

      {/* Quick Note Modal */}
      {showQuickNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowQuickNote(false)}
        >
          <div
            className="premium-card p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
              Quick Note for {project.title}
            </h3>
            <input
              type="text"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQuickNoteSubmit()
                }
              }}
              placeholder="What's the next step?"
              className="w-full px-4 py-3 rounded-lg border text-base"
              style={{
                backgroundColor: 'var(--premium-surface-elevated)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: 'var(--premium-text-primary)'
              }}
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                onClick={handleQuickNoteSubmit}
                className="flex-1 btn-ripple btn-ripple-blue"
                style={{
                  background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                  color: '#ffffff'
                }}
              >
                Save
              </Button>
              <Button
                onClick={() => setShowQuickNote(false)}
                variant="ghost"
                className="flex-1"
                style={{ color: 'var(--premium-text-secondary)' }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={exitX !== 0 ? { x: exitX, opacity: 0 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative"
        {...longPressHandlers}
      >
        {/* Note Indicator (Swipe Right) */}
        <motion.div
          style={{ opacity: noteIndicatorOpacity }}
          className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none z-10 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <Pencil className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <span className="text-xl font-bold" style={{ color: 'var(--premium-blue)' }}>ADD NOTE</span>
          </div>
        </motion.div>

        <motion.div
          style={{ backgroundColor }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
            mass: 0.5,
            opacity: { duration: 0.3 },
            scale: { duration: 0.3 }
          }}
          className="rounded-xl"
        >
          <Card
            className="group h-full flex flex-col cursor-pointer relative overflow-hidden"
            onClick={handleCardClick}
            style={{
              background: 'var(--premium-bg-2)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
            }}
          >

      {/* Compact View - Always shown now for cleaner UX */}
        <CardContent className="relative z-10 p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-base flex-1 min-w-0" style={{ color: 'var(--premium-text-primary)' }}>
              {project.title}
            </h3>
            {showActions && onDelete && (
              <div className="relative flex-shrink-0">
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDropdown(!showDropdown)
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--premium-text-tertiary)' }}
                  aria-label="Project actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDropdown(false)
                      }}
                    />

                    {/* Menu */}
                    <div
                      className="absolute right-0 top-full mt-1 z-50 rounded-lg border overflow-hidden"
                      style={{
                        backgroundColor: 'var(--premium-surface-2)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                        minWidth: '140px'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDropdown(false)
                          onClick?.(project.id)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/10"
                        style={{ color: 'var(--premium-text-primary)' }}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDropdown(false)
                          onDelete(project.id)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-red-500/20"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2 py-0.5 rounded text-xs font-medium border" style={{
              backgroundColor: statusConfig[project.status]?.style?.backgroundColor || 'rgba(156, 163, 175, 0.2)',
              color: statusConfig[project.status]?.style?.color || '#9ca3af',
              borderColor: statusConfig[project.status]?.style?.borderColor || 'rgba(156, 163, 175, 0.3)'
            }}>
              {statusConfig[project.status]?.label || project.status}
            </div>

            {project.is_priority && (
              <Star className="h-4 w-4" fill="var(--premium-amber)" style={{ color: 'var(--premium-amber)' }} />
            )}

            {/* Quick Complete Next Task Button */}
            {(() => {
              const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
              const nextTask = tasks.sort((a, b) => a.order - b.order).find(t => !t.done)
              return nextTask && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      const updatedTasks = tasks.map(t =>
                        t.id === nextTask.id ? { ...t, done: true } : t
                      ) as any
                      await updateProject(project.id, {
                        metadata: { ...project.metadata, tasks: updatedTasks } as any
                      })
                      addToast({
                        title: '✓ Task complete!',
                        description: nextTask.text,
                        variant: 'success',
                      })
                      haptic.success()
                    } catch (error) {
                      addToast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' })
                    }
                  }}
                  className="px-2 py-0.5 rounded text-xs font-medium border hover:bg-white/10 transition-all"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--premium-blue)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                  }}
                  title={`Complete: ${nextTask.text}`}
                >
                  ✓ Next
                </button>
              )
            })()}

            <span className="text-xs font-bold ml-auto" style={{ color: 'var(--premium-blue)' }}>
              {typeof project.metadata?.progress === 'number' ? `${project.metadata.progress}%` : '0%'}
            </span>
          </div>

          {/* Next Step - Prominent Display */}
          {(() => {
            const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
            const nextTask = tasks.sort((a, b) => a.order - b.order).find(t => !t.done)
            return nextTask && (
              <div
                className="mt-3 p-3 rounded-lg border-2"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderColor: 'rgba(59, 130, 246, 0.3)'
                }}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        const updatedTasks = tasks.map(t =>
                          t.id === nextTask.id ? { ...t, done: true } : t
                        ) as any
                        await updateProject(project.id, {
                          metadata: { ...project.metadata, tasks: updatedTasks } as any
                        })
                        addToast({
                          title: '✓ Task complete!',
                          description: nextTask.text,
                          variant: 'success',
                        })
                        haptic.success()
                      } catch (error) {
                        addToast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' })
                      }
                    }}
                    className="mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all hover:bg-blue-500/20"
                    style={{
                      borderColor: 'var(--premium-blue)',
                      color: 'var(--premium-blue)'
                    }}
                    title="Complete this task"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--premium-blue)' }}>
                      Next Step
                    </div>
                    <p className="text-sm leading-snug" style={{ color: 'var(--premium-text-primary)' }}>
                      {nextTask.text}
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}
        </CardContent>
      {/* Removed expanded view - navigate to detail page instead */}
      {false && (
        <>
          <CardHeader className="relative z-10 pb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <CardTitle className="text-2xl font-bold flex-1" style={{ color: 'var(--premium-text-primary)' }}>
                {project.title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <SuggestionBadge itemId={project.id} itemType="project" />
                {showActions && (
                  <Button
                    onClick={handleTogglePriority}
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 p-0 touch-manipulation"
                    style={{
                      color: project.is_priority ? 'var(--premium-amber)' : 'var(--premium-text-tertiary)'
                    }}
                    aria-label={project.is_priority ? "Remove priority" : "Set as priority"}
                    title={project.is_priority ? "Remove priority" : "Set as priority"}
                  >
                    <Star
                      className="h-5 w-5"
                      fill={project.is_priority ? 'currentColor' : 'none'}
                    />
                  </Button>
                )}
                {showActions && onDelete && (
                  <Button
                    onClick={() => onDelete(project.id)}
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 p-0 touch-manipulation"
                    style={{ color: 'var(--premium-text-tertiary)' }}
                    aria-label="Delete project"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
            {project.description && (
              <CardDescription className="line-clamp-3 text-base leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                {project.description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="relative z-10 flex-1 space-y-4">
        {/* Next Step - Prominent Display (first incomplete task) */}
        {(() => {
          const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
          const nextTask = tasks
            .sort((a, b) => a.order - b.order)
            .find(t => !t.done)
          return nextTask && (
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--premium-amber)' }}
              >
                Next Step
              </div>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--premium-text-primary)' }}>
                {nextTask.text}
              </p>
            </div>
          )
        })()}

        {/* Progress Bar - Optional */}
        {typeof project.metadata?.progress === 'number' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--premium-text-secondary)' }}>Progress</span>
              <span className="font-bold" style={{ color: 'var(--premium-blue)' }}>{project.metadata.progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${project.metadata.progress}%`,
                  background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-indigo))'
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
          <Clock className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
          <span title={new Date(project.last_active).toLocaleString()}>Last active <span className="font-semibold" style={{ color: 'var(--premium-text-primary)' }}>{relativeTime}</span></span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="px-4 py-2 rounded-xl border flex-1"
            style={statusConfig[project.status].bgStyle}
          >
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-md text-xs font-medium border"
                style={statusConfig[project.status].style}
              >
                {statusConfig[project.status].label}
              </div>
            </div>
          </div>

          {/* Connection Badge */}
          {connectionCount > 0 && (
            <div className="px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2 border" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--premium-blue)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}>
              <Link2 className="h-3.5 w-3.5" />
              <span className="font-bold">{connectionCount}</span>
            </div>
          )}
        </div>

        {project.metadata?.tags && project.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-md text-xs font-medium border"
                style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  color: 'var(--premium-indigo)',
                  borderColor: 'rgba(139, 92, 246, 0.3)'
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {project.metadata?.energy_level && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: 'var(--premium-amber)' }} />
            <span className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>Energy:</span>
            <span
              className="px-3 py-1 rounded-md text-xs font-medium border"
              style={
                project.metadata.energy_level === 'high'
                  ? {
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      borderColor: 'rgba(239, 68, 68, 0.3)'
                    }
                  : project.metadata.energy_level === 'low'
                    ? {
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--premium-blue)',
                        borderColor: 'rgba(59, 130, 246, 0.3)'
                      }
                    : {
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--premium-amber)',
                        borderColor: 'rgba(245, 158, 11, 0.3)'
                      }
              }
            >
              {project.metadata.energy_level}
            </span>
          </div>
        )}
          </CardContent>
        </>
      )}
    </Card>
        </motion.div>
      </motion.div>
    </>
  )
})

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}w ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}mo ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years}y ago`
  }
}
