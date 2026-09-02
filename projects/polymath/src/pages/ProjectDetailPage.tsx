/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, MoreVertical, Check, X, GripVertical, Zap, Target, Star, Sprout, Pin, PinOff, Skull, ArrowLeft } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSessionStore } from '../stores/useSessionStore'
import { SessionContract } from '../components/session/SessionContract'
import { ProjectNotes } from '../components/projects/ProjectNotes'
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
import type { Project, Memory } from '../types'
import { supabase } from '../lib/supabase'
import { fetchWithTimeout } from '../lib/network'
import { useMemoryStore } from '../stores/useMemoryStore'
import { usePin } from '../contexts/PinContext'

import { useContextEngineStore } from '../stores/useContextEngineStore'
import { SubtleBackground } from '../components/SubtleBackground'
import { api } from '../lib/apiClient'

function BlockerField({ blocker, onSave }: { blocker?: string; onSave: (text: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(blocker ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(text) } finally { setSaving(false); setEditing(false) }
  }

  // Post-it: shared styling lives in design-tokens.css (.post-it).
  return (
    <div className="post-it">
      <span
        className="block mb-2 italic text-xs"
        style={{
          fontFamily: 'var(--brand-font-body)',
          color: 'rgba(252,211,77,0.75)',
          letterSpacing: '0.02em',
        }}
      >
        what's pausing this?
      </span>
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="One sentence."
            className="w-full bg-black/20 rounded-xl p-3 resize-none focus:outline-none border text-base"
            style={{
              fontFamily: 'var(--brand-font-body)',
              lineHeight: 1.55,
              color: 'var(--brand-text-primary)',
              borderColor: 'rgba(252,211,77,0.18)',
            }}
            rows={2}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
              if (e.key === 'Escape') { setText(blocker ?? ''); setEditing(false) }
            }}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setText(blocker ?? ''); setEditing(false) }}
              className="px-3 py-1.5 text-[11px] rounded-full hover:bg-white/[0.05] transition-colors italic"
              style={{ fontFamily: 'var(--brand-font-body)', color: 'var(--brand-text-secondary)', opacity: 0.6 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-1.5 text-[11px] font-medium rounded-full transition-all"
              style={{ background: 'rgba(252,211,77,0.16)', color: 'rgba(252,211,77,0.95)', border: '1px solid rgba(252,211,77,0.3)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p
          className="cursor-pointer hover:opacity-95 transition-opacity text-base"
          style={{
            fontFamily: 'var(--brand-font-body)',
            fontStyle: blocker ? 'normal' : 'italic',
            lineHeight: 1.55,
            color: 'var(--brand-text-primary)',
            opacity: blocker ? 0.92 : 0.45,
          }}
          onClick={() => setEditing(true)}
        >
          {blocker || 'Tap if something paused this.'}
        </p>
      )}
    </div>
  )
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { projects, fetchProjects, deleteProject, updateProject, syncProject, setPriority } = useProjectStore()
  // A session started elsewhere (Focus chat, KeepGoingCard) and still
  // sitting in its pre-task overview phase, for this exact project. When
  // this is true, FocusSession's floating sheet renders nothing (see
  // isOnThisProjectsPage there) so the pending session shows inline here
  // instead — same state, one place it's presented.
  const windowMinutes = useSessionStore(s => s.windowMinutes)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [replanning, setReplanning] = useState(false)

  // A spine gets used up: tick everything off and the project has a goal,
  // a history, and nothing to do next. Re-planning is the same backwards
  // pass that built it, run again over everything learned since — and it
  // keeps finished work, so it extends the plan rather than resetting it.
  const handleReplan = async () => {
    if (!project) return
    setReplanning(true)
    try {
      const result = await api.post('utilities?resource=replan', { project_id: project.id }) as { added?: number }
      await fetchProjects()
      addToast({
        title: result?.added ? `Planned ${result.added} more steps` : 'Nothing new to add',
        description: result?.added
          ? 'Working back from your finish line.'
          : "Say more about where it's at and try again.",
        variant: result?.added ? 'success' : 'default',
      })
    } catch (err) {
      addToast({
        title: "Couldn't re-plan that",
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setReplanning(false)
    }
  }
  const { setContext, clearContext } = useContextEngineStore()
  const { pinnedItem, pinItem, unpinItem } = usePin()

  // Reactive selection from store
  const project = useProjectStore(state => state.allProjects.find(p => p.id === id))

  const [projectMemories, setProjectMemories] = useState<Memory[]>([])
  const [sparkedByMemories, setSparkedByMemories] = useState<Memory[]>([])

  // Local-first: Only show blocking loader if we don't have the project in cache/store
  const [loading, setLoading] = useState(!project)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateConnection, setShowCreateConnection] = useState(false)

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showRetroRitual, setShowRetroRitual] = useState(false)

  // Inline guide state
  const [recentCompletions, setRecentCompletions] = useState<{ id: string; text: string }[]>([])
  const prevTasksRef = useRef<{ id: string; done: boolean }[]>([])
  const seededPrevTasksRef = useRef(false)

  // When the Guide applies a change, scroll to and briefly flash the card
  // it changed — makes the link between the conversation and the artifact
  // visible instead of the change silently landing off-screen.
  const [flashTarget, setFlashTarget] = useState<'goal' | 'tasks' | 'note' | null>(null)
  const handleGuideApplied = useCallback((kind: 'goal' | 'tasks' | 'note') => {
    const selector = kind === 'goal' ? '[data-finish-line]' : kind === 'tasks' ? '[data-task-list]' : '[data-notes-section]'
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashTarget(kind)
    setTimeout(() => setFlashTarget(prev => (prev === kind ? null : prev)), 1600)
  }, [])

  // Listen for AI enrichment completion to refresh tasks
  useEffect(() => {
    const handleEnriched = (e: CustomEvent<{ projectId: string }>) => {
      if (e.detail.projectId === id) {
        console.log('[ProjectDetailPage] AI enrichment completed, refreshing...')
        loadProjectDetails()
        addToast({
          title: 'New task suggestions',
          description: 'Added below — accept or skip each one.',
          variant: 'default',
        })
      }
    }
    window.addEventListener('projectEnriched', handleEnriched as EventListener)
    return () => window.removeEventListener('projectEnriched', handleEnriched as EventListener)
  }, [id])
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [tempGoal, setTempGoal] = useState('')
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const goalInputRef = useRef<HTMLTextAreaElement>(null)
  const endGoalInputRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  // The project currently in view. A fetch for a previous project (after
  // navigating A->B) must not write its notes/memories onto B's page.
  const activeIdRef = useRef(id)

  useEffect(() => {
    activeIdRef.current = id
    loadProjectDetails()
    return () => clearContext()
  }, [id])

  useEffect(() => {
    if (project) {
      setContext('project', project.id, project.title, `${project.title}\n\n${project.description || ''}`)
      if (!seededPrevTasksRef.current) {
        const tasks = (project.metadata?.tasks as { id: string; done: boolean }[] | undefined) || []
        prevTasksRef.current = tasks.map(t => ({ id: t.id, done: !!t.done }))
        seededPrevTasksRef.current = true
      }
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
      const response = await fetchWithTimeout(`/api/projects?id=${id}`)

      if (!response.ok) {
        throw new Error('Failed to fetch project details')
      }

      const data = await response.json()

      if (data.project) {
        // Bail if the user navigated to a different project mid-flight — don't
        // paint this project's notes/memories onto the one now in view.
        if (activeIdRef.current !== id) return
        // Sync project to store - this will trigger a re-render because we're subscribed
        syncProject(data.project)

        // Fetch linked memories (Quick Notes)
        const { data: linkedMemories } = await supabase
          .from('memories')
          .select('*')
          .contains('source_reference', { id: id, type: 'project' })
          .order('created_at', { ascending: false })

        if (linkedMemories && activeIdRef.current === id) {
          setProjectMemories(linkedMemories)
        }
      }
    } catch (error) {
      console.warn('[ProjectDetail] Fetch failed:', error)

      // Only toast if we have cached data to show. Distinguish a real offline
      // state from a server / auth failure so the user isn't told they're
      // offline when they aren't.
      if (project) {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        addToast({
          title: offline ? 'Offline' : "Couldn't refresh",
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
          description: error instanceof Error ? error.message : 'Try again in a moment.',
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
        description: error instanceof Error ? error.message : 'Try again in a moment.',
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
          end_goal: tempGoal.trim(),
          end_goal_source: 'manual',
        }
      })
      addToast({
        title: 'Goal updated',
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to update goal',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const cancelEdit = () => {
    setEditingTitle(false)
    setEditingGoal(false)
  }

  const startEditGoal = () => {
    setTempGoal(project?.metadata?.end_goal || '')
    setEditingGoal(true)
    setTimeout(() => goalInputRef.current?.focus(), 0)
  }

  const addPinnedTask = useCallback(async (text: string) => {
    if (!project) return

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

    try {
      await updateProject(project.id, { metadata: newMetadata })
      await loadProjectDetails()
      addToast({
        title: 'Task added',
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
        title: 'Task updated',
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
        description: error instanceof Error ? error.message : 'Try again in a moment.',
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

  // The guide can drop a note into the project's content space. Append to the
  // existing doc (with a blank line) rather than overwrite, then persist.
  const handleChatAppendNote = async (text: string) => {
    const fresh = getFreshProject()
    if (!fresh) return
    const existing = (fresh.notes_doc || '').trim()
    const next = existing ? `${existing}\n\n${text.trim()}` : text.trim()
    await updateProject(fresh.id, { notes_doc: next })
  }

  // Read the freshest project from the store at call time. Using props here
  // means a rapid second click reads stale metadata (the React re-render lags
  // behind the optimistic store update) and the spread `...project.metadata`
  // clobbers the change from the first click.
  const getFreshProject = useCallback((): Project | undefined => {
    return useProjectStore.getState().allProjects.find(p => p.id === id)
  }, [id])

  const handleChatAddTask = async (taskData: {
    text: string
    task_type?: 'ignition' | 'core' | 'shutdown'
    estimated_minutes?: number
    reasoning?: string
  }) => {
    const fresh = getFreshProject()
    if (!fresh) return
    const now = new Date().toISOString()
    const existingTasks: Task[] = (fresh.metadata?.tasks as Task[] | undefined) || []
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
    await updateProject(fresh.id, {
      metadata: {
        ...fresh.metadata,
        tasks: updatedTasks,
        progress: Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0,
      },
      last_active: now,
      updated_at: now,
    })
    // debounced enrichment fires automatically via aiEnrichmentManager
  }

  const handleChatUpdateGoal = async (newGoal: string) => {
    const fresh = getFreshProject()
    if (!fresh) return
    await updateProject(fresh.id, {
      metadata: {
        ...fresh.metadata,
        end_goal: newGoal,
        end_goal_source: 'guide',
      },
    })
    addToast({
      title: 'Finish line updated',
      variant: 'success',
    })
  }

  const handleChatUpdateTasks = async (updatedTasks: Task[]) => {
    const fresh = getFreshProject()
    if (!fresh) return
    const now = new Date().toISOString()
    const newlyCompleted = updatedTasks.filter(
      t => t.done && !prevTasksRef.current.find(p => p.id === t.id && p.done)
    )
    if (newlyCompleted.length > 0) {
      setRecentCompletions(prev => [...prev, ...newlyCompleted.map(t => ({ id: t.id, text: t.text }))])
    }
    prevTasksRef.current = updatedTasks.map(t => ({ id: t.id, done: t.done }))
    await updateProject(fresh.id, {
      metadata: {
        ...fresh.metadata,
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
          <p className="text-[var(--brand-text-secondary)]" style={{ color: "var(--brand-text-secondary)" }}>Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-[var(--brand-text-primary)]" style={{ color: "var(--brand-text-primary)" }}>Project not found</h2>
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
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pb-4">
        <header className="page-masthead mb-6">
          <div className="page-masthead-text">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          </div>
          <div className="page-masthead-actions">
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="masthead-action press-spring"
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
                <div className="absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5 z-[60] bg-[#1a1a24] border border-white/[0.08] shadow-2xl">
                  <button
                    onClick={() => { setShowMenu(false); setShowEditDialog(true) }}
                    className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl min-h-[44px]"
                    style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      const isThisPinned = pinnedItem !== null && (pinnedItem.id === project.id || pinnedItem.id === id)
                      if (isThisPinned) { unpinItem() } else { pinItem({ type: 'project', id: project.id, title: project.title, content: pinnedContent }) }
                    }}
                    className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl flex items-center gap-2 min-h-[44px]"
                    style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                  >
                    {pinnedItem?.id === project.id ? <><PinOff className="h-4 w-4" /> Unpin</> : <><Pin className="h-4 w-4" /> Pin</>}
                  </button>
                  {project.status !== 'graveyard' && project.status !== 'completed' && (
                    <button
                      onClick={async () => {
                        setShowMenu(false)
                        const ok = await confirm({
                          title: `Send "${project.title}" to the graveyard?`,
                          description: 'Parks the project. It stops surfacing on Home but stays in the graveyard view — you can revive it later.',
                          confirmText: 'Send to graveyard',
                          cancelText: 'Cancel',
                          variant: 'destructive',
                        })
                        if (ok) handleStatusChange('graveyard')
                      }}
                      className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl flex items-center gap-2 min-h-[44px]"
                      style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                    >
                      <Skull className="h-4 w-4" /> Send to graveyard
                    </button>
                  )}
                  <button
                    onClick={() => { setShowMenu(false); handleDelete() }}
                    className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-red-500/10 rounded-xl text-red-400 min-h-[44px]"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </header>

        {/* Hidden PinButton to preserve useEffect content sync */}
        <div className="hidden">
          <PinButton type="project" id={project.id} title={project.title} currentId={id} contentVersion={tasks.length} content={pinnedContent} />
        </div>

        <LineageBreadcrumb project={project} />

        {/* Day One-style project hero — chapter-cover, not CRM record */}
        <h1 className="page-hero mb-4">{project.title}</h1>
        <div
          aria-hidden
          className="h-[2px] w-12 mb-6 rounded-full"
          style={{
            background: `linear-gradient(to right, rgb(var(--brand-primary-rgb)), rgba(var(--brand-primary-rgb), 0.15))`,
            boxShadow: `0 0 12px rgba(var(--brand-primary-rgb), 0.35)`,
          }}
        />

        {/* Meta row — status + type as inline chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8 relative">
          {project.is_priority && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ color: 'rgb(var(--brand-primary-rgb))', background: 'rgba(var(--brand-primary-rgb),0.08)' }}>
              <Star className="h-3 w-3 fill-current" /> Priority
            </span>
          )}
          {/* Read-only status chip. Transitions happen via explicit actions:
              "Mark Complete" below the task list, and "Send to graveyard" in
              the kebab menu. Dormant is set automatically by inactivity. */}
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  project.status === 'active' || project.status === 'completed'
                    ? 'rgb(var(--brand-primary-rgb))'
                    : 'rgba(255,255,255,0.25)',
              }}
            />
            <span
              className="text-[11px] font-semibold capitalize"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
            >
              {project.status}
            </span>
          </span>
          {project.type && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4, background: 'rgba(255,255,255,0.03)' }}>
              {project.type}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 sm:px-6 space-y-8">
              {/* Guide — primary surface. This is what a project's mid-life
                  view is for: keep the chat that scopes/frames/edits front
                  and center, not just at project creation. */}
              {project && (
                <InlineGuide
                  project={project}
                  recentCompletions={recentCompletions}
                  onAddTask={handleChatAddTask}
                  onUpdateTasks={handleChatUpdateTasks}
                  onUpdateGoal={handleChatUpdateGoal}
                  onAppendNote={handleChatAppendNote}
                  onApplied={handleGuideApplied}
                />
              )}

              {/* The one session engine, run in place. This page used to
                  show a "session ready" card belonging to the old Power
                  Hour overlay — a second session flow with its own plan,
                  its own timer and its own summary. There's one now: the
                  same contract the home runs, opened here so you can look
                  around the project first and then start without leaving. */}
              {sessionOpen ? (
                <SessionContract
                  project={project}
                  presetWindowMinutes={windowMinutes}
                  onDone={() => { setSessionOpen(false); void fetchProjects() }}
                  onFinish={() => handleStatusChange('completed')}
                />
              ) : (
                <button
                  onClick={() => { setSessionOpen(true) }}
                  className="w-full py-3 rounded-2xl text-[12px] font-semibold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                  style={{
                    background: 'rgba(var(--brand-primary-rgb),0.10)',
                    border: '1px solid rgba(var(--brand-primary-rgb),0.28)',
                    color: 'rgb(var(--brand-primary-rgb))',
                  }}
                >
                  <Zap className="h-3.5 w-3.5 fill-current" /> Start session
                </button>
              )}

              {/* Finish Line */}
              <div
                data-finish-line
                className="p-5 sm:p-6 rounded-2xl transition-all duration-700"
                style={{
                  background: flashTarget === 'goal' ? 'rgba(var(--brand-primary-rgb),0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${flashTarget === 'goal' ? 'rgba(var(--brand-primary-rgb),0.4)' : 'rgba(255,255,255,0.05)'}`,
                  boxShadow: flashTarget === 'goal' ? '0 0 24px rgba(var(--brand-primary-rgb),0.15)' : 'none',
                }}
              >
                <span className="text-[11px] font-medium tracking-wide mb-2 flex items-center gap-1.5 lowercase" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.5 }}>
                  <Target className="h-3 w-3" /> finish line
                  {project.metadata?.end_goal_source === 'guide' && (
                    <span style={{ opacity: 0.7 }}>· via guide</span>
                  )}
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
                        <button onClick={(e) => { e.stopPropagation(); saveGoal() }} className="px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all" style={{ background: 'rgba(var(--brand-primary-rgb),0.1)', color: 'rgb(var(--brand-primary-rgb))' }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[15px] sm:text-base font-medium leading-relaxed italic font-serif text-center" style={{ color: 'var(--brand-text-primary)', opacity: 0.6 }}>
                      {project.metadata?.end_goal || <span style={{ opacity: 0.4 }}>What does done look like?</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* "A new angle" — the Mode 2b reshape, generated nightly for dormant
                  projects from post-original signals. Only shows when there's a real
                  evolved framing AND the project hasn't been opened recently. */}
              {project.metadata?.evolved_description && project.status === 'dormant' && (
                <div className="p-4 sm:p-5 rounded-2xl" style={{ background: 'rgba(var(--brand-primary-rgb),0.04)', border: '1px solid rgba(var(--brand-primary-rgb),0.14)' }}>
                  <span className="text-[11px] font-medium tracking-wide block mb-2 lowercase" style={{ color: 'rgba(var(--brand-primary-rgb),0.7)' }}>
                    a new angle
                  </span>
                  <p className="text-[15px] leading-relaxed italic" style={{ color: 'var(--brand-text-primary)', fontFamily: 'var(--brand-font-body)' }}>
                    {project.metadata.evolved_description as string}
                  </p>
                  {project.heat_reason && (
                    <p className="mt-2 text-[12px] leading-relaxed" style={{ color: 'var(--brand-text-secondary)', opacity: 0.7 }}>
                      {project.heat_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Blocker field — always available on non-completed projects so the user
                  can capture WHY work paused at the moment it pauses. Powers Mode 2b reshape. */}
              {project.status !== 'completed' && project.status !== 'graveyard' && (
                <BlockerField
                  key={project.id}
                  blocker={project.metadata?.blocker as string | undefined}
                  onSave={async (text) => {
                    await updateProject(project.id, {
                      metadata: { ...project.metadata, blocker: text || undefined }
                    })
                  }}
                />
              )}

              {/* Sparked By */}
              {sparkedByMemories.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sprout className="h-3.5 w-3.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }} />
                    <span className="text-[11px] font-medium tracking-wide lowercase" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>sparked by</span>
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

              {/* The Path */}
              <div
                data-task-list
                className="rounded-2xl transition-shadow duration-700"
                style={{
                  boxShadow: flashTarget === 'tasks' ? '0 0 0 1px rgba(var(--brand-primary-rgb),0.4), 0 0 24px rgba(var(--brand-primary-rgb),0.15)' : 'none',
                }}
              >
                {/* All Tasks Complete Banner */}
                {tasks.length > 0 && tasks.every((t: any) => t.done) && (
                  <div className="mb-5 p-5 rounded-2xl text-center" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.12)' }}>
                    <p className="text-[15px] font-bold text-brand-primary mb-1">All tasks complete</p>
                    <p className="text-[13px] mb-4" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>Every task is done. Mark this project complete?</p>
                    <button
                      onClick={() => handleStatusChange('completed')}
                      className="px-5 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                      style={{ background: 'rgba(var(--brand-primary-rgb),0.1)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)', color: 'rgb(var(--brand-primary-rgb))' }}
                    >
                      Mark Complete
                    </button>
                  </div>
                )}

                {/* Offered when the plan is spent — every step ticked, or
                    there was never one. A project with a finish line and
                    nothing to do next is the state where people quietly
                    stop opening it. */}
                {(() => {
                  const allTasks = project.metadata?.tasks || []
                  const spent = allTasks.length === 0 || allTasks.every((t: any) => t?.done)
                  if (!spent || project.status === 'completed' || project.status === 'graveyard') return null
                  return (
                    <button
                      onClick={handleReplan}
                      disabled={replanning}
                      className="w-full py-3 rounded-2xl text-[12px] font-semibold uppercase tracking-widest transition-all active:scale-[0.99] disabled:opacity-50"
                      style={{
                        background: 'rgba(var(--brand-primary-rgb),0.10)',
                        border: '1px solid rgba(var(--brand-primary-rgb),0.28)',
                        color: 'rgb(var(--brand-primary-rgb))',
                      }}
                    >
                      {replanning
                        ? 'Working back from the finish line…'
                        : allTasks.length === 0 ? 'Plan the steps' : 'Plan what comes next'}
                    </button>
                  )
                })()}

                <ProjectPath
                  tasks={project.metadata?.tasks || []}
                  highlightedTasks={[]}
                  projectId={project.id}
                  onUpdate={async (tasks) => {
                    if (!project) return
                    const newlyCompleted = tasks.filter(t => t.done && !prevTasksRef.current.find(p => p.id === t.id && p.done))
                    if (newlyCompleted.length > 0) { setRecentCompletions(prev => [...prev, ...newlyCompleted.map(t => ({ id: t.id, text: t.text }))]) }
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

              {/* Notes — the project's freeform content space */}
              <div
                data-notes-section
                className="pb-32 pt-2 rounded-2xl transition-shadow duration-700"
                style={{
                  boxShadow: flashTarget === 'note' ? '0 0 0 1px rgba(var(--brand-primary-rgb),0.4), 0 0 24px rgba(var(--brand-primary-rgb),0.15)' : 'none',
                }}
              >
                <ProjectNotes projectId={project.id} notesDoc={project.notes_doc} />
              </div>
      </div>


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
