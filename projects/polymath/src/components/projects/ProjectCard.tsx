/**
 * ProjectCard Component - Stunning Visual Design
 */

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Clock, Zap, Edit, Trash2, Link2, Pencil, Copy, Share2, Archive, Star, MoreVertical, Check } from 'lucide-react'
import type { ProjectCardProps } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { haptic } from '../../utils/haptics'
import { useLongPress } from '../../hooks/useLongPress'
import { ContextMenu, type ContextMenuItem } from '../ui/context-menu'
import { SuggestionBadge } from '../SuggestionBadge'
import { PinButton } from '../PinButton'
import { PinnedTaskList } from './PinnedTaskList'

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
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)

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

  const handleTogglePriority = async (e?: React.MouseEvent) => {
    e?.stopPropagation() // Prevent card click

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

  // Pinned Task Handlers
  const handlePinnedAddTask = React.useCallback(async (text: string) => {
    const tasks = (project.metadata?.tasks || []) as any[]
    const newTask = {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: tasks.length
    }
    const updatedTasks = [...tasks, newTask]
    
    try {
      await updateProject(project.id, {
        metadata: { ...project.metadata, tasks: updatedTasks }
      })
    } catch (error) {
      console.error('Failed to add task:', error)
    }
  }, [project, updateProject])

  const handlePinnedToggleTask = React.useCallback(async (taskId: string) => {
    const tasks = (project.metadata?.tasks || []) as any[]
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, done: !t.done } : t
    )
    const progress = Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0
    
    try {
      await updateProject(project.id, {
        metadata: { ...project.metadata, tasks: updatedTasks, progress }
      })
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }, [project, updateProject])

  const handlePinnedReorderTask = React.useCallback((draggedId: string, targetId: string) => {
    const allTasks = (project.metadata?.tasks || []) as any[]
    const sortedTasks = [...allTasks].sort((a, b) => a.order - b.order)

    const draggedIndex = sortedTasks.findIndex(t => t.id === draggedId)
    const targetIndex = sortedTasks.findIndex(t => t.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newTasks = [...sortedTasks]
    const [draggedTask] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    const reorderedTasks = newTasks.map((task, index) => ({
      ...task,
      order: index
    }))

    // Optimistic update
    updateProject(project.id, {
      metadata: { ...project.metadata, tasks: reorderedTasks }
    })
  }, [project, updateProject])

  const pinnedContent = React.useMemo(() => (
    <PinnedTaskList
      tasks={project.metadata?.tasks || []}
      onToggle={handlePinnedToggleTask}
      onAdd={handlePinnedAddTask}
      onReorder={handlePinnedReorderTask}
      draggedTaskId={draggedPinnedTaskId}
      onDragStart={setDraggedPinnedTaskId}
      onDragEnd={() => setDraggedPinnedTaskId(null)}
    />
  ), [project.metadata?.tasks, handlePinnedToggleTask, handlePinnedAddTask, handlePinnedReorderTask, draggedPinnedTaskId])

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
    {
      label: project.is_priority ? 'Priority Removed' : 'Set Priority',
      icon: <Star className="h-5 w-5" fill={project.is_priority ? 'currentColor' : 'none'} />,
      onClick: () => handleTogglePriority(),
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
        color: '#fbbf24'
      },
      bgStyle: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)'
      }
    },
    active: {
      label: 'Active',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--premium-blue)'
      },
      bgStyle: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }
    },
    dormant: {
      label: 'Dormant',
      style: {
        backgroundColor: 'rgba(156, 163, 175, 0.2)',
        color: '#9ca3af'
      },
      bgStyle: {
        backgroundColor: 'rgba(156, 163, 175, 0.1)'
      }
    },
    completed: {
      label: 'Completed',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--premium-blue)'
      },
      bgStyle: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }
    },
    archived: {
      label: 'Archived',
      style: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        color: 'var(--premium-indigo)'
      },
      bgStyle: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)'
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
              className="w-full px-4 py-3 rounded-lg text-base"
              style={{
                backgroundColor: 'var(--premium-surface-elevated)',
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

        <div
          className="rounded-xl"
          style={{ backgroundColor: 'var(--premium-bg-2)' }}
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

            {/* Compact View - Simplified to match homepage design */}
            <CardContent className="relative z-10 p-4">
              {/* Title Row with Actions */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-lg flex-1 min-w-0" style={{ color: 'var(--premium-text-primary)' }}>
                  {project.title}
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {project.is_priority && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--premium-blue)'
                    }}>
                      ● Priority
                    </span>
                  )}
                  <PinButton
                    type="project"
                    id={project.id}
                    title={project.title}
                    content={pinnedContent}
                  />
                  {showActions && onDelete && (
                    <div className="relative">
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
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDropdown(false)
                            }}
                          />

                          <div
                            className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden"
                            style={{
                              backgroundColor: 'var(--premium-surface-2)',
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
                                handleTogglePriority(e)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/10"
                              style={{ color: project.is_priority ? 'var(--premium-amber)' : 'var(--premium-text-primary)' }}
                            >
                              <Star className="h-4 w-4" fill={project.is_priority ? 'currentColor' : 'none'} />
                              <span className="text-sm font-medium">{project.is_priority ? 'Remove Priority' : 'Set Priority'}</span>
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
              </div>

              {/* Task Progress Section */}
              {(() => {
                const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
                const nextTask = tasks.sort((a, b) => a.order - b.order).find(t => !t.done)
                const completedCount = tasks.filter(t => t.done).length
                const totalCount = tasks.length
                const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

                return (
                  <div className="space-y-2">
                    {/* Next Task */}
                    {nextTask && (
                      <div className="rounded-lg p-2.5 flex items-center justify-between gap-2"
                        style={{
                          background: 'var(--premium-bg-3)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start gap-2.5 flex-1">
                          <button
                            onClick={async (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const updatedTasks = tasks.map(t =>
                                t.id === nextTask.id ? { ...t, done: true } : t
                              ) as any
                              try {
                                await updateProject(project.id, {
                                  metadata: { ...project.metadata, tasks: updatedTasks } as any
                                })
                                addToast({ title: 'Task complete!', description: nextTask.text, variant: 'success' })
                                haptic.success()
                              } catch (error) {
                                console.error('Failed to complete task:', error)
                                addToast({ title: 'Failed to complete task', variant: 'destructive' })
                              }
                            }}
                            className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all hover:bg-blue-500/20"
                            style={{
                              color: 'rgba(59, 130, 246, 0.9)',
                              border: '1.5px solid rgba(255, 255, 255, 0.3)'
                            }}
                            title="Complete this task"
                          />

                          <p className="text-sm flex-1 min-w-0" style={{ color: 'var(--premium-text-primary)' }}>
                            {nextTask.text}
                          </p>
                        </div>
                        <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--premium-blue)' }}>
                          {completedCount}/{totalCount}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar & Meta */}
                    {totalCount > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progress}%`,
                              background: progress === 100
                                ? 'var(--premium-emerald)'
                                : 'var(--premium-blue)'
                            }}
                          />
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--premium-text-tertiary)' }}>
                          {relativeTime}
                        </span>
                      </div>
                    )}

                    {/* Empty state - no tasks */}
                    {totalCount === 0 && (
                      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--premium-text-tertiary)' }}>
                        <span>No tasks yet</span>
                        <span>{relativeTime}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </div>
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