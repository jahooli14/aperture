/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, MoreVertical, Plus, Target, Check, X, GripVertical, ChevronDown, Sparkles } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
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
import { handleInputFocus } from '../utils/keyboard'
import type { Project } from '../types'

import { PremiumTabs } from '../components/ui/premium-tabs'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { SynthesisDialog } from '../components/ghostwriter/SynthesisDialog'
import { DraftViewer } from '../components/ghostwriter/DraftViewer'
import { useGhostwriterStore } from '../stores/useGhostwriterStore'

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
  const { setContext, clearContext } = useContextEngineStore()

  const [project, setProject] = useState<Project | null>(null)
  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateConnection, setShowCreateConnection] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  // Ghostwriter State
  const { generateDraft, draft, isSynthesizing, saveDraft, clearDraft } = useGhostwriterStore()
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false)
  const [showDraftViewer, setShowDraftViewer] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

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
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const pinnedTaskInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadProjectDetails()
    return () => clearContext()
  }, [id])

  useEffect(() => {
    if (project) {
      setContext('project', project.id, project.title, `${project.title}\n\n${project.description || ''}`)
    }
  }, [project])

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

  const handleSynthesize = async (format: 'brief' | 'blog' | 'outline') => {
    setShowSynthesisDialog(false)
    if (!project) return

    // Get all connection IDs (mock logic for now, ideally pass real IDs)
    const contextIds = ['mock-id-1', 'mock-id-2']

    await generateDraft(project.id, contextIds, format)
    setShowDraftViewer(true)
  }

  const handleSaveDraft = async () => {
    if (!project || !draft) return

    setIsSavingDraft(true)
    try {
      // Extract title from draft (first line)
      const titleMatch = draft.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : 'Ghostwriter Draft'

      await saveDraft(project.id, draft, title)
      addToast({
        title: 'Draft saved',
        description: 'Saved to project notes',
        variant: 'success'
      })
      setShowDraftViewer(false)
      clearDraft()
      loadProjectDetails() // Refresh notes
    } catch (error) {
      addToast({
        title: 'Failed to save',
        variant: 'destructive'
      })
    } finally {
      setIsSavingDraft(false)
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
        {/* Active Tasks Only - Mobile Optimized */}
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
            Tasks ({tasks.filter(t => t.done).length}/{tasks.length})
          </h4>
          <div className="space-y-1.5 overflow-y-auto">
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
                  className="group w-full flex items-center gap-2 text-sm p-2 rounded-lg transition-colors text-left cursor-move"
                  style={{
                    opacity: draggedPinnedTaskId === task.id ? 0.5 : 1,
                    background: isNextTask ? 'var(--premium-bg-3)' : 'var(--premium-bg-2)'
                  }}
                >
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" style={{ color: 'var(--premium-text-tertiary)' }}>
                    <GripVertical className="h-3 w-3" />
                  </div>
                  <button
                    onClick={() => togglePinnedTask(task.id)}
                    className="flex items-center gap-2 flex-1"
                  >
                    <div
                      className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0 transition-all hover:bg-blue-500/20"
                      style={{
                        border: '1.5px solid rgba(255, 255, 255, 0.3)',
                        color: 'rgba(59, 130, 246, 0.9)'
                      }}
                    >
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
                onFocus={handleInputFocus}
                onKeyDown={(e) => {
                  console.log('[Pinned Input] onKeyDown:', e.key)
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addPinnedTask()
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 premium-glass"
                style={{
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
      <div className="premium-glass-strong sticky top-0 z-40">
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
                    className="flex-1 text-xl font-bold bg-transparent outline-none"
                    style={{
                      color: 'var(--premium-text-primary)'
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
                <div>
                  <h1
                    className="text-xl font-bold truncate cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--premium-text-primary)' }}
                    onClick={startEditTitle}
                    title="Click to edit"
                  >
                    {project.title}
                  </h1>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Ghostwriter Button - Prominent */}
              <button
                onClick={() => setShowSynthesisDialog(true)}
                className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.2))',
                  backdropFilter: 'blur(12px)',
                  color: '#d8b4fe',
                  border: '1px solid rgba(168, 85, 247, 0.4)'
                }}
                title="Generate draft with Ghostwriter"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ghostwriter</span>
              </button>

              {/* Status Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: 'var(--premium-bg-3)',
                    backdropFilter: 'blur(12px)',
                    color: 'var(--premium-blue)',
                    border: '1px solid var(--premium-blue)'
                  }}
                  title="Change project status"
                >
                  <span>
                    {{ active: 'Active', upcoming: 'Next', dormant: 'Dormant', completed: 'Done', 'on-hold': 'On Hold', maintaining: 'Maintaining', archived: 'Archived', abandoned: 'Abandoned' }[project.status]}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showStatusMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowStatusMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 rounded-lg py-1 z-20 shadow-lg"
                      style={{
                        background: 'rgba(15, 24, 41, 0.9)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {['upcoming', 'active', 'dormant', 'completed'].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            handleStatusChange(status as Project['status'])
                            setShowStatusMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-xs font-medium transition-colors hover:opacity-80"
                          style={{
                            color: project.status === status ? 'var(--premium-blue)' : 'var(--premium-text-secondary)',
                            backgroundColor: project.status === status ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                          }}
                        >
                          {{ active: 'Active', upcoming: 'Next', dormant: 'Dormant', completed: 'Done', 'on-hold': 'On Hold', maintaining: 'Maintaining', archived: 'Archived', abandoned: 'Abandoned' }[status]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

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

          {/* Tabs */}
          <PremiumTabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'brain', label: 'Brain' },
              { id: 'activity', label: 'Activity' }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'overview' && (
          <>
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
                    className="w-full bg-transparent rounded-lg p-2 outline-none resize-none"
                    style={{
                      color: 'var(--premium-text-primary)'
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

            {/* Motivation - The "So What" */}
            {project.metadata?.motivation && (
              <div className="premium-card p-4 border-l-4 border-blue-500">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--premium-blue)' }}>
                  Motivation
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-primary)' }}>
                  {project.metadata.motivation}
                </p>
              </div>
            )}

            {/* AI Strategy - The "So What" */}
            <div className="premium-card p-6 relative overflow-hidden">
              <div className="flex items-start gap-4 relative z-10">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <Target className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">AI Strategic Analysis</h3>
                  <p className="text-purple-200/80 text-sm leading-relaxed mb-3">
                    Based on your recent thoughts about <span className="text-white font-medium">{project.title}</span>, this project is high impact.
                  </p>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                      High Momentum
                    </div>
                    <div className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                      Strong Alignment
                    </div>
                  </div>
                </div>
              </div>
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            </div>

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
          </>
        )}

        {activeTab === 'brain' && (
          <div className="premium-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                Knowledge Graph
              </h3>
              <button
                onClick={() => setShowSynthesisDialog(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(139, 92, 246, 0.1))',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  color: '#d8b4fe'
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Synthesize
              </button>
            </div>
            <ConnectionsList
              itemType="project"
              itemId={project.id}
              content={`${project.title}\n${project.description || ''}`}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <ProjectActivityStream
            notes={notes}
            onRefresh={loadProjectDetails}
          />
        )}
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

      {/* Ghostwriter Dialogs */}
      <SynthesisDialog
        open={showSynthesisDialog}
        onOpenChange={setShowSynthesisDialog}
        onSynthesize={handleSynthesize}
        contextCount={5} // Mock count for now
      />

      {draft && (
        <DraftViewer
          open={showDraftViewer}
          onOpenChange={(open) => {
            setShowDraftViewer(open)
            if (!open) clearDraft()
          }}
          draft={draft}
          onSave={handleSaveDraft}
          isSaving={isSavingDraft}
        />
      )}

      {/* Loading Overlay for Synthesis */}
      {isSynthesizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="premium-card p-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse" />
              <Sparkles className="h-12 w-12 text-purple-400 animate-spin-slow relative z-10" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">Ghostwriter is thinking...</h3>
              <p className="text-sm text-slate-400">Connecting dots and drafting content</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog}

      {/* Connection Suggestions - Floating */}
      {
        suggestions.length > 0 && (
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
        )
      }
    </div >
  )
}

// Default export for lazy loading
export default ProjectDetailPage
