import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { ProjectsPageCarousel } from '../components/projects/ProjectsPageCarousel'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { ReaperModal } from '../components/projects/ReaperModal' // Import ReaperModal
import { Button } from '../components/ui/button'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { Layers, Search } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { SubtleBackground } from '../components/SubtleBackground'
import { api } from '../lib/apiClient' // Import API client
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

  // Check for updates on mount if we have no data
  useEffect(() => {
    fetchProjects()
  }, [])

  const { clearSuggestions } = useSuggestionStore()

  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [debouncedSelectedTags, setDebouncedSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const [reaperModalOpen, setReaperModalOpen] = useState(false) // State for ReaperModal

  // Check for rotting projects on page load
  useEffect(() => {
    const checkForRottingProjects = async () => {
      try {
        const response = await api.get('projects?resource=reaper&action=rotting')
        const rottingProjects = Array.isArray(response) ? response : response?.projects || []
        if (rottingProjects.length > 0) {
          setReaperModalOpen(true)
        }
      } catch (error) {
        console.error('Failed to check for rotting projects:', error)
      }
    }
    checkForRottingProjects()
  }, []) // Run only once on mount

  // Debounce tag selection to avoid excessive re-filtering
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSelectedTags(selectedTags)
    }, 150) // 150ms debounce

    return () => clearTimeout(timeoutId)
  }, [selectedTags])

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150) // 150ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

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

  // Filter projects by selected tags and search query (using debounced values)
  const projects = React.useMemo(() => {
    // Ensure allProjects is always an array
    const safeProjects = Array.isArray(allProjects) ? allProjects : []
    if (safeProjects.length === 0) return []

    let filtered = safeProjects

    // Filter by tags
    if (debouncedSelectedTags.length > 0) {
      filtered = filtered.filter(project => {
        const projectTags = project.metadata?.tags || []
        return debouncedSelectedTags.every(tag => projectTags.includes(tag))
      })
    }

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(project =>
        project.title.toLowerCase().includes(query) ||
        (project.description && project.description.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [allProjects, debouncedSelectedTags, debouncedSearchQuery])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // React Query handles fetching now
  // useEffect(() => {
  //   fetchProjects()
  // }, [filter])

  // Categorize projects for the dashboard
  const { activeList, drawerList } = React.useMemo(() => {
    // 1. Get all priority projects
    const priorityProjects = projects.filter(p => p.is_priority)
    const priorityIds = new Set(priorityProjects.map(p => p.id))

    // 2. Get recent active projects, excluding those already prioritized
    const sortedByRecency = [...projects].sort((a, b) =>
      new Date(b.last_active || b.created_at).getTime() - new Date(a.last_active || a.created_at).getTime()
    )

    // Fill remaining slots up to 3 (Pinned + Top Recent) for active focus
    const maxActiveCount = 3
    const recentActiveNonPriority = sortedByRecency
      .filter(p => p.status === 'active' && !priorityIds.has(p.id))
      .slice(0, maxActiveCount - priorityProjects.length)

    const activeList = [...priorityProjects, ...recentActiveNonPriority].filter(Boolean) as Project[]
    const activeIds = new Set(activeList.map(p => p.id))

    // Everything else goes in the drawer
    let drawerList = projects.filter(p => !activeIds.has(p.id))

    // Shuffle drawer daily (deterministic for the day)
    const seed = new Date().toDateString()
    const seededRandom = (str: string) => {
      let h = 0xdeadbeef;
      for (let i = 0; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
      return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }

    drawerList.sort((a, b) => {
      const scoreA = seededRandom(seed + a.id)
      const scoreB = seededRandom(seed + b.id)
      return scoreB - scoreA
    })

    return {
      activeList,
      drawerList
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
                { id: 'completed', label: 'Done' },
                { id: 'graveyard', label: 'Graveyard' }
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
                {/* Search Box */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:outline-none"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderColor: searchQuery ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--premium-text-primary)'
                      }}
                    />
                  </div>
                  {debouncedSearchQuery && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--premium-text-secondary)' }}>
                      Found {projects.length} project{projects.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

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
                  activeProjects={activeList}
                  drawerProjects={drawerList}
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
      {/* Reaper Modal */}
      <ReaperModal
        isOpen={reaperModalOpen}
        onClose={() => setReaperModalOpen(false)}
      />
    </>
  )
}
