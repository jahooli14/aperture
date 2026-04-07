/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Loader2, MoreVertical, Plus, Check, X, GripVertical, ChevronDown, Zap, Target, Star, Sprout, Pin, PinOff } from 'lucide-react'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { useProjectStore } from '../stores/useProjectStore'
import { AddNoteDialog } from '../components/projects/AddNoteDialog'
import { ProjectPath } from '../components/projects/ProjectPath'
import type { Task } from '../components/projects/TaskList'
import { PinnedTaskList } from '../components/projects/PinnedTaskList'
import { InlineGuide } from '../components/projects/InlineGuide'
import { PinButton } from '../components/PinButton'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { handleInputFocus } from '../utils/keyboard'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { ProjectCompletionModal } from '../components/projects/ProjectCompletionModal'
import { CompletionRitual } from '../components/projects/CompletionRitual'
import { LineageBreadcrumb } from '../components/projects/LineageBreadcrumb'
import { ProjectLineage } from '../components/projects/ProjectLineage'
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

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showRetroRitual, setShowRetroRitual] = useState(false)

  // Inline guide state
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
  const [editingGoal, setEditingGoal] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [tempDescription, setTempDescription] = useState('')
  const [tempGoal, setTempGoal] = useState('')
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
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
    setEditingGoal(false)
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
        setShowRetroRitual(true)
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
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-8 pb-4">
        {/* Nav row */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/projects')}
            className="text-[13px] font-medium opacity-40 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            ← Back
          </button>
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-all hover:bg-white/[0.06]"
              style={{ color: 'var(--brand-text-secondary)' }}
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl p-1.5 z-[60] bg-[#1a1a24] border border-white/[0.08] shadow-2xl">
                  <button
                    onClick={() => { setShowMenu(false); setShowEditDialog(true) }}
                    className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl"
                    style={{ color: 'var(--brand-text-primary)', opacity: 0.7 }}
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      const isThisPinned = pinnedItem !== null && (pinnedItem.id === project.id || pinnedItem.id === id)
                      if (isThisPinned) { unpinItem() } else { pinItem({ type: 'project', id: project.id, title: project.title, content: pinnedContent }) }
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl flex items-center gap-2"
                    style={{ color: 'var(--brand-text-primary)', opacity: 0.7 }}
                  >
                    {pinnedItem?.id === project.id ? <><PinOff className="h-3.5 w-3.5" /> Unpin</> : <><Pin className="h-3.5 w-3.5" /> Pin</>}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); handleDelete() }}
                    className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-red-500/10 rounded-xl text-red-400/70"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hidden PinButton to preserve useEffect content sync */}
        <div className="hidden">
          <PinButton type="project" id={project.id} title={project.title} currentId={id} contentVersion={tasks.length} content={pinnedContent} />
        </div>

        <LineageBreadcrumb project={project} />

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-[var(--brand-text-primary)] leading-[0.95] mb-4">
          {project.title}
        </h1>

        {/* Meta row — status + type as inline chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8 relative">
          {project.is_priority && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-400" style={{ background: 'rgba(251,191,36,0.08)' }}>
              <Star className="h-3 w-3 fill-current" /> Priority
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all hover:bg-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.status === 'active' ? 'rgb(52,211,153)' : project.status === 'completed' ? 'rgb(59,130,246)' : 'rgba(255,255,255,0.25)' }} />
              <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>{project.status}</span>
              <ChevronDown className="h-2.5 w-2.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }} />
            </button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute left-0 top-full mt-1.5 w-40 rounded-2xl p-1.5 z-[60] bg-[#1a1a24] border border-white/[0.08] shadow-2xl">
                  {(['active', 'next', 'dormant', 'completed', 'graveyard'] as Project['status'][]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setShowStatusMenu(false); handleStatusChange(s) }}
                      className={`w-full px-3 py-2 text-left text-[12px] font-medium capitalize rounded-xl transition-colors ${
                        project.status === s ? 'bg-white/[0.06] text-[var(--brand-text-primary)]' : 'hover:bg-white/[0.04] text-[var(--brand-text-secondary)] opacity-60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {project.type && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4, background: 'rgba(255,255,255,0.03)' }}>
              {project.type}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 sm:px-6 space-y-8">
              {/* Power Hour Focus Mode */}
              {powerHourTask && (
                <div className="p-6 rounded-2xl relative overflow-hidden group" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-3.5 w-3.5 fill-current" style={{ color: 'rgb(59,130,246)' }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgb(59,130,246)', opacity: 0.7 }}>Focus Session</span>
                    </div>

                    <h2 className="text-xl font-bold text-[var(--brand-text-primary)] mb-2 leading-snug">
                      {powerHourTask.task_title}
                    </h2>

                    {powerHourTask.session_summary ? (
                      <p className="text-[15px] text-[var(--brand-text-secondary)] mb-5 leading-relaxed opacity-70">
                        {powerHourTask.session_summary}
                      </p>
                    ) : (
                      <p className="text-[15px] text-[var(--brand-text-secondary)] mb-5 leading-relaxed opacity-60">
                        {powerHourTask.task_description}
                      </p>
                    )}

                    <button
                      onClick={() => {
                        const el = document.querySelector('[data-task-list]')
                        if (el) { window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' }) }
                        addToast({ title: 'Focus on your hit-list below', variant: 'default' })
                      }}
                      className="px-5 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 flex items-center gap-2"
                      style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', color: 'rgb(59,130,246)' }}
                    >
                      <Check className="h-3.5 w-3.5" /> Start
                    </button>
                  </div>
                </div>
              )}

              {/* Sparked By */}
              {sparkedByMemories.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sprout className="h-3.5 w-3.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}>Sparked by</span>
                  </div>
                  <div className="space-y-2">
                    {sparkedByMemories.map(m => (
                      <div key={m.id} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <p className="text-[13px] italic leading-relaxed line-clamp-2" style={{ color: 'var(--brand-text-primary)', opacity: 0.6 }}>
                          "{m.body || m.title}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* About — description + finish line in one clean card */}
              <div className="p-5 sm:p-6 rounded-2xl space-y-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Description */}
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
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDescription() }
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="w-full bg-black/30 rounded-xl p-4 text-[17px] sm:text-lg font-medium text-[var(--brand-text-primary)] leading-relaxed italic font-serif text-center outline-none border border-white/[0.08] focus:border-white/[0.15]"
                      autoFocus
                    />
                  ) : (
                    <div className="text-[17px] sm:text-lg font-medium leading-relaxed italic font-serif text-center" style={{ color: 'var(--brand-text-primary)', opacity: 0.75 }}>
                      <MarkdownRenderer
                        content={project.description ? `"${project.description}"` : '"What is this project about?"'}
                        className="text-center"
                      />
                    </div>
                  )}
                </div>

                {/* Version history */}
                <ProjectLineage project={project} />

                {/* Finish Line */}
                <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider block mb-2 flex items-center gap-1.5" style={{ color: 'rgb(52,211,153)', opacity: 0.5 }}>
                    <Target className="h-3 w-3" /> Finish line
                  </span>
                  <div
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={!editingGoal ? startEditGoal : undefined}
                  >
                    {editingGoal ? (
                      <div className="space-y-3">
                        <textarea
                          ref={goalInputRef}
                          value={tempGoal}
                          onChange={(e) => setTempGoal(e.target.value)}
                          className="w-full bg-black/30 rounded-xl p-4 text-[15px] sm:text-base font-medium resize-none focus:outline-none text-[var(--brand-text-primary)] leading-relaxed italic font-serif text-center border border-white/[0.08] focus:border-white/[0.15]"
                          rows={3}
                          placeholder="What does done look like?"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveGoal() }
                            else if (e.key === 'Escape') { cancelEdit() }
                          }}
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); cancelEdit() }} className="px-3 py-1.5 text-[11px] font-medium rounded-lg hover:bg-white/[0.05] transition-colors" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>Cancel</button>
                          <button onClick={(e) => { e.stopPropagation(); saveGoal() }} className="px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all" style={{ background: 'rgba(52,211,153,0.1)', color: 'rgb(52,211,153)' }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[15px] sm:text-base font-medium leading-relaxed italic font-serif text-center" style={{ color: 'var(--brand-text-primary)', opacity: 0.6 }}>
                        {project.metadata?.end_goal || <span style={{ opacity: 0.4 }}>What does done look like?</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* The Path */}
              <div data-task-list>
                {/* All Tasks Complete Banner */}
                {tasks.length > 0 && tasks.every((t: any) => t.done) && (
                  <div className="mb-5 p-5 rounded-2xl text-center" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)' }}>
                    <p className="text-[15px] font-bold text-emerald-400 mb-1">All tasks complete</p>
                    <p className="text-[13px] mb-4" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>Every action item is done. Ready to wrap up?</p>
                    <button
                      onClick={() => handleStatusChange('completed')}
                      className="px-5 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                      style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgb(52,211,153)' }}
                    >
                      Mark Complete
                    </button>
                  </div>
                )}

                <ProjectPath
                  tasks={project.metadata?.tasks?.filter((task: any, index: number, self: any[]) =>
                    index === self.findIndex((t: any) => t.text.trim().toLowerCase() === task.text.trim().toLowerCase())
                  ) || []}
                  highlightedTasks={location.state?.powerHourTasks || []}
                  projectId={project.id}
                  onUpdate={async (tasks) => {
                    if (!project) return
                    const newlyCompleted = tasks.filter(t => t.done && !prevTasksRef.current.find(p => p.id === t.id && p.done))
                    if (newlyCompleted.length > 0) { setRecentCompletions(prev => [...prev, ...newlyCompleted.map(t => t.text)]) }
                    prevTasksRef.current = tasks.map(t => ({ id: t.id, done: t.done }))
                    const now = new Date().toISOString()
                    try {
                      await updateProject(project.id, {
                        metadata: { ...project.metadata, tasks, progress: Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) || 0 },
                        last_active: now, updated_at: now,
                      })
                    } catch (error) { console.error('[ProjectDetail] Update failed:', error) }
                  }}
                />
              </div>

              {/* Guide */}
              {project && (
                <InlineGuide
                  project={project}
                  recentCompletions={recentCompletions}
                  onAddTask={handleChatAddTask}
                  onUpdateTasks={handleChatUpdateTasks}
                />
              )}

              {/* Add Note */}
              <div className="pb-32">
                <button
                  onClick={() => setShowAddNote(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95 hover:bg-white/[0.04]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                >
                  <Plus className="h-3 w-3" /> Add Note
                </button>
              </div>
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

      {/* Retrospective Ritual — three questions, feeds new sparks */}
      {project && (
        <CompletionRitual
          project={project}
          isOpen={showRetroRitual}
          onClose={() => setShowRetroRitual(false)}
        />
      )}

    </div>
  )
}

// Default export for lazy loading
export default ProjectDetailPage
