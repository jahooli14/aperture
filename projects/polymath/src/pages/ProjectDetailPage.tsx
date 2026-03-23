/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, MoreVertical, Plus, Check, X, GripVertical, ChevronDown, Zap, Target, Star, Sprout, Pin, PinOff } from 'lucide-react'
import { StudioTab } from '../components/projects/StudioTab'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { useProjectStore } from '../stores/useProjectStore'
import { NextActionCard } from '../components/projects/NextActionCard'
import { ProjectActivityStream } from '../components/projects/ProjectActivityStream'
import { AddNoteDialog } from '../components/projects/AddNoteDialog'
import { TaskList, type Task } from '../components/projects/TaskList'
import { PinnedTaskList } from '../components/projects/PinnedTaskList'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { PinButton } from '../components/PinButton'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { handleInputFocus } from '../utils/keyboard'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { ProjectCompletionModal } from '../components/projects/ProjectCompletionModal'
import { ProjectChatPanel } from '../components/projects/ProjectChatPanel'
import { MultiPerspectiveSuggestions } from '../components/suggestions/MultiPerspectiveSuggestions'
import type { Project, Memory } from '../types'
import { supabase } from '../lib/supabase'
import { useMemoryStore } from '../stores/useMemoryStore'
import { usePin } from '../contexts/PinContext'

import { useContextEngineStore } from '../stores/useContextEngineStore'
import { SubtleBackground } from '../components/SubtleBackground'

interface ProjectNote {
  id: string
  bullets: string[]
  created_at: string
  note_type?: 'voice' | 'text'
  image_urls?: string[]
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const powerHourTask = location.state?.powerHourTask

  const { projects, fetchProjects, deleteProject, updateProject, syncProject, setPriority } = useProjectStore()
  const { setContext, clearContext } = useContextEngineStore()
  const { pinnedItem, pinItem, unpinItem } = usePin()

  // Reactive selection from store
  const project = useProjectStore(state => state.allProjects.find(p => p.id === id))

  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [projectMemories, setProjectMemories] = useState<Memory[]>([])
  const [sparkedByMemories, setSparkedByMemories] = useState<Memory[]>([])

  // Local-first: Only show blocking loader if we don't have the project in cache/store
  const [loading, setLoading] = useState(!project)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateConnection, setShowCreateConnection] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'studio'>('overview')

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  // Chat panel state
  const [showChat, setShowChat] = useState(false)
  const [recentCompletions, setRecentCompletions] = useState<string[]>([])
  const prevTasksRef = useRef<{ id: string; done: boolean }[]>([])


  // Listen for custom event from FloatingNav to open AddNote dialog
  useEffect(() => {
    const handleOpenAddNote = () => {
      console.log('[ProjectDetailPage] Received openAddNote event')
      setShowAddNote(true)
    }
    window.addEventListener('openProjectAddNote', handleOpenAddNote)
    return () => window.removeEventListener('openProjectAddNote', handleOpenAddNote)
  }, [])

  // Listen for AI enrichment completion to refresh tasks
  useEffect(() => {
    const handleEnriched = (e: CustomEvent<{ projectId: string }>) => {
      if (e.detail.projectId === id) {
        console.log('[ProjectDetailPage] AI enrichment completed, refreshing...')
        loadProjectDetails()
        addToast({
          title: 'AI suggested new tasks',
          description: 'New task suggestions have been added',
          variant: 'default',
        })
      }
    }
    window.addEventListener('projectEnriched', handleEnriched as EventListener)
    return () => window.removeEventListener('projectEnriched', handleEnriched as EventListener)
  }, [id])
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [editingMotivation, setEditingMotivation] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [tempDescription, setTempDescription] = useState('')
  const [tempMotivation, setTempMotivation] = useState('')
  const [tempGoal, setTempGoal] = useState('')
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const motivationInputRef = useRef<HTMLTextAreaElement>(null)
  const goalInputRef = useRef<HTMLTextAreaElement>(null)
  const endGoalInputRef = useRef<HTMLTextAreaElement>(null)
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

  // Fetch memories that sparked this project (inspired_by connections)
  useEffect(() => {
    if (!id) return
    const loadSparkedBy = async () => {
      const { data: connections } = await supabase
        .from('connections')
        .select('source_id')
        .eq('target_type', 'project')
        .eq('target_id', id)
        .eq('connection_type', 'inspired_by')
        .eq('source_type', 'memory')

      if (!connections?.length) return

      const memoryIds = connections.map((c: any) => c.source_id)
      const { data: memories } = await supabase
        .from('memories')
        .select('id, title, body, created_at')
        .in('id', memoryIds)

      setSparkedByMemories((memories as Memory[]) || [])
    }
    loadSparkedBy().catch(console.warn)
  }, [id])

  const loadProjectDetails = async () => {
    if (!id) return

    // If we don't have the project yet, show blocking loader
    if (!project) {
      setLoading(true)
    } else {
      // If we have it, we're just checking for updates in background
      setIsUpdating(true)
    }

    try {
      // Fetch fresh data from API
      const response = await fetch(`/api/projects?id=${id}&include_notes=true`)

      if (!response.ok) {
        throw new Error('Failed to fetch project details')
      }

      const data = await response.json()

      if (data.project) {
        // Sync project to store - this will trigger a re-render because we're subscribed
        syncProject(data.project)
        if (data.notes) setNotes(data.notes)

        // Fetch linked memories (Quick Notes)
        const { data: linkedMemories } = await supabase
          .from('memories')
          .select('*')
          .contains('source_reference', { id: id, type: 'project' })
          .order('created_at', { ascending: false })

        if (linkedMemories) {
          setProjectMemories(linkedMemories)
        }
      }
    } catch (error) {
      console.warn('[ProjectDetail] Fetch failed:', error)

      // Only show "Offline" toast if we actually have data to show
      if (project) {
        addToast({
          title: 'Offline',
          description: 'Showing cached project content',
          variant: 'default',
        })
      }
    } finally {
      setLoading(false)
      setIsUpdating(false)
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
    setEditingTitle(false)

    try {
      await updateProject(project.id, { title: tempTitle.trim() })
      addToast({
        title: 'Title updated',
        variant: 'success',
      })
    } catch (error) {
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

    setEditingDescription(false)

    try {
      await updateProject(project.id, { description: tempDescription.trim() })
      addToast({
        title: 'Description updated',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to update description',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const saveMotivation = async () => {
    if (!project) {
      setEditingMotivation(false)
      return
    }

    setEditingMotivation(false)

    try {
      await updateProject(project.id, {
        metadata: {
          ...project.metadata,
          motivation: tempMotivation.trim()
        }
      })
      addToast({
        title: 'Purpose updated',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to update purpose',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const saveGoal = async () => {
    if (!project) {
      setEditingGoal(false)
      return
    }

    setEditingGoal(false)

    try {
      await updateProject(project.id, {
        metadata: {
          ...project.metadata,
          end_goal: tempGoal.trim()
        }
      })
      addToast({
        title: 'Goal updated',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to update goal',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const cancelEdit = () => {
    setEditingTitle(false)
    setEditingDescription(false)
    setEditingMotivation(false)
    setEditingGoal(false)
  }

  const startEditMotivation = () => {
    setTempMotivation(project?.metadata?.motivation || '')
    setEditingMotivation(true)
    setTimeout(() => motivationInputRef.current?.focus(), 0)
  }

  const startEditGoal = () => {
    setTempGoal(project?.metadata?.end_goal || '')
    setEditingGoal(true)
    setTimeout(() => goalInputRef.current?.focus(), 0)
  }

  const addPinnedTask = useCallback(async (text: string) => {
    console.log('[addPinnedTask] Called with text:', text)

    if (!project) {
      console.log('[addPinnedTask] No project')
      return
    }

    const tasks = (project.metadata?.tasks || []) as Task[]
    const newTask = {
      id: crypto.randomUUID(),
      text: text.trim(),
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
      addToast({
        title: 'Updated!',
        description: 'Task added to project',
        variant: 'success',
      })
    } catch (error) {
      console.error('[addPinnedTask] Failed to add task:', error)
      addToast({
        title: 'Failed to add task',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      })
    }
  }, [project, updateProject, loadProjectDetails, addToast])

  const togglePinnedTask = useCallback(async (taskId: string) => {
    if (!project) return

    const tasks = (project.metadata?.tasks || []) as Task[]
    const taskToToggle = tasks.find(t => t.id === taskId)
    if (!taskToToggle) return

    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, done: !t.done } : t
    )
    const newMetadata = {
      ...project.metadata,
      tasks: updatedTasks,
      progress: Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0
    }

    try {
      await updateProject(project.id, { metadata: newMetadata })
      await loadProjectDetails()
      addToast({
        title: 'Updated!',
        description: 'Task status updated',
        variant: 'success',
      })
    } catch (error) {
      console.error('Failed to update task:', error)
      addToast({
        title: 'Failed to update task',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      })
    }
  }, [project, updateProject, loadProjectDetails, addToast])

  const handlePinnedDragStart = useCallback((taskId: string) => {
    setDraggedPinnedTaskId(taskId)
  }, [])

  const handleReorder = useCallback((draggedId: string, targetId: string) => {
    if (!project) return

    const allTasks = (project.metadata?.tasks || []) as Task[]
    const sortedTasks = [...allTasks].sort((a, b) => a.order - b.order)

    const draggedIndex = sortedTasks.findIndex(t => t.id === draggedId)
    const targetIndex = sortedTasks.findIndex(t => t.id === targetId)

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

    // Store will handle update and notify subscribers
    updateProject(project.id, { metadata: newMetadata })
  }, [project, updateProject])

  const handlePinnedDragEnd = useCallback(() => {
    setDraggedPinnedTaskId(null)
  }, [])

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project) return

    try {
      await updateProject(project.id, { status: newStatus })
      if (newStatus === 'completed') {
        setShowCompletionModal(true)
      } else {
        addToast({
          title: 'Status updated',
          description: `Project is now ${newStatus}`,
          variant: 'success',
        })
      }
    } catch (error) {
      addToast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleCategoryChange = async (newCategory: string) => {
    if (!project) return

    try {
      await updateProject(project.id, { type: newCategory })
      addToast({ title: 'Category updated', variant: 'success' })
    } catch (error) {
      addToast({ title: 'Failed to update category', variant: 'destructive' })
    }
    setShowCategoryMenu(false)
  }

  const handleNoteAdded = (note: ProjectNote) => {
    setNotes([note, ...notes])
    setShowAddNote(false)
    loadProjectDetails() // Refresh to get updated last_active
  }

  const handleChatAddTask = async (taskData: {
    text: string
    task_type?: 'ignition' | 'core' | 'shutdown'
    estimated_minutes?: number
    reasoning?: string
  }) => {
    if (!project) return
    const now = new Date().toISOString()
    const existingTasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: taskData.text,
      done: false,
      created_at: now,
      order: existingTasks.length,
      is_ai_suggested: true,
      ai_reasoning: taskData.reasoning,
      task_type: taskData.task_type,
      estimated_minutes: taskData.estimated_minutes,
    }
    const updatedTasks = [...existingTasks, newTask]
    await updateProject(project.id, {
      metadata: {
        ...project.metadata,
        tasks: updatedTasks,
        progress: Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0,
      },
      last_active: now,
      updated_at: now,
    })
    // debounced enrichment fires automatically via aiEnrichmentManager
  }

  const handleChatUpdateTasks = async (updatedTasks: Task[]) => {
    if (!project) return
    const now = new Date().toISOString()
    const newlyCompleted = updatedTasks.filter(
      t => t.done && !prevTasksRef.current.find(p => p.id === t.id && p.done)
    )
    if (newlyCompleted.length > 0) {
      setRecentCompletions(prev => [...prev, ...newlyCompleted.map(t => t.text)])
    }
    prevTasksRef.current = updatedTasks.map(t => ({ id: t.id, done: t.done }))
    await updateProject(project.id, {
      metadata: {
        ...project.metadata,
        tasks: updatedTasks,
        progress: Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0,
      },
      last_active: now,
      updated_at: now,
    })
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
      <PinnedTaskList
        tasks={project.metadata?.tasks || []}
        onToggle={togglePinnedTask}
        onAdd={addPinnedTask}
        onReorder={handleReorder}
        draggedTaskId={draggedPinnedTaskId}
        onDragStart={handlePinnedDragStart}
        onDragEnd={handlePinnedDragEnd}
      />
    )
  }, [project?.metadata?.tasks, togglePinnedTask, addPinnedTask, handleReorder, draggedPinnedTaskId, handlePinnedDragStart, handlePinnedDragEnd])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--brand-primary)]" style={{ color: "var(--brand-primary)" }} />
          <p className="text-[var(--brand-text-secondary)]" style={{ color: "var(--brand-primary)" }}>Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-[var(--brand-text-primary)]" style={{ color: "var(--brand-primary)" }}>Project not found</h2>
          <Button onClick={() => navigate('/projects')} variant="outline">
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 relative" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <SubtleBackground />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-6 flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <button
              onClick={() => navigate('/projects')}
              className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity mb-2 flex items-center gap-1"
              style={{ color: 'var(--brand-primary)' }}
            >
              ← Projects
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-black uppercase tracking-widest text-brand-primary">
                Project Detail
              </span>
              {project.is_priority && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-500">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Priority
                </span>
              )}
            </div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-none">
              {project.title}
            </h1>
          </div>

          {/* Hidden PinButton to preserve useEffect content sync */}
          <div className="hidden">
            <PinButton
              type="project"
              id={project.id}
              title={project.title}
              currentId={id}
              contentVersion={tasks.length}
              content={pinnedContent}
            />
          </div>

          <div className="relative flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--glass-surface)] border border-white/10 transition-all"
              style={{ color: "var(--brand-primary)" }}
              aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl p-1 z-[60] premium-glass border border-white/10 shadow-2xl">
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowEditDialog(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/5 rounded-lg"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      const isThisPinned = pinnedItem !== null && (pinnedItem.id === project.id || pinnedItem.id === id)
                      if (isThisPinned) {
                        unpinItem()
                      } else {
                        pinItem({ type: 'project', id: project.id, title: project.title, content: pinnedContent })
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/5 rounded-lg flex items-center gap-2"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    {pinnedItem?.id === project.id ? (
                      <><PinOff className="h-3.5 w-3.5" /> Unpin</>
                    ) : (
                      <><Pin className="h-3.5 w-3.5" /> Pin to Compare</>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      handleDelete()
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-bold uppercase tracking-wide transition-colors hover:bg-red-500/10 rounded-lg text-red-400"
                  >
                    Delete Project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status & Meta Bar */}
        <div className="flex flex-wrap items-center gap-3 relative">
          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--glass-surface)] border border-white/5 transition-all hover:border-brand-primary/30"
            >
              <Target className="h-3.5 w-3.5 text-brand-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">{project.status}</span>
              <ChevronDown className="h-3 w-3 text-brand-primary opacity-60" />
            </button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl p-1 z-[60] premium-glass border border-white/10 shadow-2xl">
                  {(['active', 'next', 'dormant', 'completed', 'graveyard'] as Project['status'][]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setShowStatusMenu(false)
                        handleStatusChange(s)
                      }}
                      className={`w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${
                        project.status === s
                          ? 'bg-brand-primary/10 text-brand-primary'
                          : 'hover:bg-white/5 text-brand-text-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Type badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--glass-surface)] border border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">{project.type || 'Uncategorized'}</span>
          </div>
        </div>
      </div>

      {/* Content - All sections on one page */}
      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center gap-4 border-b border-[var(--glass-surface-hover)]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'overview' ? 'text-brand-primary' : 'text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]'
              }`}
          >
            Overview
            {activeTab === 'overview' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'studio' ? 'text-brand-primary' : 'text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]'
              }`}
          >
            The Studio
            {activeTab === 'studio' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"
              />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Power Hour Focus Mode */}
              {powerHourTask && (
                <div className="p-8 border-2 border-blue-500/50 relative overflow-hidden group mb-8 bg-brand-primary/20">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Zap className="h-48 w-48 text-brand-primary" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4 text-brand-primary font-black uppercase tracking-[0.2em] text-[10px]">
                      <Zap className="h-4 w-4 fill-current" />
                      Focus Session
                    </div>

                    <h2 className="text-3xl font-black text-[var(--brand-text-primary)] mb-3 uppercase italic tracking-tighter leading-none">
                      {powerHourTask.task_title}
                    </h2>

                    {powerHourTask.session_summary ? (
                      <p className="text-xl font-medium text-brand-primary/80 mb-6 max-w-2xl leading-relaxed italic font-serif">
                        "{powerHourTask.session_summary}"
                      </p>
                    ) : (
                      <p className="text-lg text-[var(--brand-text-secondary)] mb-6 max-w-2xl leading-relaxed">
                        {powerHourTask.task_description}
                      </p>
                    )}

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          const el = document.querySelector('[data-task-list]')
                          if (el) {
                            window.scrollTo({
                              top: el.getBoundingClientRect().top + window.scrollY - 120,
                              behavior: 'smooth'
                            })
                          }
                          addToast({ title: 'Focus on your hit-list below', variant: 'default' })
                        }}
                        className="px-6 py-3 bg-brand-primary hover:bg-brand-primary text-[var(--brand-text-primary)] font-black uppercase text-xs tracking-widest rounded-xl transition-all flex items-center gap-3 group/btn"
                      >
                        <Check className="h-4 w-4 group-hover/btn:scale-125 transition-transform" />
                        Execute Hit-List
                      </button>

                      <div className="text-[10px] font-black uppercase tracking-widest text-brand-primary/50">
                        60 Minutes Remaining
                      </div>
                    </div>
                  </div>

                  {/* Aesthetic Lines */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
                </div>
              )}

              <div className="space-y-6">
                {/* Sparked By: Origin thoughts that inspired this project */}
                {sparkedByMemories.length > 0 && (
                  <div className="p-4 rounded-xl border border-[var(--glass-surface)] bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                      <Sprout className="h-4 w-4" style={{ color: 'var(--brand-text-secondary)' }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--brand-text-secondary)' }}>Sparked by</span>
                    </div>
                    <div className="space-y-2">
                      {sparkedByMemories.map(m => (
                        <div key={m.id} className="p-3 rounded-lg bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)]">
                          <p className="text-sm italic leading-relaxed line-clamp-2" style={{ color: 'var(--brand-text-primary)' }}>
                            "{m.body || m.title}"
                          </p>
                          <p className="text-[10px] mt-1 opacity-50" style={{ color: 'var(--brand-primary)' }}>
                            {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* The Vision: Merges Description and Motivation */}
                {(project.description || project.metadata?.motivation) && (
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-[var(--glass-surface)] space-y-4">
                      <div className="flex items-center gap-3 mb-4 opacity-50">
                        <div className="h-px bg-white/20 flex-grow" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-text-primary)]/50">The Vision</span>
                        <div className="h-px bg-white/20 flex-grow" />
                      </div>

                      <div
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setTempDescription(project.description || '')
                          setEditingDescription(true)
                          setTimeout(() => descriptionInputRef.current?.focus(), 100)
                        }}
                      >
                        {editingDescription ? (
                          <textarea
                            ref={descriptionInputRef}
                            value={tempDescription}
                            onChange={(e) => setTempDescription(e.target.value)}
                            onBlur={saveDescription}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                saveDescription()
                              }
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="w-full bg-black/40 border-[var(--glass-surface-hover)] rounded-xl p-4 text-xl sm:text-2xl font-medium text-[var(--brand-text-primary)] leading-relaxed italic font-serif text-center outline-none focus:border-blue-500/50"
                            autoFocus
                          />
                        ) : (
                          <div className="text-xl sm:text-2xl font-medium text-[var(--brand-text-primary)]/90 italic font-serif text-center">
                            <MarkdownRenderer
                              content={project.description ? `"${project.description}"` : '"Add a vision for this project..."'}
                              className="text-center"
                            />
                          </div>
                        )}
                      </div>

                      {(project.metadata?.motivation || editingMotivation) && (
                        <div className="pt-6 relative">
                          <div
                            className="cursor-pointer hover:text-[var(--brand-text-primary)] transition-colors"
                            onClick={() => {
                              setTempMotivation(project.metadata?.motivation || '')
                              setEditingMotivation(true)
                              setTimeout(() => motivationInputRef.current?.focus(), 100)
                            }}
                          >
                            {editingMotivation ? (
                              <textarea
                                ref={motivationInputRef}
                                value={tempMotivation}
                                onChange={(e) => setTempMotivation(e.target.value)}
                                onBlur={saveMotivation}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    saveMotivation()
                                  }
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                className="w-full bg-black/40 border-[var(--glass-surface-hover)] rounded-xl p-3 text-sm text-[var(--brand-text-primary)] leading-relaxed max-w-2xl mx-auto block outline-none focus:border-blue-500/50 text-center"
                                autoFocus
                              />
                            ) : (
                               <MarkdownRenderer
                                 content={project.metadata?.motivation || 'What drives this project?'}
                                 className="text-sm text-[var(--brand-text-primary)]/50 font-serif italic text-center"
                               />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* The Finish Line (Definition of Done) */}
              <div className="grid gap-3 mt-6">
                <div
                  className="group relative p-6 cursor-pointer hover:bg-[var(--glass-surface)] transition-all rounded-xl border border-[var(--glass-surface)] hover:border-green-500/30 overflow-hidden"
                  onClick={!editingGoal ? startEditGoal : undefined}
                  title="Click to edit"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                    <div className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
                  </div>

                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-brand-text-secondary flex items-center gap-2">
                    The Finish Line
                  </h3>

                  {editingGoal ? (
                    <div className="space-y-4">
                      <textarea
                        ref={goalInputRef}
                        value={tempGoal}
                        onChange={(e) => setTempGoal(e.target.value)}
                        className="w-full bg-black/20 border border-[var(--glass-surface-hover)] rounded-lg p-3 text-base resize-none focus:outline-none focus:border-green-500/50 text-[var(--brand-text-primary)] leading-relaxed"
                        rows={3}
                        placeholder="What does 'done' look like?"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            saveGoal()
                          } else if (e.key === 'Escape') {
                            cancelEdit()
                          }
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                          className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-zinc-800 hover:bg-zinc-700 text-brand-text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); saveGoal() }}
                          className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-brand-primary/50 text-brand-text-secondary border border-green-500/20 hover:bg-brand-primary/80"
                        >
                          Set Target
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-lg text-[var(--brand-text-primary)]/90 font-medium leading-relaxed">
                      {project.metadata?.end_goal ? (
                        <MarkdownRenderer content={project.metadata.end_goal} />
                      ) : (
                        <span className="text-[var(--brand-text-primary)]/30 italic">Define the clear target for completion...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Checklist */}
              <div data-task-list className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 flex-grow opacity-50">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-text-primary)]/50">Execution Plan</span>
                    <div className="h-px bg-white/20 flex-grow" />
                  </div>
                </div>
                <TaskList
                  tasks={project.metadata?.tasks?.filter((task, index, self) =>
                    index === self.findIndex((t) => (
                      t.text.trim().toLowerCase() === task.text.trim().toLowerCase()
                    ))
                  ) || []}
                  highlightedTasks={location.state?.powerHourTasks || []}
                  projectId={project.id}
                  onUpdate={async (tasks) => {
                    if (!project) return
                    console.log('[ProjectDetail] Task update triggered')

                    // Track newly completed tasks so the chat panel can show them inline
                    const newlyCompleted = tasks.filter(
                      t => t.done && !prevTasksRef.current.find(p => p.id === t.id && p.done)
                    )
                    if (newlyCompleted.length > 0) {
                      setRecentCompletions(prev => [...prev, ...newlyCompleted.map(t => t.text)])
                    }
                    prevTasksRef.current = tasks.map(t => ({ id: t.id, done: t.done }))

                    const now = new Date().toISOString()
                    const newMetadata = {
                      ...project.metadata,
                      tasks: tasks,
                      progress: Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) || 0
                    }

                    try {
                      await updateProject(project.id, {
                        metadata: newMetadata,
                        last_active: now,
                        updated_at: now
                      })
                    } catch (error) {
                      console.error('[ProjectDetail] Update failed:', error)
                    }
                  }}
                />
              </div>

              {/* AI Perspectives - Multi-angle next step suggestions */}
              {project.status === 'active' && (
                <details className="mt-8 group" open>
                  <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 list-none select-none"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    <span className="flex-1">AI Perspectives</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4">
                    <MultiPerspectiveSuggestions
                      project={project}
                      onAddTodo={async (text) => {
                        const existing = project.metadata?.tasks || []
                        const newTask = {
                          id: crypto.randomUUID(),
                          text,
                          done: false,
                          created_at: new Date().toISOString(),
                          order: existing.length
                        }
                        try {
                          await updateProject(project.id, {
                            metadata: { ...project.metadata, tasks: [...existing, newTask] }
                          })
                        } catch (err) {
                          console.error('[ProjectDetail] Failed to add AI suggestion as task:', err)
                        }
                      }}
                    />
                  </div>
                </details>
              )}

              {/* Activity — decision log + completed tasks */}
              <div className="mt-12 pb-32">
                <div className="flex items-center justify-between mb-6">
                  <h3
                    className="text-[11px] font-black uppercase tracking-widest"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Log
                  </h3>
                  <button
                    onClick={() => setShowAddNote(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-colors active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Add Note
                  </button>
                </div>
                <ProjectActivityStream
                  notes={[
                    ...notes,
                    // Completed tasks appear as log entries
                    ...(project.metadata?.tasks || [])
                      .filter((t: Task) => t.done && t.completed_at)
                      .map((t: Task) => ({
                        id: `task-done-${t.id}`,
                        project_id: id || '',
                        user_id: '',
                        bullets: [`✓ ${t.text}`],
                        created_at: t.completed_at!,
                        note_type: 'task' as 'text' | 'voice',
                      }))
                  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())}
                  onRefresh={loadProjectDetails}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="studio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <StudioTab project={project} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Project Guide — Prominent floating bar */}
      <div className="fixed bottom-20 left-4 right-4 z-30 max-w-2xl mx-auto">
        <button
          onClick={() => setShowChat(true)}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all active:scale-[0.98] group"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.1) 100%)',
            border: '1.5px solid rgba(59,130,246,0.35)',
            boxShadow: '0 0 24px rgba(59,130,246,0.12), 0 4px 16px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
            style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            <Zap className="h-4.5 w-4.5" style={{ color: 'var(--brand-primary)' }} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-primary opacity-70">Your Project Guide</p>
            <p className="text-sm font-medium text-[var(--brand-text-primary)] opacity-80 truncate">Chat, plan, get unstuck…</p>
          </div>
          <div className="flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="var(--brand-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={showAddNote}
        onClose={() => setShowAddNote(false)}
        projectId={project.id}
        onNoteAdded={handleNoteAdded}
      />

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
      {/* Edit Project Dialog */}
      {project && (
        <EditProjectDialog
          project={project}
          isOpen={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Project Completion Modal */}
      {project && (
        <ProjectCompletionModal
          project={project}
          sparkedByMemories={sparkedByMemories}
          isOpen={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
        />
      )}

      {/* Project Chat Panel */}
      {project && (
        <ProjectChatPanel
          isOpen={showChat}
          onClose={() => {
            setShowChat(false)
            setRecentCompletions([])
          }}
          project={project}
          recentCompletions={recentCompletions}
          onAddTask={handleChatAddTask}
          onUpdateTasks={handleChatUpdateTasks}
          onRefinePlan={async () => {
            const token = (await supabase.auth.getSession()).data.session?.access_token
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/power-hour?projectId=${project.id}&enrich=true`, {
              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            })
            await loadProjectDetails()
          }}
        />
      )}
    </div>
  )
}

// Default export for lazy loading
export default ProjectDetailPage
