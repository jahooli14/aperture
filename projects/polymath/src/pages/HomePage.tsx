/**
 * Home Page - 4-Pillar Architecture
 * 1. Add something new - voice, thought, article, project
 * 2. Keep the momentum - next steps on priority/recent projects
 * 3. Get inspiration - AI suggestions
 * 4. Explore - timeline, constellation, card of the day
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOnboardingStore } from '../stores/useOnboardingStore'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'
import { SmartSuggestionWidget } from '../components/SmartSuggestionWidget'
import { SaveArticleDialog } from '../components/reading/SaveArticleDialog'
import { CreateMemoryDialog } from '../components/memories/CreateMemoryDialog'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { EmptyState } from '../components/ui/empty-state'
import { Layers, ArrowRight, Plus, Mic, FileText, FolderKanban, Search, TrendingUp, Moon, Calendar, Zap, Brain, X, AlertCircle, Check, Lightbulb, RefreshCw, Wind, Rss, Map as MapIcon, MoreHorizontal } from 'lucide-react'
import { MultiPerspectiveSuggestions } from '../components/suggestions/MultiPerspectiveSuggestions'
import { BrandName } from '../components/BrandName'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { SubtleBackground } from '../components/SubtleBackground'
import { DriftMode } from '../components/bedtime/DriftMode'
import { MorningFollowUp } from '../components/bedtime/MorningFollowUp'
import { CollisionReport } from '../components/home/CollisionReport'
import { ShadowProjectCard } from '../components/home/ShadowProjectCard'
import { PROJECT_COLORS } from '../components/projects/ProjectCard'
import { PowerHourHero } from '../components/home/PowerHourHero'
import type { Memory, Project, SynthesisInsight } from '../types'
import { CohesionSummaryWidget } from '../components/home/CohesionSummaryWidget'
import { JourneyMilestones } from '../components/home/JourneyMilestones'
import { TomorrowHook } from '../components/home/TomorrowHook'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { readingDb } from '../lib/db'

interface InspirationData {
  type: 'article' | 'thought' | 'project' | 'empty'
  title: string
  description: string
  url?: string
  reasoning: string
}

function GetInspirationSection({
  excludeProjectIds,
  hasPendingSuggestions,
  pendingSuggestionsCount,
  projectsLoading,
  sparkCandidate,
  projects
}: {
  excludeProjectIds: string[]
  hasPendingSuggestions: boolean
  pendingSuggestionsCount: number
  projectsLoading: boolean
  sparkCandidate: Project | null
  projects: Project[]
}) {
  const [inspiration, setInspiration] = useState<InspirationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (projectsLoading || hasFetched) return

    const loadInspiration = async () => {
      setLoading(true)
      try {
        const cached = await readingDb.getDashboard('inspiration')
        if (cached) {
          setInspiration(cached)
          setLoading(false)
        }

        if (navigator.onLine) {
          const excludeParam = excludeProjectIds.length > 0 ? `&exclude=${excludeProjectIds.join(',')}` : ''
          const response = await fetch(`/api/analytics?resource=inspiration${excludeParam}`)
          if (response.ok) {
            const data = await response.json()
            setInspiration(data)
            await readingDb.cacheDashboard('inspiration', data)
          }
        }
      } catch (error) {
        console.error('Failed to load inspiration:', error)
      } finally {
        setLoading(false)
        setHasFetched(true)
      }
    }

    loadInspiration()
  }, [projectsLoading, hasFetched, excludeProjectIds.join(',')])

  const timeContextEnergy = (() => {
    const hour = new Date().getHours()
    if (hour >= 9 && hour < 12) return 'high'
    if (hour >= 14 && hour < 16) return 'low'
    if (hour >= 20) return 'low'
    return 'moderate'
  })()


  // Theme helper for Cards (Standardized)
  const getTheme = (type: string, title: string) => {
    const t = type?.toLowerCase().trim() || ''

    let rgb = PROJECT_COLORS[t]

    // Deterministic fallback if type is unknown or missing
    if (!rgb) {
      const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
      let hash = 0
      for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash)
      }
      rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
    }

    return {
      borderColor: `rgba(${rgb}, 0.25)`,
      backgroundColor: `rgba(${rgb}, 0.08)`,
      textColor: `rgb(${rgb})`,
      rgb: rgb
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 aperture-shelf">
      <div className="mb-0">
        <h2 className="section-header">
          get <span>inspiration</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. AI Inspiration Card */}
        {loading ? (
          <SkeletonCard variant="list" count={1} />
        ) : inspiration && inspiration.type !== 'empty' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col"
          >
            <Link
              to={inspiration.url || '/projects'}
              className="group block p-6 attention-card transition-all duration-300 flex-1 flex flex-col relative overflow-hidden"
              onMouseEnter={(e) => {
                const projId = inspiration.url?.split('/').pop()
                if (inspiration.type === 'project') {
                  const project = projects.find(p => p.id === projId)
                  const theme = getTheme(project?.type || 'other', inspiration.title)
                  e.currentTarget.style.background = `rgba(${theme.rgb}, 0.15)`
                } else {
                  e.currentTarget.style.background = 'var(--glass-surface-hover)'
                }
              }}
              onMouseLeave={(e) => {
                const projId = inspiration.url?.split('/').pop()
                if (inspiration.type === 'project') {
                  const project = projects.find(p => p.id === projId)
                  const theme = getTheme(project?.type || 'other', inspiration.title)
                  e.currentTarget.style.background = theme.backgroundColor
                } else {
                  e.currentTarget.style.background = 'var(--brand-glass-bg)'
                }
              }}
            >
              <div className="relative z-10 flex-1 flex flex-col h-full">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="premium-text-platinum font-bold text-lg truncate">
                    {inspiration.title}
                  </h3>
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-xl text-[10px] font-black uppercase tracking-widest border aperture-header"
                    style={(() => {
                      const projId = inspiration.url?.split('/').pop()
                      const project = projects.find(p => p.id === projId)
                      const theme = getTheme(project?.type || 'other', inspiration.title)
                      return {
                        borderColor: inspiration.type === 'project' ? `rgba(${theme.rgb}, 0.3)` : 'rgba(var(--brand-primary-rgb), 0.3)',
                        color: inspiration.type === 'project' ? theme.textColor : 'var(--brand-primary)',
                        backgroundColor: inspiration.type === 'project' ? `rgba(${theme.rgb}, 0.1)` : 'rgba(var(--brand-primary-rgb), 0.1)'
                      }
                    })()}
                  >
                    Recommended
                  </span>
                </div>
                <div className="p-4 rounded-xl mt-6 bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] group-hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                  <p className="text-[10px] font-bold mb-2 text-[var(--brand-primary)] uppercase tracking-wider opacity-50">NEXT STEP</p>
                  {inspiration.type === 'project' && (() => {
                    const proj = projects.find(p => p.id === inspiration.url?.split('/').pop())
                    const nextT = proj?.metadata?.tasks?.find((t: any) => !t.done)
                    return (
                      <p className="text-sm text-gray-200 line-clamp-2 aperture-body">
                        {nextT?.text || inspiration.description}
                      </p>
                    )
                  })()}
                  {inspiration.type !== 'project' && (
                    <p className="text-sm text-gray-200 line-clamp-2 aperture-body">{inspiration.description}</p>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ) : (
          <EmptyState
            icon={Zap}
            title="No inspiration yet"
            description="Add content to get suggestions!"
          />
        )}

        {/* 2. Spark Card (Moved from FocusStream) */}
        {sparkCandidate ? (
          (() => {
            if (!sparkCandidate.id) {
              console.warn('Spark candidate missing ID', sparkCandidate)
              return null
            }
            const theme = getTheme(sparkCandidate.type || 'other', sparkCandidate.title)
            const nextTask = (sparkCandidate.metadata?.tasks || []).sort((a: any, b: any) => a.order - b.order).find((t: any) => !t.done)
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-5 relative overflow-hidden group cursor-pointer rounded-xl transition-all duration-300 border flex flex-col"
                onClick={() => navigate(`/projects/${sparkCandidate.id}`)}
                style={{
                  background: theme.backgroundColor,
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                  borderColor: theme.borderColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `rgba(${theme.rgb}, 0.15)`
                  e.currentTarget.style.borderColor = `rgba(${theme.rgb}, 0.4)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = theme.backgroundColor
                  e.currentTarget.style.borderColor = theme.borderColor
                }}
              >
                <div className="relative z-10 flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h3 className="text-lg font-bold text-[var(--brand-text-primary)] truncate">
                      {sparkCandidate.title}
                    </h3>
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-xl text-xs font-medium border flex items-center gap-1" style={{
                      backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                      color: theme.textColor,
                      borderColor: `rgba(${theme.rgb}, 0.3)`
                    }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.textColor }} /> Spark
                    </span>
                  </div>
                  <div className="p-4 rounded-xl mt-6 group-hover:bg-[var(--glass-surface)] transition-colors" style={{
                    backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                    border: `1px solid rgba(${theme.rgb}, 0.2)`
                  }}>
                    <p className="text-[10px] font-bold mb-2 uppercase tracking-wider opacity-50" style={{ color: theme.textColor }}>NEXT STEP</p>
                    <p className="text-sm text-gray-200 line-clamp-2 aperture-body">
                      {nextTask?.text || sparkCandidate.description || `Perfect for your current ${timeContextEnergy} energy.`}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })()
        ) : (
          // Placeholder if no Spark (e.g. "Suggest Projects" button could live here or be full width below)
          <Link
            to="/suggestions"
            className="group p-5 rounded-xl transition-all duration-300 border flex flex-col items-center justify-center text-center gap-3 h-full min-h-[200px]"
            style={{
              background: 'var(--glass-surface)',
              borderColor: 'var(--glass-surface)'
            }}
          >
            <div className="h-12 w-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-[var(--brand-primary)] mb-2">
              <Lightbulb className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-[var(--brand-text-primary)]">Need more ideas?</h3>
            <p className="text-sm text-[var(--brand-text-muted)]">Generate new project suggestions based on your interests.</p>
          </Link>
        )}

      </div>

      <div className="mt-6">
        <Link
          to="/suggestions"
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:bg-[rgba(255,255,255,0.1)] border border-[var(--glass-surface)] text-[var(--brand-primary)] aperture-header"
        >
          <Zap className="h-4 w-4" />
          {hasPendingSuggestions
            ? `${pendingSuggestionsCount} ${pendingSuggestionsCount === 1 ? 'idea' : 'ideas'} waiting to be reviewed`
            : "See all project suggestions"
          }
          <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </section>
  )
}



import { FocusStream } from '../components/home/FocusStream'

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects, loading: projectsLoading, updateProject } = useProjectStore()
  const { memories, fetchMemories, createMemory } = useMemoryStore()
  const { progress, requiredPrompts, fetchPrompts } = useOnboardingStore()
  const { setContext } = useContextEngineStore()
  const { completeChallenge, onboardingCompletedAt, graduated, startSession } = useJourneyStore()

  useEffect(() => {
    setContext('home', 'home', 'Home')
    // Track session start for journey
    if (onboardingCompletedAt && !graduated) {
      startSession()
    }
  }, [])

  // Auto-complete journey challenges based on user actions
  useEffect(() => {
    if (!onboardingCompletedAt || graduated) return

    // Voice note captured → Day 1
    const handleVoiceCapture = () => completeChallenge(1)
    // Article saved → Day 2
    const handleArticleSaved = () => completeChallenge(2)
    // Project created → Day 4
    const handleProjectCreated = () => completeChallenge(4)
    // Task completed → Day 5
    const handleTaskCompleted = () => completeChallenge(5)

    window.addEventListener('memory-created', handleVoiceCapture)
    window.addEventListener('article-saved', handleArticleSaved)
    window.addEventListener('projectEnriched', handleProjectCreated)
    window.addEventListener('task-completed', handleTaskCompleted)

    return () => {
      window.removeEventListener('memory-created', handleVoiceCapture)
      window.removeEventListener('article-saved', handleArticleSaved)
      window.removeEventListener('projectEnriched', handleProjectCreated)
      window.removeEventListener('task-completed', handleTaskCompleted)
    }
  }, [onboardingCompletedAt, graduated])

  const { addToast } = useToast()

  const [cardOfTheDay, setCardOfTheDay] = useState<Memory | null>(null)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  const [saveArticleOpen, setSaveArticleOpen] = useState(false)
  const [createThoughtOpen, setCreateThoughtOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [driftModeOpen, setDriftModeOpen] = useState(false)
  const [breakPrompts, setBreakPrompts] = useState<any[]>([])
  const [showMorningFollowUp, setShowMorningFollowUp] = useState(true)


  // Refetch data whenever user navigates to this page
  useEffect(() => {
    const loadData = async () => {
      try {
        // If we have no projects, wait for initial fetch
        if (projects.length === 0) {
          await fetchProjects()
        } else {
          // background refresh
          fetchProjects()
        }

        // Concurrent background fetches
        fetchSuggestions()
        fetchMemories()
        fetchCardOfTheDay()
        fetchPrompts()
      } catch (err) {
        console.error('Failed to load data on mount:', err)
      }
    }
    loadData()
  }, []) // Only on mount, rely on DataSynchronizer for the rest

  const handleOpenDrift = async () => {
    setDriftModeOpen(true)
    try {
      const response = await fetch('/api/projects?resource=break')
      const data = await response.json()
      if (data.prompts) {
        setBreakPrompts(data.prompts)
      }
    } catch (e) {
      console.error('Failed to fetch break prompts', e)
    }
  }


  // Show onboarding banner after delay if not completed
  useEffect(() => {
    if (progress && progress.completed_required < progress.total_required) {
      const timer = setTimeout(() => {
        setShowOnboardingBanner(true)
      }, 3000) // Slide in after 3 seconds

      return () => clearTimeout(timer)
    }
  }, [progress])

  const fetchCardOfTheDay = async () => {
    try {
      // Fetch more memories and select one based on today's date
      const response = await fetch('/api/memories?resurfacing=true&limit=10')
      if (response.ok) {
        const data = await response.json()
        if (data.memories && data.memories.length > 0) {
          // Use today's date as seed to pick a consistent memory for the day
          const today = new Date().toDateString()
          const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
          const index = seed % data.memories.length
          setCardOfTheDay(data.memories[index])
        }
      } else {
        // Silently fail - this is a nice-to-have feature
        console.log('[Card of the Day] Not available')
      }
    } catch (err) {
      // Silently fail - this is a nice-to-have feature
      console.log('[Card of the Day] Not available')
    }
  }

  // Safe filtering with error handling - compute during render so it updates when store changes
  const pendingSuggestions = Array.isArray(suggestions) ? suggestions.filter(s => s.status === 'pending') : []
  const activeProjects = Array.isArray(projects) ? projects.filter(p => p.status === 'active') : []

  // Find priority project and most recent project
  const priorityProject = activeProjects.find(p => p.is_priority) || null

  // Most recently updated (excluding priority if it exists)
  const recentProject = activeProjects
    .filter(p => p.id !== priorityProject?.id)
    .sort((a, b) => {
      const getTime = (dateStr?: string) => {
        if (!dateStr) return 0
        const ms = new Date(dateStr).getTime()
        return isNaN(ms) ? 0 : ms
      }
      const aTime = getTime(a.updated_at || a.last_active)
      const bTime = getTime(b.updated_at || b.last_active)
      return bTime - aTime
    })[0] || null

  // Projects to show in "Keep Momentum" section
  const projectsToShow = [priorityProject, recentProject].filter(Boolean) as Project[]


  // Spark Candidate Logic (Moved from FocusStream)
  const sparkCandidate = React.useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'active')
    if (activeProjects.length === 0) return null

    // Mock time context (could be a hook)
    const hour = new Date().getHours()
    let energy = 'moderate'
    if (hour >= 9 && hour < 12) energy = 'high'
    if (hour >= 14 && hour < 16) energy = 'low'
    if (hour >= 20) energy = 'low'

    // Filter by energy and prioritize those with tasks
    const matching = activeProjects.filter(p => {
      const nextTask = p.metadata?.tasks?.find((t: any) => !t.done)
      if (nextTask?.energy_level) return nextTask.energy_level === energy
      return (p.energy_level || 'moderate') === energy
    })

    const pool = matching.length > 0 ? matching : activeProjects

    // Sort pool so those with tasks are first
    const sortedPool = [...pool].sort((a, b) => {
      const aHasTasks = (a.metadata?.tasks?.some((t: any) => !t.done)) ? 1 : 0
      const bHasTasks = (b.metadata?.tasks?.some((t: any) => !t.done)) ? 1 : 0
      return bHasTasks - aHasTasks
    })

    // Deterministic "random" based on date to avoid flickering on re-renders
    const seed = new Date().getDate()
    return sortedPool[seed % sortedPool.length]
  }, [projects])

  // Get stored errors from localStorage
  const getStoredErrors = () => {
    try {
      const errors = localStorage.getItem('app_errors')
      return errors ? JSON.parse(errors) : []
    } catch {
      return []
    }
  }

  // Show error if initialization failed
  if (error) {
    return (
      <div className="min-h-screen py-12 px-4 flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="max-w-2xl w-full p-8 border-red-500/20 bg-brand-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-text-secondary">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold premium-text-platinum">Initialization Error</h2>
          </div>
          <p className="text-brand-text-secondary mb-8 font-mono text-sm p-4 bg-black/30 rounded-lg border border-red-500/10">
            {error}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-brand-primary text-[var(--brand-text-primary)] font-bold hover:bg-brand-primary transition-colors shadow-lg shadow-red-500/20"
            >
              Try Again
            </button>
            <Link to="/settings" className="text-brand-text-secondary/70 hover:text-brand-text-secondary underline text-sm transition-colors">
              Reset Application
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const storedErrors = getStoredErrors()
  const isDev = import.meta.env.DEV

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {/* Subtle Background Effect */}
      <SubtleBackground />
      {/* Debug Panel Toggle */}
      {isDev && storedErrors.length > 0 && (
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#ef4444', color: 'white' }}
        >
          <AlertCircle className="h-6 w-6" />
        </button>
      )}

      {/* Debug Panel */}
      <AnimatePresence>
        {isDev && showDebugPanel && storedErrors.length > 0 && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-40 max-h-96 overflow-y-auto p-4 bg-black/90"
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
          >
            <div className="max-w-4xl mx-auto text-brand-text-secondary font-mono text-xs">
              {storedErrors.map((e: any, i: number) => <div key={i} className="mb-2 p-2 bg-brand-primary/20 rounded-xl">{e.message}</div>)}
              <button onClick={() => { localStorage.removeItem('app_errors'); window.location.reload() }} className="mt-2 text-[var(--brand-text-primary)] underline">Clear & Reload</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-4 sm:px-6">
        <div
          className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between rounded-2xl"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-surface-hover)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}
        >
          <h1 className="text-xl sm:text-2xl aperture-header" style={{
            color: 'var(--brand-text-secondary)',
            opacity: 0.9
          }}>
            <BrandName className="inline" showLogo={true} />
          </h1>
          <button
            onClick={() => navigate('/search')}
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-all bg-[var(--glass-surface)] hover:bg-[var(--glass-surface-hover)] border border-[rgba(255,255,255,0.05)] text-[var(--brand-primary)] shadow-inner"
            title="Search everything"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>
        {/* Onboarding Banner - Slides in after delay */}
        <AnimatePresence>
          {showOnboardingBanner && progress && (
            <motion.div
              initial={{ opacity: 0, y: -80, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -80, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
            >
              <div className="p-6 relative rounded-2xl border border-[rgba(6,182,212,0.3)]" style={{
                background: 'rgba(6, 182, 212, 0.1)', // Cyan tint
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}>
                <button
                  onClick={() => setShowOnboardingBanner(false)}
                  className="absolute top-3 right-3 h-8 w-8 rounded-lg hover:bg-[rgba(255,255,255,0.1)] flex items-center justify-center transition-colors"
                  style={{ color: "var(--brand-primary)" }}
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-4 pr-10">
                  <div className="flex-1">
                    <h3 className="font-bold mb-1" style={{ color: "var(--brand-primary)" }}>
                      Complete Your Profile
                    </h3>
                    <p className="text-sm mb-3" style={{ color: "var(--brand-primary)" }}>
                      Answer a few questions to get personalized suggestions tailored to your interests
                    </p>
                    <Link
                      to="/onboarding"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all hover:opacity-90 brand-gradient text-brand-text-primary shadow-lg shadow-cyan-500/20"
                    >
                      Complete Now
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Morning Follow-Up */}
        {showMorningFollowUp && (
          <MorningFollowUp
            onDismiss={() => setShowMorningFollowUp(false)}
            onCapture={(text) => {
              // Create a memory from the morning insight
              createMemory({
                title: 'Morning insight',
                body: text,
                memory_type: 'insight',
                tags: ['morning-followup', 'bedtime-synthesis']
              }).catch(console.error)
            }}
          />
        )}

        {/* 1. ADD SOMETHING NEW */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 mt-4">

          <div className="flex items-center gap-3">
            {/* Voice Note */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('openVoiceCapture'))
              }}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group"
              title="Voice Note"
            >
              <Mic className="h-6 w-6 text-brand-primary group-hover:scale-110 transition-transform" />
            </button>

            {/* Written Thought */}
            <button
              onClick={() => setCreateThoughtOpen(true)}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group"
              title="Thought"
            >
              <Brain className="h-6 w-6 text-brand-primary group-hover:scale-110 transition-transform" />
            </button>

            {/* Article */}
            <button
              onClick={() => setSaveArticleOpen(true)}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group"
              title="Article"
            >
              <FileText className="h-6 w-6 text-brand-primary group-hover:scale-110 transition-transform" />
            </button>

            {/* Project */}
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group"
              title="Project"
            >
              <Layers className="h-6 w-6 text-brand-primary group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </section>

        {/* Journey Milestones — Day 1-7 progressive challenge (new users only) */}
        <JourneyMilestones />

        <CohesionSummaryWidget />

        {/* Aperture Power Hour - The Hero Engine */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 aperture-shelf">
          <PowerHourHero />
        </section>

        {/* Subtle Divider */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 opacity-20">
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Drift Mode Overlay */}
        {
          driftModeOpen && (
            <DriftMode
              mode="break"
              prompts={breakPrompts}
              onClose={() => setDriftModeOpen(false)}
            />
          )
        }

        {/* 2. KEEP THE MOMENTUM (Focus Stream) */}
        <div className="aperture-shelf">
          <FocusStream />
        </div>

        {/* 2b. AI COUNCIL  Multi-Perspective Next-Step Suggestions */}
        {(priorityProject || recentProject) && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 aperture-shelf">
            <div className="mb-0">
              <h2 className="section-header">
                council of <span>advisors</span>
              </h2>
            </div>
            <MultiPerspectiveSuggestions
              project={(priorityProject || recentProject)!}
              onAddTodo={async (text) => {
                const project = (priorityProject || recentProject)!
                // Append a new task to the project metadata and save
                const existing = project.metadata?.tasks || []
                const newTask = {
                  id: `task-${Date.now()}`,
                  text,
                  done: false,
                  created_at: new Date().toISOString(),
                  order: existing.length
                }
                try {
                  await fetch(`/api/projects?id=${project.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      metadata: {
                        ...project.metadata,
                        tasks: [...existing, newTask]
                      }
                    })
                  })
                  // Refresh projects in store
                  window.dispatchEvent(new CustomEvent('projectEnriched', { detail: { projectId: project.id } }))
                } catch (err) {
                  console.error('[HomePage] Failed to add AI todo:', err)
                }
              }}
            />
          </section>
        )}

        {/* 4. GET INSPIRATION (Glass Cards + Spark) */}
        <GetInspirationSection
          excludeProjectIds={projects.filter(p => p.status === 'active').map(p => p.id)}
          hasPendingSuggestions={pendingSuggestions.length > 0}
          pendingSuggestionsCount={pendingSuggestions.length}
          projectsLoading={projectsLoading}
          sparkCandidate={sparkCandidate}
          projects={projects}
        />

        {/* Tomorrow Hook — teaser for next day's challenge (journey users) */}
        <TomorrowHook />

        {/* 5. EXPLORE (Bottom Links) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 flex flex-col aperture-shelf">
          <div className="mb-0">
            <h2 className="section-header">
              or just <span>explore</span>
            </h2>
          </div>

          {/* Shadow Project — what they're really building */}
          <ShadowProjectCard />


          {/* Weekly Collision Report */}
          <div className="mb-6">
            <CollisionReport />
          </div>

          {/* Card of the Day - Resurfacing - Enhanced Design */}
          {cardOfTheDay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="glass-card glass-card-hover p-6 relative overflow-hidden mb-6 bg-white/[0.03] border-[var(--glass-surface)]"
              style={{
                boxShadow: '3px 3px 0 rgba(0,0,0,0.5)'
              }}
            >
              {/* Ambient glow effect */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, var(--brand-primary), transparent 60%)',
                  pointerEvents: 'none'
                }}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="font-bold text-lg aperture-header" style={{ color: "var(--brand-primary)" }}>
                    Thought of the day
                  </h3>
                </div>
                <p className="mb-4 leading-relaxed text-lg italic aperture-body" style={{
                  color: 'var(--brand-text-primary)',
                  fontWeight: 500
                }}>
                  "{cardOfTheDay.body}"
                </p>
                <div className="flex items-center gap-2 text-sm aperture-body" style={{ color: "var(--brand-primary)" }}>
                  <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--brand-secondary)' }} />
                  <span>From {new Date(cardOfTheDay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Grid: Mindset & Discovery Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {/* Bedtime Ideas */}
            <Link
              to="/bedtime"
              className="group p-5 glass-card glass-card-hover transition-all"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--glass-surface)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--brand-glass-bg)'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1 bg-[var(--glass-surface)] border-2 border-[var(--glass-surface-hover)]">
                    <Moon className="h-5 w-5 text-[var(--brand-text-secondary)]" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 aperture-header">Bedtime ideas</h3>
                    <p className="text-sm aperture-body text-[var(--brand-text-secondary)]">
                      Creative inspiration for sleep
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all text-[var(--brand-primary)]" />
              </div>
            </Link>

            {/* Drift Mode */}
            <button
              onClick={handleOpenDrift}
              className="group p-5 glass-card glass-card-hover transition-all text-left"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--glass-surface)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--brand-glass-bg)'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1 bg-[var(--glass-surface)] border-2 border-[var(--glass-surface-hover)]">
                    <Wind className="h-5 w-5 text-[var(--brand-text-secondary)]" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 aperture-header">Drift Mode</h3>
                    <p className="text-sm aperture-body text-[var(--brand-text-secondary)]">
                      Mental reset & hypnagogic insights
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all text-[var(--brand-primary)]" />
              </div>
            </button>

            {/* Discover Projects */}
            <Link
              to="/suggestions"
              className="group p-5 glass-card glass-card-hover transition-all"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--glass-surface)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--brand-glass-bg)'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1 bg-[var(--glass-surface)] border-2 border-[var(--glass-surface-hover)]">
                    <Lightbulb className="h-5 w-5 text-[var(--brand-text-secondary)]" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 aperture-header">Discover projects</h3>
                    <p className="text-sm aperture-body text-[var(--brand-text-secondary)]">
                      AI recommendations
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all text-[var(--brand-primary)]" />
              </div>
            </Link>

            {/* Analysis */}
            <Link
              to="/insights"
              className="group p-5 glass-card glass-card-hover transition-all"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--glass-surface)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--brand-glass-bg)'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1 bg-[var(--glass-surface)] border-2 border-[var(--glass-surface-hover)]">
                    <TrendingUp className="h-5 w-5 text-[var(--brand-text-secondary)]" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 aperture-header">Analysis</h3>
                    <p className="text-sm aperture-body text-[var(--brand-text-secondary)]">
                      Patterns & Insights
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all text-[var(--brand-primary)]" />
              </div>
            </Link>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 flex justify-center">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all border-2 border-[var(--glass-surface-hover)] hover:bg-[var(--glass-surface)] glass-card glass-card-hover text-sm font-medium"
            style={{
              boxShadow: '3px 3px 0 rgba(0,0,0,0.5)'
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
            More Settings
          </Link>
        </div>

      </div>

      {/* Dialogs  controlled open/close via state */}
      <SaveArticleDialog open={saveArticleOpen} onClose={() => setSaveArticleOpen(false)} />
      <CreateMemoryDialog isOpen={createThoughtOpen} onOpenChange={setCreateThoughtOpen} hideTrigger />
      <CreateProjectDialog isOpen={createProjectOpen} onOpenChange={setCreateProjectOpen} hideTrigger />
    </motion.div>
  )
}