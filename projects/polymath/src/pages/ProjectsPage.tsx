/**
 * Projects Page - Stunning Visual Design
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'
import { ProjectListRow } from '../components/projects/ProjectListRow'
import { SpotlightCard } from '../components/projects/SpotlightCard'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { EmptyState } from '../components/ui/empty-state'
import { Layers, Sparkles, Search } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { VirtuosoGrid } from 'react-virtuoso'
import { FocusableList, FocusableItem } from '../components/FocusableList'
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

          {/* Two-Column Layout: Spotlight (left) + Scrollable List (right) */}
          {loading && projects.length === 0 ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={filter === 'all' ? "No projects yet" : `No ${filter} projects`}
              description="Build a project from a suggestion or create one manually to get started on your creative journey"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Spotlight (sticky on desktop, scrollable on mobile) */}
              <div className="lg:sticky lg:top-24 lg:h-fit space-y-3">
                <SpotlightSection projects={projects} />
              </div>

              {/* Right Column: Scrollable List (2 columns on mobile, 1 on desktop for density) */}
              <div className="lg:col-span-2">
                <FocusableList>
                  <VirtuosoGrid
                    useWindowScroll
                    data={projects}
                    listClassName="grid grid-cols-2 gap-2"
                    itemContent={(index, project) => {
                      const isSpotlighted = isProjectSpotlighted(project, projects)
                      const spotlightColor = getSpotlightColor(project, projects)
                      return (
                        <FocusableItem id={project.id} type="project">
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 }} // Reduced delay for virtualized items
                          >
                            <ProjectListRow
                              project={project}
                              isSpotlighted={isSpotlighted}
                              spotlightColor={spotlightColor}
                            />
                          </motion.div>
                        </FocusableItem>
                      )
                    }}
                  />
                </FocusableList>
              </div>
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

function isProjectSpotlighted(project: Project, allProjects: Project[]): boolean {
  const spotlighted = getSpotlightProjects(allProjects)
  return spotlighted.some(p => p.project.id === project.id)
}

function getSpotlightColor(project: Project, allProjects: Project[]): string {
  const spotlighted = getSpotlightProjects(allProjects)
  const spot = spotlighted.find(p => p.project.id === project.id)
  if (!spot) return 'rgba(255, 255, 255, 0.02)'

  switch (spot.type) {
    case 'pinned':
      return 'rgba(59, 130, 246, 0.15)'
    case 'recent':
      return 'rgba(168, 85, 247, 0.15)'
    case 'resurfaced':
      return 'rgba(16, 185, 129, 0.15)'
    default:
      return 'rgba(255, 255, 255, 0.02)'
  }
}

interface SpotlightProject {
  project: Project
  type: 'pinned' | 'recent' | 'resurfaced'
}

function getSpotlightProjects(projects: Project[]): SpotlightProject[] {
  const result: SpotlightProject[] = []

  const getTime = (dateStr?: string) => {
    if (!dateStr) return 0
    const ms = new Date(dateStr).getTime()
    return isNaN(ms) ? 0 : ms
  }

  // 1. Pinned project
  const pinned = projects.find(p => p.is_priority && p.status === 'active')
  if (pinned) {
    result.push({ project: pinned, type: 'pinned' })
  }

  // 2. Recent projects (1-2)
  const recent = projects
    .filter(p => p.status === 'active' && !p.is_priority)
    .sort((a, b) => {
      const aTime = getTime(a.updated_at || a.last_active)
      const bTime = getTime(b.updated_at || b.last_active)
      return bTime - aTime
    })
    .slice(0, 2)
  recent.forEach(p => result.push({ project: p, type: 'recent' }))

  // 3. Resurfaced (dormant) projects (1-2)
  const resurfaced = projects
    .filter(p => p.status === 'dormant')
    .sort((a, b) => {
      // Prioritize ones that haven't been suggested recently
      const aTime = getTime((a as any).last_suggested_at || a.created_at)
      const bTime = getTime((b as any).last_suggested_at || b.created_at)
      return aTime - bTime
    })
    .slice(0, 2)
  resurfaced.forEach(p => result.push({ project: p, type: 'resurfaced' }))

  return result
}

function SpotlightSection({ projects }: { projects: Project[] }) {
  const spotlighted = getSpotlightProjects(projects)

  if (spotlighted.length === 0) return null

  return (
    <>
      {spotlighted.map(({ project, type }) => (
        <FocusableItem key={project.id} id={project.id} type="project">
          <SpotlightCard
            project={project}
            type={type}
          />
        </FocusableItem>
      ))}
    </>
  )
}
