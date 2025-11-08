/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, MoreVertical, Plus, Target, Check, X, GripVertical } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectProperties } from '../components/projects/ProjectProperties'
import { NextActionCard } from '../components/projects/NextActionCard'
import { ProjectActivityStream } from '../components/projects/ProjectActivityStream'
import { AddNoteDialog } from '../components/projects/AddNoteDialog'
import { TaskList, type Task } from '../components/projects/TaskList'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { CreateConnectionDialog } from '../components/connections/CreateConnectionDialog'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { PinButton } from '../components/PinButton'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import type { Project } from '../types'

interface ProjectNote {
  id: string
  bullets: string[]
  created_at: string
  note_type?: 'voice' | 'text'
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, fetchProjects, deleteProject, updateProject } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateConnection, setShowCreateConnection] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])

  // Listen for custom event from FloatingNav to open AddNote dialog
  useEffect(() => {
    const handleOpenAddNote = () => {
      console.log('[ProjectDetailPage] Received openAddNote event')
      setShowAddNote(true)
    }
    window.addEventListener('openProjectAddNote', handleOpenAddNote)
    return () => window.removeEventListener('openProjectAddNote', handleOpenAddNote)
  }, [])
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [tempDescription, setTempDescription] = useState('')
  const [newPinnedTaskText, setNewPinnedTaskText] = useState('')
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const pinnedTaskInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadProjectDetails()
  }, [id])

  // Fetch connection suggestions
  useEffect(() => {
    if (!id) return

    const fetchSuggestions = async () => {
      try {
        const response = await fetch(`/api/connections?action=suggestions&id=${id}&type=project`)
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (error) {
        console.error('[ProjectDetail] Failed to fetch suggestions:', error)
      }
    }

    fetchSuggestions()
  }, [id])

  const loadProjectDetails = async () => {
    if (!id) return

    setLoading(true)
    try {
      // Fetch projects if not already loaded
      if (projects.length === 0) {
        await fetchProjects()
      }

      // Find project in store
      const foundProject = projects.find(p => p.id === id)
      if (foundProject) {
        setProject(foundProject)
      }

      // Fetch project notes from API
      const response = await fetch(`/api/projects?id=${id}&include_notes=true`)

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setProject(data.project)
        setNotes(data.notes || [])
      } else {
        throw new Error(data.error || 'Failed to load project data')
      }
    } catch (error) {
      console.error('[ProjectDetail] Failed to load:', error)

      // Clear corrupted localStorage if repeated failures
      const failureKey = `project_load_failures_${id}`
      const failures = parseInt(localStorage.getItem(failureKey) || '0') + 1
      localStorage.setItem(failureKey, failures.toString())

      if (failures >= 3) {
        console.warn('[ProjectDetail] Multiple failures detected, clearing cache')
        localStorage.clear()
        addToast({
          title: 'Cache cleared',
          description: 'Please refresh the page to try again',
          variant: 'default',
        })
      } else {
        addToast({
          title: 'Failed to load project',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return

    const confirmed = await confirm({
      title: `Delete "${project.title}"?`,
      description: 'This action cannot be undone. The project and all its notes will be permanently removed.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    })

    if (confirmed) {
      try {
        await deleteProject(project.id)
        addToast({
          title: 'Project deleted',
          description: `"${project.title}" has been removed.`,
          variant: 'success',
        })
        navigate('/projects')
      } catch (error) {
        addToast({
          title: 'Failed to delete project',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    }
  }

  const startEditTitle = () => {
    setTempTitle(project?.title || '')
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  const startEditDescription = () => {
    setTempDescription(project?.description || '')
    setEditingDescription(true)
    setTimeout(() => descriptionInputRef.current?.select(), 0)
  }

  const saveTitle = async () => {
    if (!project || !tempTitle.trim()) {
      setEditingTitle(false)
      return
    }

    const oldTitle = project.title
    setProject({ ...project, title: tempTitle.trim() })
    setEditingTitle(false)

    try {
      await updateProject(project.id, { title: tempTitle.trim() })
      addToast({
        title: 'Title updated',
        variant: 'success',
      })
    } catch (error) {
      setProject({ ...project, title: oldTitle })
      addToast({
        title: 'Failed to update title',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const saveDescription = async () => {
    if (!project) {
      setEditingDescription(false)
      return
    }

    const oldDescription = project.description
    setProject({ ...project, description: tempDescription.trim() })
    setEditingDescription(false)

    try {
      await updateProject(project.id, { description: tempDescription.trim() })
      addToast({
        title: 'Description updated',
        variant: 'success',
      })
    } catch (error) {
      setProject({ ...project, description: oldDescription })
      addToast({
        title: 'Failed to update description',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const cancelEdit = () => {
    setEditingTitle(false)
    setEditingDescription(false)
  }

  const addPinnedTask = useCallback(async () => {
    console.log('[addPinnedTask] Called with text:', newPinnedTaskText)

    if (!project) {
      console.log('[addPinnedTask] No project')
      return
    }

    if (!newPinnedTaskText.trim()) {
      console.log('[addPinnedTask] Empty text')
      return
    }

    const tasks = (project.metadata?.tasks || []) as Task[]
    const newTask = {
      id: crypto.randomUUID(),
      text: newPinnedTaskText.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: tasks.length
    }
    const updatedTasks = [...tasks, newTask]
    const newMetadata = {
      ...project.metadata,
      tasks: updatedTasks
    }

    console.log('[addPinnedTask] Adding task:', newTask)

    try {
      await updateProject(project.id, { metadata: newMetadata })
      console.log('[addPinnedTask] Task saved to backend')
      await loadProjectDetails()
      console.log('[addPinnedTask] Project details reloaded')
      setNewPinnedTaskText('')
      console.log('[addPinnedTask] Input cleared')
      // Force a small delay to ensure state updates propagate
      setTimeout(() => {
        console.log('[addPinnedTask] Task added successfully - input should be clear now')
      }, 50)
    } catch (error) {
      console.error('[addPinnedTask] Failed to add task:', error)
      addToast({
        title: 'Failed to add task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }, [project, newPinnedTaskText, updateProject, loadProjectDetails, addToast])

  const togglePinnedTask = useCallback(async (taskId: string) => {
    if (!project) return

    const tasks = (project.metadata?.tasks || []) as Task[]
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, done: true } : t
    )
    const newMetadata = {
      ...project.metadata,
      tasks: updatedTasks,
      progress: Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0
    }

    try {
      await updateProject(project.id, { metadata: newMetadata })
      await loadProjectDetails()
    } catch (error) {
      console.error('Failed to update task:', error)
      addToast({
        title: 'Failed to update task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }, [project, updateProject, loadProjectDetails, addToast])

  const handlePinnedDragStart = useCallback((taskId: string) => {
    setDraggedPinnedTaskId(taskId)
  }, [])

  const handlePinnedDragOver = useCallback((e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    if (!draggedPinnedTaskId || !project || draggedPinnedTaskId === targetTaskId) return

    const allTasks = (project.metadata?.tasks || []) as Task[]
    const sortedTasks = [...allTasks].sort((a, b) => a.order - b.order)

    const draggedIndex = sortedTasks.findIndex(t => t.id === draggedPinnedTaskId)
    const targetIndex = sortedTasks.findIndex(t => t.id === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder tasks
    const newTasks = [...sortedTasks]
    const [draggedTask] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    // Update order property
    const reorderedTasks = newTasks.map((task, index) => ({
      ...task,
      order: index
    }))

    const newMetadata = {
      ...project.metadata,
      tasks: reorderedTasks
    }

    updateProject(project.id, { metadata: newMetadata })
    setProject({ ...project, metadata: newMetadata })
  }, [draggedPinnedTaskId, project, updateProject])

  const handlePinnedDragEnd = useCallback(() => {
    setDraggedPinnedTaskId(null)
  }, [])

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project) return

    // Optimistic update
    setProject({ ...project, status: newStatus })

    try {
      await updateProject(project.id, { status: newStatus })
      addToast({
        title: 'Status updated',
        description: `Project is now ${newStatus}`,
        variant: 'success',
      })
    } catch (error) {
      // Revert on failure
      setProject(project)
      addToast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleNoteAdded = (note: ProjectNote) => {
    setNotes([note, ...notes])
    setShowAddNote(false)
    loadProjectDetails() // Refresh to get updated last_active
  }

  // Calculate these before ANY early returns to avoid hooks order violation
  const progress = project?.metadata?.progress || 0
  const tasks = project?.metadata?.tasks || []
  const nextTask = tasks.find(t => !t.done)

  // Memoize pinned content to prevent unnecessary re-renders
  // MUST be called before ALL early returns (loading, !project, etc)
  const pinnedContent = useMemo(() => {
    if (!project) return null

    return (
    <div key={`pinned-${tasks.length}`} className="p-6 pb-32 space-y-6">
      {/* Status */}
      <div className="flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-lg border flex items-center gap-1.5" style={{
          backgroundColor: {
            active: 'rgba(59, 130, 246, 0.15)',
            upcoming: 'rgba(251, 191, 36, 0.15)',
            'on-hold': 'rgba(156, 163, 175, 0.15)',
            maintaining: 'rgba(59, 130, 246, 0.15)',
            completed: 'rgba(168, 85, 247, 0.15)',
            archived: 'rgba(156, 163, 175, 0.15)',
            abandoned: 'rgba(239, 68, 68, 0.15)'
          }[project.status],
          borderColor: {
            active: 'rgba(59, 130, 246, 0.3)',
            upcoming: 'rgba(251, 191, 36, 0.3)',
            'on-hold': 'rgba(156, 163, 175, 0.3)',
            maintaining: 'rgba(59, 130, 246, 0.3)',
            completed: 'rgba(168, 85, 247, 0.3)',
            archived: 'rgba(156, 163, 175, 0.3)',
            abandoned: 'rgba(239, 68, 68, 0.3)'
          }[project.status],
          color: {
            active: '#3b82f6',
            upcoming: '#fbbf24',
            'on-hold': '#9ca3af',
            maintaining: '#3b82f6',
            completed: '#a855f7',
            archived: '#9ca3af',
            abandoned: '#ef4444'
          }[project.status]
        }}>
          <span className="text-xs font-medium">
            {{ active: 'Active', upcoming: 'Upcoming', 'on-hold': 'On Hold', maintaining: 'Maintaining', completed: 'Completed', archived: 'Archived', abandoned: 'Abandoned' }[project.status]}
          </span>
        </div>
        {progress > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div className="h-full" style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-indigo))'
              }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--premium-blue)' }}>
              {progress}%
            </span>
          </div>
        )}
      </div>

      {/* Active Tasks Only - Mobile Optimized */}
      <div>
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
          Tasks ({tasks.filter(t => t.done).length}/{tasks.length})
        </h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {/* Incomplete tasks only */}
          {tasks.filter(t => !t.done).map((task, index) => {
            const isNextTask = index === 0
            return (
              <div
                key={task.id}
                draggable
                onDragStart={() => handlePinnedDragStart(task.id)}
                onDragOver={(e) => handlePinnedDragOver(e, task.id)}
                onDragEnd={handlePinnedDragEnd}
                className={`group w-full flex items-center gap-2 text-sm p-1.5 rounded transition-colors text-left cursor-move ${
                  isNextTask ? 'premium-glass-subtle' : 'hover:bg-white/5'
                }`}
                style={isNextTask ? {
                  borderColor: 'var(--premium-amber)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  opacity: draggedPinnedTaskId === task.id ? 0.5 : 1
                } : {
                  opacity: draggedPinnedTaskId === task.id ? 0.5 : 1
                }}
              >
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" style={{ color: 'var(--premium-text-tertiary)' }}>
                  <GripVertical className="h-3 w-3" />
                </div>
                <button
                  onClick={() => togglePinnedTask(task.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <div className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0" style={{
                    borderColor: isNextTask ? 'var(--premium-amber)' : 'rgba(255, 255, 255, 0.2)'
                  }}>
                  </div>
                  <span style={{
                    color: isNextTask ? 'var(--premium-text-primary)' : 'var(--premium-text-secondary)',
                    fontWeight: isNextTask ? 600 : 400
                  }}>
                    {task.text}
                  </span>
                </button>
              </div>
            )
          })}

          {/* Add task row with + button */}
          <div className="flex items-center gap-2 mt-2">
            <input
              ref={pinnedTaskInputRef}
              type="text"
              placeholder="Add a task..."
              value={newPinnedTaskText}
              onChange={(e) => {
                console.log('[Pinned Input] onChange:', e.target.value)
                setNewPinnedTaskText(e.target.value)
              }}
              onClick={(e) => {
                e.stopPropagation()
                pinnedTaskInputRef.current?.focus()
              }}
              onKeyDown={(e) => {
                console.log('[Pinned Input] onKeyDown:', e.key)
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPinnedTask()
                }
              }}
              className="flex-1 px-3 py-2 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 premium-glass"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: 'var(--premium-text-primary)'
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                console.log('[Add Button] Clicked')
                addPinnedTask()
              }}
              disabled={!newPinnedTaskText.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                color: 'white'
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
    )
  }, [tasks.length, project?.status, progress, togglePinnedTask, addPinnedTask, project, handlePinnedDragStart, handlePinnedDragOver, handlePinnedDragEnd, draggedPinnedTaskId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
          <p style={{ color: 'var(--premium-text-secondary)' }}>Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>Project not found</h2>
          <Button onClick={() => navigate('/projects')} variant="outline">
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
      {/* Sticky Header */}
      <div className="premium-glass-strong border-b sticky top-0 z-10" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/projects')}
              className="h-10 w-10 flex items-center justify-center rounded-full transition-colors touch-manipulation"
              style={{ color: 'var(--premium-text-secondary)' }}
              aria-label="Back to projects"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 text-xl font-bold bg-transparent border-b-2 outline-none"
                    style={{
                      color: 'var(--premium-text-primary)',
                      borderColor: 'var(--premium-blue)'
                    }}
                  />
                  <button onClick={saveTitle} className="p-1 rounded hover:bg-white/10">
                    <Check className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                  </button>
                  <button onClick={cancelEdit} className="p-1 rounded hover:bg-white/10">
                    <X className="h-5 w-5" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              ) : (
                <h1
                  className="text-xl font-bold truncate cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--premium-text-primary)' }}
                  onClick={startEditTitle}
                  title="Click to edit"
                >
                  {project.title}
                </h1>
              )}
              {progress > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden max-w-[200px]" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-indigo))'
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--premium-blue)' }}>
                    {progress}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Pin Button */}
              <PinButton
                type="project"
                id={project.id}
                title={project.title}
                currentId={id}
                contentVersion={tasks.length}
                content={pinnedContent}
              />

              <button
                onClick={() => setShowMenu(!showMenu)}
                className="h-10 w-10 flex items-center justify-center rounded-full transition-colors touch-manipulation"
                style={{ color: 'var(--premium-text-secondary)' }}
                aria-label="More options"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 premium-card rounded-lg shadow-lg py-1 z-20">
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        handleDelete()
                      }}
                      className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-red-50"
                      style={{ color: '#ef4444' }}
                    >
                      Delete Project
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Description */}
        <div className="premium-card p-4">
          {editingDescription ? (
            <div className="space-y-2">
              <textarea
                ref={descriptionInputRef}
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelEdit()
                }}
                rows={3}
                placeholder="Add a description..."
                className="w-full bg-transparent border-2 rounded-lg p-2 outline-none resize-none"
                style={{
                  color: 'var(--premium-text-primary)',
                  borderColor: 'var(--premium-blue)'
                }}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={cancelEdit} className="px-3 py-1.5 text-sm rounded hover:bg-white/10" style={{ color: 'var(--premium-text-secondary)' }}>
                  Cancel
                </button>
                <button onClick={saveDescription} className="px-3 py-1.5 text-sm rounded" style={{ backgroundColor: 'var(--premium-blue)', color: 'white' }}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className="cursor-pointer hover:opacity-70 transition-opacity min-h-[60px] flex items-center"
              onClick={startEditDescription}
              title="Click to edit"
            >
              {project.description ? (
                <p style={{ color: 'var(--premium-text-secondary)' }}>{project.description}</p>
              ) : (
                <p style={{ color: 'var(--premium-text-tertiary)' }} className="italic">Click to add a description...</p>
              )}
            </div>
          )}
        </div>

        {/* Properties */}
        <ProjectProperties
          project={project}
          onUpdate={(updates) => {
            setProject({ ...project, ...updates })
            updateProject(project.id, updates)
          }}
          onStatusChange={handleStatusChange}
        />

        {/* Task Checklist */}
        <div data-task-list>
          <TaskList
            tasks={project.metadata?.tasks || []}
            onUpdate={async (tasks) => {
              console.log('[ProjectDetail] Task update triggered, new tasks:', tasks.map(t => ({ text: t.text, done: t.done, order: t.order })))

              // Ensure metadata is properly structured
              const newMetadata = {
                ...project.metadata,
                tasks: tasks,
                progress: Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) || 0
              }

              const updated = {
                ...project,
                metadata: newMetadata,
                last_active: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              console.log('[ProjectDetail] Updated metadata:', JSON.stringify(newMetadata, null, 2))

              // Update local state
              setProject(updated)

              console.log('[ProjectDetail] Calling updateProject API...')
              try {
                await updateProject(project.id, {
                  metadata: newMetadata,
                  last_active: updated.last_active,
                  updated_at: updated.updated_at
                })
                console.log('[ProjectDetail] Update successful!')
                // Don't reload - local state is already correct and reloading causes stale data
              } catch (error) {
                console.error('[ProjectDetail] Update failed:', error)
                // Revert local state on error
                setProject(project)
              }
            }}
          />
        </div>

        {/* Connections - Unified section showing both manual and AI-suggested connections */}
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 premium-text-platinum">
              <Target className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
              Connections
            </h3>
            <button
              onClick={() => setShowCreateConnection(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-all hover:bg-white/5"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: 'var(--premium-blue)'
              }}
            >
              Link Item
            </button>
          </div>
          <ConnectionsList
            itemType="project"
            itemId={project.id}
            content={`${project.title}\n\n${project.description || ''}`}
            onConnectionDeleted={loadProjectDetails}
            onConnectionCreated={loadProjectDetails}
          />
        </div>

        {/* Activity Stream */}
        <ProjectActivityStream
          notes={notes}
          onRefresh={loadProjectDetails}
        />
      </div>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={showAddNote}
        onClose={() => setShowAddNote(false)}
        projectId={project.id}
        onNoteAdded={handleNoteAdded}
      />

      {/* Create Connection Dialog */}
      <CreateConnectionDialog
        open={showCreateConnection}
        onOpenChange={setShowCreateConnection}
        sourceType="project"
        sourceId={project.id}
        sourceContent={`${project.title}\n\n${project.description || ''}`}
        onConnectionCreated={loadProjectDetails}
      />

      {/* Confirmation Dialog */}
      {confirmDialog}

      {/* Connection Suggestions - Floating */}
      {suggestions.length > 0 && (
        <ConnectionSuggestion
          suggestions={suggestions}
          sourceId={project.id}
          sourceType="project"
          onLinkCreated={() => {
            loadProjectDetails()
            setSuggestions([]) // Clear suggestions after linking
          }}
          onDismiss={() => setSuggestions([])}
        />
      )}
    </div>
  )
}

// Default export for lazy loading
export default ProjectDetailPage
