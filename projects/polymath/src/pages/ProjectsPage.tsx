/**
 * Projects Page - Stunning Visual Design
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { EmptyState } from '../components/ui/empty-state'
import { Layers, Sparkles, Search } from 'lucide-react'
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
  const [debouncedSelectedTags, setDebouncedSelectedTags] = useState<string[]>([])
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  // Debounce tag selection to avoid excessive re-filtering
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSelectedTags(selectedTags)
    }, 150) // 150ms debounce

    return () => clearTimeout(timeoutId)
  }, [selectedTags])

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

  // Filter projects by selected tags (using debounced tags)
  const projects = React.useMemo(() => {
    // Ensure allProjects is always an array
    const safeProjects = Array.isArray(allProjects) ? allProjects : []
    if (safeProjects.length === 0) return []

    if (debouncedSelectedTags.length === 0) return safeProjects

    return safeProjects.filter(project => {
      const projectTags = project.metadata?.tags || []
      return debouncedSelectedTags.every(tag => projectTags.includes(tag))
    })
  }, [allProjects, debouncedSelectedTags])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  useEffect(() => {
    fetchProjects()
  }, [filter]) // Only re-fetch when filter changes, not when fetchProjects changes

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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md" style={{
        backgroundColor: 'rgba(15, 24, 41, 0.7)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center" style={{
            color: 'var(--premium-blue)',
            opacity: 0.7
          }}>
            <Layers className="h-7 w-7" />
          </div>

          {/* Filter Tabs */}
          <PremiumTabs
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Next' },
              { id: 'active', label: 'Active' },
              { id: 'dormant', label: 'Dormant' },
              { id: 'completed', label: 'Done' }
            ]}
            activeTab={filter}
            onChange={(tabId) => setFilter(tabId as typeof filter)}
            className="flex-nowrap"
          />

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <CreateProjectDialog />
            <button
              onClick={() => navigate('/search')}
              className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
              style={{
                color: 'var(--premium-blue)'
              }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <motion.div
        className="pb-24 relative z-10"
        style={{ paddingTop: '5.5rem' }}
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
                className="whitespace-nowrap px-3 py-1 rounded-full font-medium transition-all text-xs"
                style={{
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
            background: 'var(--premium-bg-2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                <Layers className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
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
          <Card className="mb-6 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-red-600 font-semibold">{error}</p>
                <Button
                  onClick={() => fetchProjects()}
                  size="sm"
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Grid - Shows all projects based on filter */}
        {loading && projects.length === 0 ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-white/5 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <EmptyState
            icon={Layers}
            title={filter === 'all' ? "No projects yet" : `No ${filter} projects`}
            description="Build a project from a suggestion or create one manually to get started on your creative journey"
          />
        ) : (
          /* Grid View - All projects */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog}
      </motion.div>
    </div>
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
