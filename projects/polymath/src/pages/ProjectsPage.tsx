import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { ProjectsPageCarousel } from '../components/projects/ProjectsPageCarousel'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { Button } from '../components/ui/button'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { Layers, Search } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { SubtleBackground } from '../components/SubtleBackground'
import type { Project } from '../types'

export function ProjectsPage() {
  const navigate = useNavigate()
  const {
    projects: allProjects,
    loading,
    filter,
    fetchProjects,
    deleteProject,
    setFilter
  } = useProjectStore()

  const { clearSuggestions } = useSuggestionStore()

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

  // Categorize projects for the dashboard
  const { pinnedProject, recentProjects, resurfaceProjects, suggestedProjects } = React.useMemo(() => {
    const pinned = projects.find(p => p.is_priority) || null
    
    const sortedByRecency = [...projects].sort((a, b) => 
      new Date(b.last_active || b.created_at).getTime() - new Date(a.last_active || a.created_at).getTime()
    )

    const recent = sortedByRecency.slice(0, 5)

    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    const resurface = projects.filter(p => {
      const lastActive = new Date(p.last_active || p.created_at).getTime()
      const isDormant = (now - lastActive) > (14 * DAY)
      return isDormant && !p.is_priority
    })

    const suggested = projects.filter(p => {
      const created = new Date(p.created_at).getTime()
      const isNew = (now - created) < (7 * DAY)
      return isNew && !p.is_priority
    })

    return {
      pinnedProject: pinned,
      recentProjects: recent,
      resurfaceProjects: resurface,
      suggestedProjects: suggested
    }
  }, [projects])

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
                  <div className="flex flex-wrap gap-2 mt-3 mb-6">
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

                {/* Masonry Dashboard */}
                <ProjectsPageCarousel 
                  pinnedProject={pinnedProject}
                  recentProjects={recentProjects}
                  resurfaceProjects={resurfaceProjects}
                  suggestedProjects={suggestedProjects}
                  loading={loading}
                  onClearSuggestions={clearSuggestions}
                />
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
