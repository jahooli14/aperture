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
import { Rocket, Sparkles, Search } from 'lucide-react'
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

  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  // Extract all unique tags from projects
  const allTags = React.useMemo(() => {
    const safeProjects = Array.isArray(allProjects) ? allProjects : []
    if (safeProjects.length === 0) return []

    const tagSet = new Set<string>()
    safeProjects.forEach(project => {
      const tags = project.metadata?.tags || []
      tags.forEach((tag: string) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [allProjects])

  // Filter projects by selected tags
  const projects = React.useMemo(() => {
    // Ensure allProjects is always an array
    const safeProjects = Array.isArray(allProjects) ? allProjects : []
    if (safeProjects.length === 0) return []

    if (selectedTags.length === 0) return safeProjects

    return safeProjects.filter(project => {
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
  }, [fetchProjects, filter])

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
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b" style={{
        backgroundColor: 'var(--premium-bg-1)',
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center" style={{
            color: 'var(--premium-blue)',
            opacity: 0.7
          }}>
            <Rocket className="h-7 w-7" />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-1 flex-wrap">
            {[
              { key: 'all', label: 'All' },
              { key: 'upcoming', label: 'Next' },
              { key: 'active', label: 'Active' },
              { key: 'dormant', label: 'Dormant' },
              { key: 'completed', label: 'Done' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as typeof filter)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  backgroundColor: filter === key ? 'var(--premium-bg-3)' : 'var(--premium-bg-2)',
                  color: filter === key ? 'rgba(100, 180, 255, 1)' : 'var(--premium-text-tertiary)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <CreateProjectDialog />
            <button
              onClick={() => navigate('/search')}
              className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-white/5"
              style={{
                borderColor: 'rgba(25, 50, 90, 0.2)',
                color: 'rgba(100, 180, 255, 1)'
              }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <motion.div
        className="pt-20 pb-24 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                className="whitespace-nowrap px-3 py-1 rounded-full font-medium transition-all text-xs border"
                style={{
                  borderColor: selectedTags.includes(tag) ? 'var(--premium-indigo)' : 'var(--premium-bg-2)',
                  backgroundColor: selectedTags.includes(tag) ? 'var(--premium-bg-3)' : 'transparent',
                  color: selectedTags.includes(tag) ? 'var(--premium-blue)' : 'var(--premium-text-secondary)'
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
          <Card className="mb-8" style={{
            borderColor: 'var(--premium-blue)',
            background: 'var(--premium-bg-2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}>
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
                <strong>Tip:</strong> Build projects from suggestions, update progress, and watch your capabilities strengthen over time.
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
          <Card style={{
            background: 'var(--premium-bg-2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}>
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
        ) : (
          /* Grid View - Virtualized Compact/Expandable Cards */
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
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog}
      </motion.div>
    </PullToRefresh>
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
