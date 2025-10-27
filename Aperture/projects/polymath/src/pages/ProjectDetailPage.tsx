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
import { TaskList, type Task } from '../components/projects/TaskList'
import { RelatedItems } from '../components/RelatedItems'
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
      const data = await response.json()

      if (data.success) {
        setProject(data.project)
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('[ProjectDetail] Failed to load:', error)
      addToast({
        title: 'Failed to load project',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-900 animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Project not found</h2>
          <Button onClick={() => navigate('/projects')} variant="outline">
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  const progress = project.metadata?.progress || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Sticky Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/projects')}
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors touch-manipulation"
              aria-label="Back to projects"
            >
              <ArrowLeft className="h-5 w-5 text-neutral-700" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-neutral-900 truncate">
                {project.title}
              </h1>
              {progress > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-neutral-200 rounded-full overflow-hidden max-w-[200px]">
                    <div
                      className="h-full bg-gradient-to-r from-blue-900 to-blue-700 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-blue-900">
                    {progress}%
                  </span>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors touch-manipulation"
                aria-label="More options"
              >
                <MoreVertical className="h-5 w-5 text-neutral-700" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20">
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        navigate(`/projects?edit=${project.id}`)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 transition-colors"
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        handleDelete()
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
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
        {/* Properties */}
        <ProjectProperties
          project={project}
          onUpdate={(updates) => {
            setProject({ ...project, ...updates })
            updateProject(project.id, updates)
          }}
          onStatusChange={handleStatusChange}
        />

        {/* Next Action */}
        <NextActionCard
          project={project}
          onUpdate={(metadata) => {
            const updated = { ...project, metadata: { ...project.metadata, ...metadata } }
            setProject(updated)
            updateProject(project.id, { metadata: updated.metadata })
          }}
        />

        {/* Task Checklist */}
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

        {/* Related Items */}
        <RelatedItems
          sourceId={project.id}
          sourceType="project"
          sourceText={`${project.title} ${project.description || ''}`}
        />

        {/* Activity Stream */}
        <ProjectActivityStream
          notes={notes}
          onRefresh={loadProjectDetails}
        />
      </div>

      {/* FAB - Voice Note */}
      <button
        onClick={() => setShowAddNote(true)}
        className="fixed bottom-20 right-6 h-14 w-14 bg-blue-900 text-white rounded-full shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center z-20 touch-manipulation active:scale-95"
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

      {/* Confirmation Dialog */}
      {confirmDialog}
    </div>
  )
}
