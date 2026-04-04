/**
 * Home Page
 * 1. Add something new - voice, thought, article, project
 * 2. Keep the momentum - Power Hour, Focus Stream, Council of Advisors
 * 3. Explore - shadow project, collisions, card of the day, nav grid
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
import { Layers, ArrowRight, Plus, Mic, FileText, FolderKanban, Search, TrendingUp, Moon, Calendar, Zap, Brain, X, AlertCircle, Check, Lightbulb, RefreshCw, Wind, Rss, Map as MapIcon, MoreHorizontal, Film, Music, Monitor, Book, MapPin, Gamepad2, Quote, Box } from 'lucide-react'
import { MultiPerspectiveSuggestions } from '../components/suggestions/MultiPerspectiveSuggestions'
import { BrandName } from '../components/BrandName'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { SubtleBackground } from '../components/SubtleBackground'
import { DriftMode } from '../components/bedtime/DriftMode'
import { MorningFollowUp } from '../components/bedtime/MorningFollowUp'
import { CollisionReport } from '../components/home/CollisionReport'
import { ShadowProjectCard } from '../components/home/ShadowProjectCard'
import { PowerHourHero } from '../components/home/PowerHourHero'
import type { Memory, Project, SynthesisInsight } from '../types'
import { CohesionSummaryWidget } from '../components/home/CohesionSummaryWidget'
import { JourneyMilestones } from '../components/home/JourneyMilestones'
import { TomorrowHook } from '../components/home/TomorrowHook'
import { PolymathProfileCard } from '../components/home/PolymathProfileCard'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { useListStore } from '../stores/useListStore'

import { FocusStream } from '../components/home/FocusStream'

const LIST_TYPE_ICONS: Record<string, React.ElementType> = {
  film: Film, music: Music, tech: Monitor, book: Book, place: MapPin,
  game: Gamepad2, event: Calendar, quote: Quote, article: FileText,
  software: Monitor, generic: Box,
}

function NowConsumingWidget() {
  const { lists, fetchLists } = useListStore()
  const [activeItems, setActiveItems] = useState<{ listId: string; listTitle: string; listType: string; itemId: string; itemContent: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (lists.length === 0) fetchLists()
  }, [])

  useEffect(() => {
    if (lists.length === 0) return

    const fetchActiveItems = async () => {
      const results: typeof activeItems = []
      // Fetch items for each list and filter for active
      for (const list of lists.slice(0, 10)) {
        try {
          const res = await fetch(`/api/lists?scope=items&listId=${list.id}&limit=10`)
          if (!res.ok) continue
          const items = await res.json()
          for (const item of items) {
            if (item.status === 'active') {
              results.push({
                listId: list.id,
                listTitle: list.title,
                listType: list.type,
                itemId: item.id,
                itemContent: item.content,
              })
            }
          }
        } catch {}
      }
      setActiveItems(results)
      setLoaded(true)
    }
    fetchActiveItems()
  }, [lists])

  if (!loaded || activeItems.length === 0) return null

  const shown = activeItems.slice(0, 4)

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
      <h2 className="section-header">
        now <span>consuming</span>
      </h2>
      <div className="flex flex-col gap-2">
        {shown.map((item) => {
          const Icon = LIST_TYPE_ICONS[item.listType] || Box
          return (
            <Link
              key={item.itemId}
              to={`/lists/${item.listId}`}
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[var(--glass-surface)] border border-[var(--glass-surface)]"
            >
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] flex-shrink-0">
                <Icon className="h-4 w-4 text-[var(--brand-text-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--brand-text-primary)] truncate">{item.itemContent}</p>
                <p className="text-[10px] text-[var(--brand-text-secondary)] opacity-50">{item.listTitle}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--brand-text-secondary)] opacity-30 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects, loading: projectsLoading, updateProject } = useProjectStore()
  const { memories, fetchMemories, createMemory } = useMemoryStore()
  const { progress, requiredPrompts, fetchPrompts } = useOnboardingStore()
  const { setContext } = useContextEngineStore()
  const { completeChallenge, onboardingCompletedAt, graduated, startSession, incrementDataPoints } = useJourneyStore()

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
          // Trust server ranking — first result is the best pick
          setCardOfTheDay(data.memories[0])
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
              className="flex-1 h-14 glass-button hover:bg-brand-surface group flex flex-col items-center justify-center gap-1"
              title="Voice Note"
            >
              <Mic className="h-5 w-5 text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] text-white/50">Voice</span>
            </button>

            {/* Written Thought */}
            <button
              onClick={() => setCreateThoughtOpen(true)}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group flex flex-col items-center justify-center gap-1"
              title="Thought"
            >
              <Brain className="h-5 w-5 text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] text-white/50">Thought</span>
            </button>

            {/* Article */}
            <button
              onClick={() => setSaveArticleOpen(true)}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group flex flex-col items-center justify-center gap-1"
              title="Article"
            >
              <FileText className="h-5 w-5 text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] text-white/50">Article</span>
            </button>

            {/* Project */}
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="flex-1 h-14 glass-button hover:bg-brand-surface group flex flex-col items-center justify-center gap-1"
              title="Project"
            >
              <Layers className="h-5 w-5 text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] text-white/50">Project</span>
            </button>
          </div>
        </section>

        {/* Journey Milestones — Day 1-7 progressive challenge (new users only) */}
        <JourneyMilestones />

        {/* Polymath Profile — what the system knows + nudge for more data (graduated users) */}
        <PolymathProfileCard />

        {/* Aperture Power Hour - The Hero Engine */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 aperture-shelf">
          <PowerHourHero />
        </section>

        <CohesionSummaryWidget />

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

        {/* Now Consuming — active list items */}
        <NowConsumingWidget />

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

        {/* Pending suggestions banner — moved from GetInspirationSection */}
        {pendingSuggestions.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <Link
              to="/suggestions"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:bg-[rgba(255,255,255,0.1)] border border-[var(--glass-surface)] text-[var(--brand-primary)] aperture-header"
            >
              <Zap className="h-4 w-4" />
              {`${pendingSuggestions.length} ${pendingSuggestions.length === 1 ? 'idea' : 'ideas'} waiting to be reviewed`}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </section>
        )}

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