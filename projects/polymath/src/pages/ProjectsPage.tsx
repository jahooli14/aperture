import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthContext } from '../contexts/AuthContext'
import { SignInNudge } from '../components/SignInNudge'
import { useProjectStore } from '../stores/useProjectStore'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { ProjectsPageCarousel } from '../components/projects/ProjectsPageCarousel'
import { ForYouToday } from '../components/projects/ForYouToday'
import { DrawerDigestSheet } from '../components/projects/DrawerDigestSheet'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { Button } from '../components/ui/button'
import { Search, Check, ArrowLeft } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { SubtleBackground } from '../components/SubtleBackground'
import type { Project } from '../types'

// ============================================================================
// Completed Projects Timeline
// ============================================================================

function formatDurationShort(createdAt: string, updatedAt?: string): string {
  const end = updatedAt ? new Date(updatedAt).getTime() : Date.now()
  const ms = end - new Date(createdAt).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days < 1) return 'less than a day'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year' : `${years} years`
}

function CompletedProjectsTimeline({ projects, onNavigate }: { projects: Project[], onNavigate: (id: string) => void }) {
  const sorted = [...projects].sort((a, b) =>
    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="text-center py-24">
        <Check className="w-12 h-12 mb-4" style={{ color: '#34d399' }} />
        <p className="text-[var(--brand-text-primary)] font-black uppercase tracking-tight text-lg mb-2">No completed projects yet</p>
        <p className="text-sm" style={{ color: 'var(--brand-text-secondary)' }}>When you finish something, it'll live here.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--brand-text-secondary)' }}>
          {sorted.length} project{sorted.length !== 1 ? 's' : ''} finished
        </p>
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)]">
          What you've <span className="text-[rgb(var(--color-accent-light-rgb))]">built</span>
        </h2>
      </div>

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: 'rgba(var(--brand-primary-rgb), 0.15)' }} />

        <div className="space-y-6">
          {sorted.map((project, i) => {
            const completedDate = project.updated_at ? new Date(project.updated_at) : null
            const duration = formatDurationShort(project.created_at, project.updated_at)

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex gap-4"
              >
                {/* Timeline dot */}
                <div className="relative flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center z-10 relative"
                    style={{ background: 'rgba(var(--brand-primary-rgb), 0.12)', border: '1px solid rgba(var(--brand-primary-rgb), 0.3)' }}
                  >
                    <Check className="w-4 h-4" style={{ color: 'rgb(var(--color-accent-light-rgb))' }} />
                  </div>
                </div>

                {/* Card */}
                <button
                  onClick={() => onNavigate(project.id)}
                  className="flex-1 text-left p-4 rounded-xl transition-all hover:scale-[1.01]"
                  style={{
                    background: 'rgba(var(--brand-primary-rgb), 0.04)',
                    border: '1px solid rgba(var(--brand-primary-rgb), 0.15)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-black uppercase tracking-tight text-sm text-[var(--brand-text-primary)] line-clamp-1">
                      {project.title}
                    </h3>
                    {project.type && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-text-secondary)' }}>
                        {project.type}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--brand-text-secondary)' }}>
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(var(--brand-primary-rgb), 0.6)' }}>
                    <span>{duration}</span>
                    {completedDate && (
                      <>
                        <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                        <span>{completedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const { isAuthenticated, loading: authLoading } = useAuthContext()

  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--brand-bg)' }} className="min-h-screen pt-12">
        <SignInNudge variant="projects" />
      </div>
    )
  }

  const navigate = useNavigate()
  const {
    projects: allProjects,
    loading,
    fetchProjects
  } = useProjectStore()
  const [showCompleted, setShowCompleted] = useState(false)

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

  const FOCUS_CAP = 3
  const { activeList, drawerList } = React.useMemo(() => {
    // Exclude completed/graveyard projects from active and drawer sections
    const nonCompleted = projects.filter(p => p.status !== 'completed' && p.status !== 'graveyard')

    const priorityProjects = nonCompleted
      .filter(p => p.is_priority)
      .slice(0, FOCUS_CAP)
    const priorityIds = new Set(priorityProjects.map(p => p.id))

    const recentActiveNonPriority = [...nonCompleted]
      .sort((a, b) =>
        new Date(b.last_active || b.created_at).getTime() - new Date(a.last_active || a.created_at).getTime()
      )
      .filter(p => !p.is_priority && !priorityIds.has(p.id))
      .slice(0, Math.max(0, FOCUS_CAP - priorityProjects.length))

    const activeList = [...priorityProjects, ...recentActiveNonPriority] as Project[]
    const activeIds = new Set(activeList.map(p => p.id))
    // Everything not in the focus area goes in the drawer
    const drawerList = nonCompleted.filter(p => !activeIds.has(p.id))

    return { activeList, drawerList }
  }, [projects])

  return (
    <>
      <SubtleBackground />
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-4 flex flex-col gap-2">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {showCompleted && (
                <button
                  onClick={() => setShowCompleted(false)}
                  className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all bg-[var(--glass-surface)] border border-white/10"
                  style={{ color: "var(--brand-primary)" }}
                  title="Back to projects"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <h1 className="text-[2rem] sm:text-4xl leading-[0.95] font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] break-words">
                {showCompleted ? (
                  <>what you've <span className="text-brand-primary">built</span></>
                ) : (
                  <>your <span className="text-brand-primary">projects</span></>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {!showCompleted && (
                <>
                  <CreateProjectDialog />
                  <button
                    onClick={() => navigate('/search')}
                    className="h-11 w-11 rounded-xl flex items-center justify-center transition-all bg-[var(--glass-surface)] border border-white/10"
                    style={{ color: "var(--brand-primary)" }}
                    title="Search everything"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowCompleted(true)}
                    className="h-11 w-11 rounded-xl flex items-center justify-center transition-all bg-[var(--glass-surface)] border border-white/10"
                    style={{ color: "var(--brand-primary)" }}
                    title="View completed projects"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <motion.div
          className="pb-24 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Completed Projects Timeline */}
          {showCompleted ? (
            <CompletedProjectsTimeline
              projects={projects.filter(p => p.status === 'completed')}
              onNavigate={(id) => navigate(`/projects/${id}`)}
            />
          ) : (<>

          {/* Controls */}
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-6 pt-2">
            {/* Outer Card Structure */}
            <div className="p-4 sm:p-6 rounded-2xl mb-6 relative overflow-hidden premium-glass shadow-2xl" style={{
              background: 'var(--brand-glass-bg)',
              border: '1px solid var(--glass-surface-hover)',
            }}>
              <div>
                {/* Search Box */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-all focus:outline-none"
                      style={{
                        backgroundColor: 'var(--glass-surface)',
                        borderColor: searchQuery ? 'var(--brand-primary)' : 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--brand-text-primary)'
                      }}
                    />
                  </div>
                  {debouncedSearchQuery && (
                    <div className="mt-2 text-xs" style={{ color: "var(--brand-primary)" }}>
                      Found {projects.length} project{projects.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Tag Filters */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 mb-6">
                    <span className="text-sm font-medium self-center" style={{ color: "var(--brand-primary)" }}>
                      Tags:
                    </span>
                    {allTags.map(tag => (
                      <Button
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        onClick={() => toggleTag(tag)}
                        size="sm"
                        className="whitespace-nowrap px-3 py-1 rounded-lg font-medium transition-all text-xs"
                        style={{
                          backgroundColor: selectedTags.includes(tag) ? 'var(--glass-surface)' : 'transparent',
                          color: selectedTags.includes(tag) ? 'var(--brand-primary)' : 'var(--brand-text-secondary)'
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
                        style={{ color: "var(--brand-primary)" }}
                      >
                        Clear tags
                      </Button>
                    )}
                  </div>
                )}

                {/* Weekly drawer digest banner — invisible when none unread */}
                <DrawerDigestSheet />

                {/* "For you today" — warmed drawer items, invisible when empty */}
                <ForYouToday />

                {/* Masonry Dashboard */}
                <ProjectsPageCarousel
                  activeProjects={activeList}
                  drawerProjects={drawerList}
                  archiveSpotlight={null}
                  loading={loading}
                  onClearSuggestions={clearSuggestions}
                />
              </div>
            </div>
          </div>

          {/* Confirmation Dialog */}
          {confirmDialog}
          </>)}
        </motion.div>
      </div>
    </>
  )
}
