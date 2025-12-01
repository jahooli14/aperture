/**
 * Projects Page - Stunning Visual Design
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import { VirtuosoGrid } from 'react-virtuoso'
import { FocusableList, FocusableItem } from '../components/FocusableList'
import { SubtleBackground } from '../components/SubtleBackground'
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
    <>
      <SubtleBackground />
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2">
            {/* Outer Card Structure */}
            <div className="p-6 rounded-xl backdrop-blur-xl mb-6" style={{
              background: 'var(--premium-bg-2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Title Section */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                  Your <span style={{ color: 'var(--premium-blue)' }}>projects</span>
                </h2>
              </div>

              {/* Inner Content */}
              <div>
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
                  <div className="space-y-4">
                    {/* Resurfaced Project Reminder - cycling through forgotten projects */}
                    <ResurfacedReminder projects={projects} />

                    {/* Thematic Swimlanes */}
                    {Object.entries(
                      projects.reduce((acc, project) => {
                        const category = project.type || 'Uncategorized'
                        if (!acc[category]) acc[category] = []
                        acc[category].push(project)
                        return acc
                      }, {} as Record<string, Project[]>)
                    ).sort((a, b) => {
                      // Sort categories: Uncategorized last, others alphabetical or custom order
                      if (a[0] === 'Uncategorized') return 1
                      if (b[0] === 'Uncategorized') return -1
                      return a[0].localeCompare(b[0])
                    }).map(([category, categoryProjects]) => (
                      <div key={category} className="mb-8">
                        <div className="flex items-center gap-2 mb-4 px-2">
                          <h3 className="text-lg font-bold text-white capitalize">
                            {category}
                          </h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
                            {categoryProjects.length}
                          </span>
                        </div>

                        <div className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory scrollbar-hide">
                          {categoryProjects.map((project) => (
                            <div key={project.id} className="flex-shrink-0 w-[300px] snap-center">
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                              >
                                <ProjectCard
                                  project={project}
                                  onClick={(id) => navigate(`/projects/${id}`)}
                                  onDelete={() => handleDelete(project)}
                                />
                              </motion.div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Confirmation Dialog */}
          {confirmDialog}
        </motion.div>
      </div>
    </>
  )
}

function ResurfacedReminder({ projects }: { projects: Project[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartX = React.useRef(0)
  const navigate = useNavigate()

  // Get all non-completed projects, randomized to keep it fresh
  const forgottenProjects = React.useMemo(() => {
    const list = projects.filter(p => p.status !== 'completed')
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list
  }, [projects])

  // Auto-cycle through forgotten projects every 5 seconds
  useEffect(() => {
    if (forgottenProjects.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % forgottenProjects.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [forgottenProjects.length])

  if (forgottenProjects.length === 0) return null

  const project = forgottenProjects[currentIndex]
  const daysSince = Math.floor(
    (Date.now() - new Date(project.updated_at || project.created_at || 0).getTime()) / (1000 * 60 * 60 * 24)
  )

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = touchStartX.current - e.changedTouches[0].clientX
    const threshold = 50

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        // Swipe left - next
        setCurrentIndex(prev => (prev + 1) % forgottenProjects.length)
      } else {
        // Swipe right - previous
        setCurrentIndex(prev => (prev - 1 + forgottenProjects.length) % forgottenProjects.length)
      }
    }
  }

  const handleClick = () => {
    navigate(`/projects/${project.id}`)
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className="cursor-pointer overflow-hidden"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={project.id}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="p-3 rounded-xl mb-2"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(16, 185, 129, 0.8)' }}>
                Remember this? • {daysSince}d ago
              </p>
              <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--premium-text-primary)' }}>
                {project.title}
              </h4>
            </div>
            {forgottenProjects.length > 1 && (
              <div className="flex items-center gap-1">
                {forgottenProjects.map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{
                      backgroundColor: i === currentIndex ? 'rgba(16, 185, 129, 0.8)' : 'rgba(255, 255, 255, 0.2)'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
