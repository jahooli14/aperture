/**
 * Projects Page - Stunning Visual Design
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { PullToRefresh } from '../components/PullToRefresh'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonCard } from '../components/ui/skeleton'
import { Rocket, LayoutGrid, List, Edit, Trash2, Clock, Sparkles } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import type { Project } from '../types'

export function ProjectsPage() {
  const navigate = useNavigate()
  const {
    projects: allProjects,
    loading,
    error,
    filter,
    fetchProjects,
    deleteProject,
    setFilter
  } = useProjectStore()

  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  // Extract all unique tags from projects
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>()
    allProjects.forEach(project => {
      const tags = project.metadata?.tags || []
      tags.forEach((tag: string) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [allProjects])

  // Filter projects by selected tags
  const projects = React.useMemo(() => {
    if (selectedTags.length === 0) return allProjects
    return allProjects.filter(project => {
      const projectTags = project.metadata?.tags || []
      return selectedTags.every(tag => projectTags.includes(tag))
    })
  }, [allProjects, selectedTags])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

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
        className="pt-12 pb-24"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
      {/* Compact Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8" style={{ color: 'var(--premium-blue)' }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                My Projects
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/suggestions"
              className="border-2 shadow-xl rounded-full px-6 py-2.5 font-medium transition-all hover:shadow-2xl inline-flex items-center gap-2 hover-lift touch-manipulation"
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                borderColor: 'rgba(251, 191, 36, 0.5)',
                color: 'var(--premium-amber)'
              }}
            >
              <Sparkles className="h-4 w-4" />
              <span>Discover</span>
            </Link>
            <CreateProjectDialog />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filters and View Mode in one compact row */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
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
                size="sm"
                className={`whitespace-nowrap px-3 py-1.5 rounded-full font-medium transition-all text-sm ${
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

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`h-8 w-8 p-0 transition-all ${
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
              className={`h-8 w-8 p-0 transition-all ${
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
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-sm font-medium self-center" style={{ color: 'var(--premium-text-secondary)' }}>
              Tags:
            </span>
            {allTags.map(tag => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                onClick={() => toggleTag(tag)}
                size="sm"
                className={`whitespace-nowrap px-3 py-1 rounded-full font-medium transition-all text-xs ${
                  selectedTags.includes(tag)
                    ? 'premium-card border-2 shadow-lg'
                    : 'premium-card border shadow-sm hover:shadow-md'
                }`}
                style={{
                  borderColor: selectedTags.includes(tag) ? 'var(--premium-indigo)' : 'rgba(139, 92, 246, 0.2)',
                  backgroundColor: selectedTags.includes(tag) ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  color: selectedTags.includes(tag) ? 'var(--premium-indigo)' : 'var(--premium-text-secondary)'
                }}
              >
                #{tag}
              </Button>
            ))}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSelectedTags([])}
                size="sm"
                className="text-xs underline"
                style={{ color: 'var(--premium-text-tertiary)' }}
              >
                Clear tags
              </Button>
            )}
          </div>
        )}

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
          /* Grid View - Virtualized Full Cards */
          <div className="w-full max-w-full overflow-hidden mt-8">
            <Virtuoso
              style={{ height: '800px' }}
              totalCount={projects.length}
              itemContent={(index) => (
                <ProjectCard
                  key={`${projects[index].id}-${projects[index].updated_at || projects[index].created_at}`}
                  project={projects[index]}
                  onDelete={() => handleDelete(projects[index])}
                  onClick={(id) => navigate(`/projects/${id}`)}
                />
              )}
              components={{
                List: React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; children?: React.ReactNode }>(
                  ({ style, children }, ref) => (
                    <div
                      ref={ref}
                      style={style}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                    >
                      {children}
                    </div>
                  )
                )
              }}
            />
          </div>
        ) : (
          /* Compact View - Virtualized Mobile-optimized list */
          <div className="mt-8">
            <Virtuoso
              style={{ height: '800px' }}
              totalCount={projects.length}
              itemContent={(index) => (
                <CompactProjectCard
                  key={`${projects[index].id}-${projects[index].updated_at || projects[index].created_at}`}
                  project={projects[index]}
                  onDelete={() => handleDelete(projects[index])}
                  onClick={(id) => navigate(`/projects/${id}`)}
                />
              )}
              components={{
                List: React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; children?: React.ReactNode }>(
                  ({ style, children }, ref) => (
                    <div
                      ref={ref}
                      style={style}
                      className="space-y-4"
                    >
                      {children}
                    </div>
                  )
                )
              }}
            />
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog}
      </motion.div>
    </PullToRefresh>
  )
}

/* Compact Project Card - Mobile-optimized for seeing many projects at once */
function CompactProjectCard({
  project,
  onDelete,
  onClick,
}: {
  project: Project
  onDelete: () => void
  onClick?: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button[data-action]')) {
      return
    }
    // Toggle expand on click
    if (!isExpanded) {
      setIsExpanded(true)
    } else {
      onClick?.(project.id)
    }
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

      <CardContent className="relative z-10 p-3">
        {/* Header Row - Always visible */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base">📄</span>
            <h3 className="font-bold truncate text-sm" style={{ color: 'var(--premium-text-primary)' }}>
              {project.title}
            </h3>
            <div className={`px-1.5 py-0.5 rounded text-xs font-medium border ${statusConfig[project.status].color}`}>
              {statusConfig[project.status].emoji}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {typeof project.metadata?.progress === 'number' && (
              <span className="text-xs font-bold" style={{ color: 'var(--premium-blue)' }}>
                {project.metadata.progress}%
              </span>
            )}
            <Button
              data-action="delete"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:text-red-600 hover:bg-red-50"
              style={{ color: 'var(--premium-text-tertiary)' }}
              aria-label="Delete project"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 space-y-3"
          >
            {/* Description */}
            {project.description && (
              <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                {project.description}
              </p>
            )}

            {/* Next Step */}
            {(() => {
              const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
              const nextTask = tasks
                .sort((a, b) => a.order - b.order)
                .find(t => !t.done)
              return nextTask && (
                <div className="premium-card rounded-lg px-3 py-2" style={{ borderColor: 'var(--premium-blue)' }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--premium-accent)' }}>Next</div>
                  <p className="text-sm line-clamp-2 leading-snug" style={{ color: 'var(--premium-text-primary)' }}>
                    {nextTask.text}
                  </p>
                </div>
              )
            })()}

            {/* Progress Bar */}
            {typeof project.metadata?.progress === 'number' && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(var(--premium-text-tertiary-rgb), 0.2)' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${project.metadata.progress}%`,
                      background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-accent))'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Last Active */}
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              <Clock className="h-3 w-3" />
              <span>Last active {relativeTime} ago</span>
            </div>
          </motion.div>
        )}
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
