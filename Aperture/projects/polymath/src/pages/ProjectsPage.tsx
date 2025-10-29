/**
 * Projects Page - Stunning Visual Design
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { PullToRefresh } from '../components/PullToRefresh'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonCard } from '../components/ui/skeleton'
import { Rocket, LayoutGrid, List, Edit, Trash2, Clock } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import type { Project } from '../types'

export function ProjectsPage() {
  const navigate = useNavigate()
  const {
    projects,
    loading,
    error,
    filter,
    fetchProjects,
    deleteProject,
    setFilter
  } = useProjectStore()

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid')
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleEdit = (project: Project) => {
    setSelectedProject(project)
    setEditDialogOpen(true)
  }

  const handleDelete = async (project: Project) => {
    const confirmed = await confirm({
      title: `Delete "${project.title}"?`,
      description: 'This action cannot be undone. The project will be permanently removed.',
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
      } catch (error) {
        addToast({
          title: 'Failed to delete project',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      }
    }
  }

  const handleRefresh = async () => {
    await fetchProjects()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      <motion.div
        className="py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
      {/* Header with Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        {/* Button row - pushes content down */}
        <div className="flex items-center justify-end mb-6">
          <CreateProjectDialog />
        </div>
        {/* Centered header content below button */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Rocket className="h-12 w-12" style={{ color: 'var(--premium-blue)' }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
            My Projects
          </h1>
          <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
            Track your creative work and strengthen capabilities
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* View Mode Toggle - Mobile optimized */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={`h-9 w-9 p-0 transition-all ${
              viewMode === 'grid'
                ? 'premium-card border-2 shadow-xl'
                : 'premium-card border-2 shadow-md hover:shadow-lg'
            }`}
            style={{
              borderColor: viewMode === 'grid' ? 'var(--premium-blue)' : 'rgba(var(--premium-blue-rgb), 0.2)',
              color: viewMode === 'grid' ? 'var(--premium-blue)' : 'var(--premium-text-tertiary)'
            }}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('compact')}
            className={`h-9 w-9 p-0 transition-all ${
              viewMode === 'compact'
                ? 'premium-card border-2 shadow-xl'
                : 'premium-card border-2 shadow-md hover:shadow-lg'
            }`}
            style={{
              borderColor: viewMode === 'compact' ? 'var(--premium-blue)' : 'rgba(var(--premium-blue-rgb), 0.2)',
              color: viewMode === 'compact' ? 'var(--premium-blue)' : 'var(--premium-text-tertiary)'
            }}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {[
            { key: 'all', label: 'All' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'active', label: 'Active' },
            { key: 'dormant', label: 'Dormant' },
            { key: 'completed', label: 'Completed' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? 'default' : 'outline'}
              onClick={() => setFilter(key as typeof filter)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
                filter === key
                  ? 'premium-card border-2 shadow-xl'
                  : 'premium-card border-2 shadow-md hover:shadow-lg'
              }`}
              style={{
                borderColor: filter === key ? 'var(--premium-blue)' : 'rgba(var(--premium-blue-rgb), 0.2)',
                color: filter === key ? 'var(--premium-blue)' : 'var(--premium-text-secondary)'
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Demo Projects Context Banner - Only show when projects include demo data */}
        {projects.length > 0 && projects.some(p => p.title === 'Standing Desk' || p.title === 'Portfolio Website') && (
          <Card className="mb-8 premium-card" style={{ borderColor: 'var(--premium-blue)' }}>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                <Rocket className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                Demo Projects - Progress Tracking in Action
              </h3>
              <p className="leading-relaxed mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                These 4 demo projects show different stages: <strong>Completed</strong> (Standing Desk 100%), <strong>Active</strong> (Portfolio 65%, Image Classifier 80%, Meditation 40%).
                Each has <strong>next steps</strong> and tracks capability growth as you work.
              </p>
              <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                💡 <strong>Tip:</strong> Build projects from suggestions, update progress, and watch your capabilities strengthen over time.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600 font-semibold">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <Card className="premium-card">
            <CardContent className="py-24">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center">
                  <Rocket className="h-16 w-16" style={{ color: 'var(--premium-blue)' }} />
                </div>
                <h3 className="text-2xl font-bold" style={{ color: 'var(--premium-text-primary)' }}>No projects yet</h3>
                <p className="max-w-md mx-auto" style={{ color: 'var(--premium-text-secondary)' }}>
                  Build a project from a suggestion or create one manually to get started on your creative journey
                </p>
                <CreateProjectDialog />
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View - Full Cards */
          <div className="w-full max-w-full overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 stagger-children mt-8">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={() => handleEdit(project)}
                  onDelete={() => handleDelete(project)}
                  onClick={(id) => navigate(`/projects/${id}`)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Compact View - Mobile-optimized list */
          <div className="space-y-3 mt-8">
            {projects.map((project) => (
              <CompactProjectCard
                key={project.id}
                project={project}
                onEdit={() => handleEdit(project)}
                onDelete={() => handleDelete(project)}
                onClick={(id) => navigate(`/projects/${id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditProjectDialog
        project={selectedProject}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Confirmation Dialog */}
      {confirmDialog}
      </motion.div>
    </PullToRefresh>
  )
}

/* Compact Project Card - Mobile-optimized for seeing many projects at once */
function CompactProjectCard({
  project,
  onEdit,
  onDelete,
  onClick,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onClick?: (id: string) => void
}) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onClick?.(project.id)
  }
  const statusConfig: Record<string, { color: string; emoji: string }> = {
    upcoming: { color: 'bg-amber-100 text-amber-700 border-amber-300', emoji: '📅' },
    active: { color: 'bg-green-100 text-green-700 border-green-300', emoji: '🚀' },
    'on-hold': { color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '⏸️' },
    maintaining: { color: 'bg-blue-100 text-blue-700 border-blue-300', emoji: '🔧' },
    completed: { color: 'bg-purple-100 text-purple-700 border-purple-300', emoji: '✅' },
    archived: { color: 'bg-neutral-100 text-neutral-700 border-neutral-300', emoji: '📦' },
  }

  const relativeTime = formatRelativeTime(project.last_active)

  return (
    <Card
      className="group relative overflow-hidden rounded-2xl premium-card border-2 shadow-xl transition-all duration-300 hover:shadow-2xl cursor-pointer"
      style={{ borderColor: 'rgba(var(--premium-blue-rgb), 0.3)' }}
      onClick={handleCardClick}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(var(--premium-blue-rgb), 0.15)' }} />
      {/* Accent gradient bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-accent))' }} />

      <CardContent className="relative z-10 p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📄</span>
              <h3 className="font-bold truncate text-base" style={{ color: 'var(--premium-text-primary)' }}>
                {project.title}
              </h3>
            </div>
            {project.description && (
              <p className="text-sm line-clamp-1" style={{ color: 'var(--premium-text-secondary)' }}>
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              onClick={onEdit}
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 hover:bg-blue-50 touch-manipulation"
              style={{ color: 'var(--premium-text-tertiary)' }}
              aria-label="Edit project"
            >
              <Edit className="h-5 w-5" style={{ color: 'inherit' }} />
            </Button>
            <Button
              onClick={onDelete}
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 hover:text-red-600 hover:bg-red-50 touch-manipulation"
              style={{ color: 'var(--premium-text-tertiary)' }}
              aria-label="Delete project"
            >
              <Trash2 className="h-5 w-5" style={{ color: 'inherit' }} />
            </Button>
          </div>
        </div>

        {/* Next Step - Compact */}
        {project.metadata?.next_step && (
          <div className="premium-card rounded-lg px-3 py-2 mb-3" style={{ borderColor: 'var(--premium-blue)' }}>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--premium-accent)' }}>Next</div>
            <p className="text-sm line-clamp-2 leading-snug" style={{ color: 'var(--premium-text-primary)' }}>
              {project.metadata.next_step}
            </p>
          </div>
        )}

        {/* Bottom Row - Status, Progress, Last Active */}
        <div className="flex items-center gap-3 text-xs">
          <div className={`px-2 py-1 rounded-md font-medium border ${statusConfig[project.status].color}`}>
            {statusConfig[project.status].emoji}
          </div>

          {typeof project.metadata?.progress === 'number' && (
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(var(--premium-text-tertiary-rgb), 0.2)' }}>
                <div
                  className="h-full"
                  style={{
                    width: `${project.metadata.progress}%`,
                    background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-accent))'
                  }}
                />
              </div>
              <span className="font-bold w-8 text-right" style={{ color: 'var(--premium-blue)' }}>
                {project.metadata.progress}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto" style={{ color: 'var(--premium-text-tertiary)' }}>
            <Clock className="h-3 w-3" />
            <span className="whitespace-nowrap">{relativeTime}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`
  return `${Math.floor(diffDays / 365)}y`
}
