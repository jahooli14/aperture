/**
 * Project Detail Page
 * Full detail view for individual projects
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, MoreVertical, Plus, Target } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectProperties } from '../components/projects/ProjectProperties'
import { NextActionCard } from '../components/projects/NextActionCard'
import { ProjectActivityStream } from '../components/projects/ProjectActivityStream'
import { AddNoteDialog } from '../components/projects/AddNoteDialog'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { TaskList, type Task } from '../components/projects/TaskList'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { CreateConnectionDialog } from '../components/connections/CreateConnectionDialog'
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
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCreateConnection, setShowCreateConnection] = useState(false) // NEW
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadProjectDetails()
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

  const progress = project.metadata?.progress || 0

  // Get first incomplete task for PinButton content
  const tasks = project.metadata?.tasks || []
  const nextTask = tasks.find(t => !t.done)

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
              <h1 className="text-xl font-bold truncate" style={{ color: 'var(--premium-text-primary)' }}>
                {project.title}
              </h1>
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
                content={
                  <div className="p-6 overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
                      {project.title}
                    </h2>
                    {project.description && (
                      <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                        {project.description}
                      </p>
                    )}
                    {nextTask && (
                      <div className="premium-glass-subtle p-4 rounded-lg">
                        <div className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--premium-amber)' }}>
                          Next Step:
                        </div>
                        <div style={{ color: 'var(--premium-text-primary)' }}>
                          {nextTask.text}
                        </div>
                      </div>
                    )}
                  </div>
                }
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
                        setShowEditDialog(true)
                      }}
                      className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/5"
                      style={{ color: 'var(--premium-text-primary)' }}
                    >
                      Edit Details
                    </button>
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
        {/* Project Description */}
        {project.description && (
          <div className="premium-card p-6">
            <p className="text-base leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
              {project.description}
            </p>
          </div>
        )}

        {/* Next Action (from first uncompleted task) */}
        <NextActionCard project={project} />

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
            onUpdate={(tasks) => {
              const updated = {
                ...project,
                metadata: { ...project.metadata, tasks },
                last_active: new Date().toISOString()
              }
              setProject(updated)
              updateProject(project.id, {
                metadata: updated.metadata,
                last_active: updated.last_active
              })
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
            onConnectionDeleted={loadProjectDetails}
          />
        </div>

        {/* Activity Stream */}
        <ProjectActivityStream
          notes={notes}
          onRefresh={loadProjectDetails}
        />
      </div>

      {/* FAB - Voice Note */}
      <button
        onClick={() => setShowAddNote(true)}
        className="fixed bottom-20 right-6 h-14 w-14 rounded-full shadow-lg transition-all flex items-center justify-center z-20 touch-manipulation active:scale-95"
        style={{
          backgroundColor: 'var(--premium-blue)',
          color: '#ffffff'
        }}
        aria-label="Add note"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={showAddNote}
        onClose={() => setShowAddNote(false)}
        projectId={project.id}
        onNoteAdded={handleNoteAdded}
      />

      {/* Edit Project Dialog */}
      <EditProjectDialog
        project={project}
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) loadProjectDetails() // Refresh after edit
        }}
      />

      {/* Create Connection Dialog */}
      <CreateConnectionDialog
        open={showCreateConnection}
        onOpenChange={setShowCreateConnection}
        sourceType="project"
        sourceId={project.id}
        onConnectionCreated={loadProjectDetails}
      />

      {/* Confirmation Dialog */}
      {confirmDialog}
    </div>
  )
}
