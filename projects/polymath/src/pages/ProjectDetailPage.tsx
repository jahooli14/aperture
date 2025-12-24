/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, MoreVertical, Plus, Check, X, GripVertical, ChevronDown, Zap } from 'lucide-react'
import { StudioTab } from '../components/projects/StudioTab'
import { useProjectStore } from '../stores/useProjectStore'
import { NextActionCard } from '../components/projects/NextActionCard'
import { ProjectActivityStream } from '../components/projects/ProjectActivityStream'
import { AddNoteDialog } from '../components/projects/AddNoteDialog'
import { TaskList, type Task } from '../components/projects/TaskList'
import { PinnedTaskList } from '../components/projects/PinnedTaskList'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { CreateConnectionDialog } from '../components/connections/CreateConnectionDialog'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { PinButton } from '../components/PinButton'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { handleInputFocus } from '../utils/keyboard'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import type { Project, Memory } from '../types'
import { supabase } from '../lib/supabase'
import { useMemoryStore } from '../stores/useMemoryStore'

import { useContextEngineStore } from '../stores/useContextEngineStore'

interface ProjectNote {
  id: string
  bullets: string[]
  created_at: string
  note_type?: 'voice' | 'text'
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const powerHourTask = location.state?.powerHourTask

  const { projects, fetchProjects, deleteProject, updateProject, syncProject } = useProjectStore()
  const { setContext, clearContext } = useContextEngineStore()

  // Reactive selection from store
  const project = useProjectStore(state => state.allProjects.find(p => p.id === id))

  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [projectMemories, setProjectMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateConnection, setShowCreateConnection] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'studio'>('overview')
  const [showEditDialog, setShowEditDialog] = useState(false)


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
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
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

    // If we don't have the project yet, show loading
    if (!project) setLoading(true)

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

      if (!project) {
        addToast({
          title: 'Offline',
          description: 'Showing cached project content',
          variant: 'default',
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

    const oldDescription = project.description
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

  const cancelEdit = () => {
    setEditingTitle(false)
    setEditingDescription(false)
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
      addToast({
        title: 'Status updated',
        description: `Project is now ${newStatus}`,
        variant: 'success',
      })
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900" style={{ backgroundColor: 'var(--premium-surface-base, #111)' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" style={{ color: 'var(--premium-blue, #60a5fa)' }} />
          <p className="text-gray-400" style={{ color: 'var(--premium-text-secondary, #9ca3af)' }}>Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900" style={{ backgroundColor: 'var(--premium-surface-base, #111)' }}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-white" style={{ color: 'var(--premium-text-primary, #fff)' }}>Project not found</h2>
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
              {/* Category Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--premium-text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  title="Change project category"
                >
                  <span>{project.type || 'Uncategorized'}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showCategoryMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowCategoryMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 rounded-lg py-1 z-20 shadow-lg"
                      style={{
                        background: 'rgba(15, 24, 41, 0.9)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {['Tech', 'Art', 'Writing', 'Music', 'Business', 'Life'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleCategoryChange(cat)}
                          className="w-full px-4 py-2 text-left text-xs font-medium transition-colors hover:opacity-80"
                          style={{
                            color: project.type === cat ? 'var(--premium-blue)' : 'var(--premium-text-secondary)',
                            backgroundColor: project.type === cat ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Status Toggle (Complete/Active only) */}
              <button
                onClick={() => handleStatusChange(project.status === 'completed' ? 'active' : 'completed')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all hover:opacity-80 ${project.status === 'completed'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                  }`}
                style={{ border: '1px solid' }}
                title={project.status === 'completed' ? 'Mark as Active' : 'Mark as Completed'}
              >
                {project.status === 'completed' ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Done</span>
                  </>
                ) : (
                  <span>Mark Done</span>
                )}
              </button>

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
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowEditDialog(true)
                      }}
                      className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/10"
                      style={{ color: 'var(--premium-text-primary)' }}
                    >
                      Edit Project Details
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Content - All sections on one page */}
      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center gap-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'overview' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Overview
            {activeTab === 'overview' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'studio' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            The Studio
            {activeTab === 'studio' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400"
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
                <div className="premium-card p-8 border-2 border-blue-500/50 relative overflow-hidden group mb-8 bg-blue-900/20 backdrop-blur-xl">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Zap className="h-48 w-48 text-blue-400" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4 text-blue-400 font-black uppercase tracking-[0.2em] text-[10px]">
                      <Zap className="h-4 w-4 fill-current" />
                      Power Hour Session
                    </div>

                    <h2 className="text-3xl font-black text-white mb-3 uppercase italic tracking-tighter leading-none">
                      {powerHourTask.task_title}
                    </h2>

                    {powerHourTask.session_summary ? (
                      <p className="text-xl font-medium text-blue-100/80 mb-6 max-w-2xl leading-relaxed italic font-serif">
                        "{powerHourTask.session_summary}"
                      </p>
                    ) : (
                      <p className="text-lg text-slate-300 mb-6 max-w-2xl leading-relaxed">
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
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded transition-all flex items-center gap-3 group/btn"
                      >
                        <Check className="h-4 w-4 group-hover/btn:scale-125 transition-transform" />
                        Execute Hit-List
                      </button>

                      <div className="text-[10px] font-black uppercase tracking-widest text-blue-400/50">
                        60 Minutes Remaining
                      </div>
                    </div>
                  </div>

                  {/* Aesthetic Lines */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
                </div>
              )}

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
                      <p className="text-lg italic font-serif text-center leading-relaxed opacity-90" style={{ color: 'var(--premium-text-secondary)' }}>
                        "{project.description}"
                      </p>
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

              {/* Task Checklist */}
              <div data-task-list>
                <TaskList
                  tasks={project.metadata?.tasks || []}
                  highlightedTasks={location.state?.powerHourTasks || []}
                  onUpdate={async (tasks) => {
                    if (!project) return
                    console.log('[ProjectDetail] Task update triggered, new tasks:', tasks.map(t => ({ text: t.text, done: t.done, order: t.order })))

                    const now = new Date().toISOString()
                    const newMetadata = {
                      ...project.metadata,
                      tasks: tasks,
                      progress: Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) || 0
                    }

                    // Update store - this is the source of truth
                    // optimistic update is done inside store.updateProject
                    console.log('[ProjectDetail] Calling updateProject API...')
                    try {
                      await updateProject(project.id, {
                        metadata: newMetadata,
                        last_active: now,
                        updated_at: now
                      })
                      console.log('[ProjectDetail] Update successful!')
                    } catch (error) {
                      console.error('[ProjectDetail] Update failed:', error)
                    }
                  }}
                />
              </div>

              {/* Smart Connections Section */}
              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Synthesized Insights</h3>
                    <p className="text-xs text-zinc-500">Semantic bridges discovered by the Aperture Engine.</p>
                  </div>
                  <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[8px] font-black uppercase tracking-widest text-blue-400">
                    Neural Bridge
                  </div>
                </div>

                <ConnectionsList
                  itemType="project"
                  itemId={project.id}
                  content={`${project.title} ${project.description || ''} ${project.metadata?.motivation || ''}`}
                  onConnectionCreated={loadProjectDetails}
                />
              </div>

              {/* Activity */}
              <div className="mt-12">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
                  Activity
                </h3>
                <ProjectActivityStream
                  notes={[...notes, ...projectMemories.map(m => ({
                    id: m.id,
                    project_id: id || '',
                    user_id: '',
                    bullets: m.body.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^[•-]\s*/, '')),
                    created_at: m.created_at,
                    note_type: (m.memory_type === 'quick-note' ? 'text' : 'voice') as 'text' | 'voice'
                  }))].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())}
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
    </div>
  )
}

// Default export for lazy loading
export default ProjectDetailPage
