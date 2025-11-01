/**
 * Home Page - 4-Pillar Architecture
 * 1. Keep the momentum - next steps on priority/recent projects
 * 2. Add something new - voice, thought, article, project
 * 3. Get inspiration - AI suggestions
 * 4. Explore - timeline, constellation, card of the day
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOnboardingStore } from '../stores/useOnboardingStore'
import { SmartSuggestionWidget } from '../components/SmartSuggestionWidget'
import { SaveArticleDialog } from '../components/reading/SaveArticleDialog'
import { CreateMemoryDialog } from '../components/memories/CreateMemoryDialog'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import {
  Rocket,
  ArrowRight,
  Plus,
  Mic,
  FileText,
  FolderKanban,
  Sparkles,
  Search,
  TrendingUp,
  Network,
  Calendar,
  Zap,
  Brain,
  X,
  AlertCircle
} from 'lucide-react'
import { BrandName } from '../components/BrandName'
import type { ProjectScore, DailyQueueResponse, Memory } from '../types'

export function HomePage() {
  const navigate = useNavigate()

  // Wrap store hooks in try-catch for safety
  let suggestions: any[] = []
  let fetchSuggestions = () => {}
  let projects: any[] = []
  let fetchProjects = () => {}
  let memories: any[] = []
  let fetchMemories = () => {}
  let progress: any = null
  let requiredPrompts: any[] = []
  let fetchPrompts = () => {}

  try {
    const suggestionStore = useSuggestionStore()
    suggestions = suggestionStore.suggestions || []
    fetchSuggestions = suggestionStore.fetchSuggestions

    const projectStore = useProjectStore()
    projects = projectStore.projects || []
    fetchProjects = projectStore.fetchProjects

    const memoryStore = useMemoryStore()
    memories = memoryStore.memories || []
    fetchMemories = memoryStore.fetchMemories

    const onboardingStore = useOnboardingStore()
    progress = onboardingStore.progress
    requiredPrompts = onboardingStore.requiredPrompts || []
    fetchPrompts = onboardingStore.fetchPrompts
  } catch (err) {
    console.error('[HomePage] Store initialization error:', err)
  }

  const [dailyQueue, setDailyQueue] = useState<ProjectScore[]>([])
  const [cardOfTheDay, setCardOfTheDay] = useState<Memory | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  const [saveArticleOpen, setSaveArticleOpen] = useState(false)
  const [createThoughtOpen, setCreateThoughtOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      console.log('[HomePage] Starting data load...')
      try {
        console.log('[HomePage] Fetching suggestions...')
        fetchSuggestions()

        console.log('[HomePage] Fetching projects...')
        fetchProjects()

        console.log('[HomePage] Fetching memories...')
        fetchMemories()

        console.log('[HomePage] Fetching daily queue...')
        await fetchDailyQueue()

        console.log('[HomePage] Fetching card of the day...')
        await fetchCardOfTheDay()

        console.log('[HomePage] Fetching prompts...')
        fetchPrompts()

        console.log('[HomePage] All data loaded successfully')
      } catch (err) {
        console.error('[HomePage] Error loading data:', err)
        setError(`Failed to load data: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    loadData().catch(err => {
      console.error('[HomePage] Uncaught error in loadData:', err)
      setError(`Uncaught error: ${err instanceof Error ? err.message : String(err)}`)
    })
  }, [])

  // Show onboarding banner if not completed
  useEffect(() => {
    if (progress && progress.completed_required < progress.total_required) {
      setShowOnboardingBanner(true)
    }
  }, [progress])

  const fetchDailyQueue = async () => {
    setQueueLoading(true)
    try {
      const response = await fetch('/api/projects?resource=daily-queue')
      if (response.ok) {
        const data: DailyQueueResponse = await response.json()
        setDailyQueue(data.queue.slice(0, 2)) // Top 2 for homepage
      }
    } catch (err) {
      console.error('Failed to fetch daily queue:', err)
    } finally {
      setQueueLoading(false)
    }
  }

  const fetchCardOfTheDay = async () => {
    try {
      const response = await fetch('/api/memories?resurfacing=true&limit=1')
      if (response.ok) {
        const data = await response.json()
        if (data.memories && data.memories.length > 0) {
          setCardOfTheDay(data.memories[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch card of the day:', err)
    }
  }

  // Safe filtering with error handling
  let pendingSuggestions: any[] = []
  let activeProjects: any[] = []
  let priorityProject: any = null
  let recentProject: any = null

  try {
    pendingSuggestions = Array.isArray(suggestions) ? suggestions.filter(s => s.status === 'pending') : []
    activeProjects = Array.isArray(projects) ? projects.filter(p => p.status === 'active') : []
    priorityProject = Array.isArray(projects) ? projects.find(p => p.priority && p.status === 'active') : null
    recentProject = activeProjects.length > 0
      ? activeProjects
          .filter(p => !p.priority)
          .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime())[0]
      : null
  } catch (err) {
    console.error('[HomePage] Error filtering data:', err)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot_streak': return 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(239, 68, 68, 0.9))'
      case 'needs_attention': return 'linear-gradient(135deg, rgba(251, 191, 36, 0.9), rgba(59, 130, 246, 0.9))'
      case 'fresh_energy': return 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(236, 72, 153, 0.9))'
      default: return 'linear-gradient(135deg, rgba(107, 114, 128, 0.7), rgba(156, 163, 175, 0.7))'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'hot_streak': return 'Streak'
      case 'needs_attention': return 'Attention'
      case 'fresh_energy': return 'Fresh'
      default: return 'Available'
    }
  }

  const formatTime = (minutes?: number) => {
    if (!minutes) return '~1 hour'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`
  }

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
    const storedErrors = getStoredErrors()
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-2xl mx-auto premium-card p-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#ef4444' }}>
            Initialization Error
          </h2>
          <div className="p-4 rounded-lg mb-4 text-sm font-mono" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            {error}
          </div>

          {/* Show stored errors if any */}
          {storedErrors.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2" style={{ color: '#ef4444' }}>
                Recent Errors ({storedErrors.length}):
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {storedErrors.reverse().map((err: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg text-xs font-mono" style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <div className="mb-1 font-bold">{err.timestamp}</div>
                    <div className="mb-1">Type: {err.type}</div>
                    {err.message && <div className="mb-1">Message: {err.message}</div>}
                    {err.reason && <div className="mb-1">Reason: {err.reason}</div>}
                    {err.filename && <div className="mb-1">File: {err.filename}:{err.lineno}:{err.colno}</div>}
                    {err.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer hover:underline">Stack Trace</summary>
                        <pre className="mt-1 text-xs overflow-x-auto">{err.stack}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('app_errors')
                  window.location.reload()
                }}
                className="mt-3 px-4 py-2 rounded-lg font-medium text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                Clear Errors & Reload
              </button>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              backgroundColor: 'var(--premium-blue)',
              color: 'white'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  const storedErrors = getStoredErrors()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Debug Panel Toggle - Only show if there are errors */}
      {storedErrors.length > 0 && (
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full flex items-center justify-center shadow-lg"
          style={{
            backgroundColor: '#ef4444',
            color: 'white'
          }}
          title={`${storedErrors.length} error(s) detected`}
        >
          <AlertCircle className="h-6 w-6" />
        </button>
      )}

      {/* Debug Panel */}
      <AnimatePresence>
        {showDebugPanel && storedErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 z-40 max-h-96 overflow-y-auto p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: '#ef4444' }}>
                  Debug Info - {storedErrors.length} Error(s)
                </h3>
                <button
                  onClick={() => setShowDebugPanel(false)}
                  className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                  style={{ color: '#ef4444' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                {storedErrors.reverse().map((err: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg text-xs font-mono" style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <div className="mb-1 font-bold">{err.timestamp}</div>
                    <div className="mb-1">Type: {err.type}</div>
                    {err.message && <div className="mb-1">Message: {err.message}</div>}
                    {err.reason && <div className="mb-1">Reason: {err.reason}</div>}
                    {err.filename && <div className="mb-1">File: {err.filename}:{err.lineno}:{err.colno}</div>}
                    {err.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer hover:underline">Stack Trace</summary>
                        <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">{err.stack}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('app_errors')
                  setShowDebugPanel(false)
                  window.location.reload()
                }}
                className="mt-4 w-full px-4 py-2 rounded-lg font-medium"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                Clear All Errors & Reload
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen py-6 pb-24">
        {/* Header with Search */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="premium-text-platinum flex-1 text-center text-4xl sm:text-5xl" style={{
              fontWeight: 700,
              letterSpacing: 'var(--premium-tracking-tight)'
            }}>
              <BrandName className="inline" />
            </h1>
            <button
              onClick={() => navigate('/search')}
              className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-white/5"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.2)',
                color: 'var(--premium-blue)'
              }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Onboarding Banner - Persistent until completed */}
        <AnimatePresence>
          {showOnboardingBanner && progress && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6"
            >
              <div className="premium-card border-2 p-4 relative" style={{
                borderColor: 'rgba(251, 191, 36, 0.5)',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(59, 130, 246, 0.1))'
              }}>
                <button
                  onClick={() => setShowOnboardingBanner(false)}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                  style={{ color: 'var(--premium-text-tertiary)' }}
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-3 pr-8">
                  <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--premium-amber)' }} />
                  <div className="flex-1">
                    <h3 className="font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                      Complete Your Profile
                      <span className="text-sm px-2 py-0.5 rounded-full" style={{
                        backgroundColor: 'rgba(251, 191, 36, 0.2)',
                        color: 'var(--premium-amber)'
                      }}>
                        {progress.completed_required}/{progress.total_required}
                      </span>
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                      Answer {requiredPrompts.length} foundational questions to unlock personalized suggestions
                    </p>
                    <Link
                      to="/onboarding"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:bg-white/10"
                      style={{
                        backgroundColor: 'rgba(251, 191, 36, 0.2)',
                        color: 'var(--premium-amber)',
                        border: '1px solid rgba(251, 191, 36, 0.3)'
                      }}
                    >
                      Complete Now <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. KEEP THE MOMENTUM */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="premium-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Rocket className="h-7 w-7" style={{ color: 'var(--premium-blue)' }} />
              <h2 className="text-2xl font-bold premium-text-platinum">Keep the Momentum</h2>
            </div>

            {queueLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent" style={{ borderColor: 'var(--premium-blue)' }}></div>
              </div>
            ) : (priorityProject || recentProject) ? (
              <div className="space-y-4">
                {[priorityProject, recentProject].filter(Boolean).map((project) => {
                  // Get first incomplete task from the tasks array
                  const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; order: number }>
                  const nextTask = tasks
                    .sort((a, b) => a.order - b.order)
                    .find(task => !task.done)
                  const nextStep = nextTask?.text

                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="group block premium-glass-subtle p-4 rounded-xl transition-all duration-300 hover:bg-white/10"
                    >
                      {/* Project Title with Chip */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="premium-text-platinum font-bold text-lg flex-1">{project.title}</h3>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm flex-shrink-0"
                          style={{ background: project.priority ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.9), rgba(59, 130, 246, 0.9))' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(236, 72, 153, 0.9))' }}
                        >
                          {project.priority ? 'Priority' : 'Recent'}
                        </span>
                      </div>

                      {/* Next Step - Always Show */}
                      <div className="rounded-lg p-3 mb-2 border-2" style={{
                        backgroundColor: nextStep ? 'rgba(251, 191, 36, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                        borderColor: nextStep ? 'rgba(251, 191, 36, 0.4)' : 'rgba(107, 114, 128, 0.3)'
                      }}>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: nextStep ? 'var(--premium-amber)' : 'var(--premium-text-tertiary)' }}>
                          NEXT ACTION
                        </div>
                        <div className="premium-text-platinum font-medium text-sm">
                          {nextStep || 'No tasks yet - click to add one'}
                        </div>
                      </div>
                    </Link>
                  )
                })}

                <Link
                  to="/projects"
                  className="block text-center py-3 rounded-lg font-medium transition-all hover:bg-white/5"
                  style={{ color: 'var(--premium-blue)' }}
                >
                  View All Projects <ArrowRight className="inline h-4 w-4 ml-1" />
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                  No active projects yet. Create one to get started!
                </p>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:bg-white/5"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: 'var(--premium-blue)',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Go to Projects <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 2. ADD SOMETHING NEW */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="premium-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Plus className="h-7 w-7" style={{ color: 'var(--premium-indigo)' }} />
              <h2 className="text-2xl font-bold premium-text-platinum">Add Something New</h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Voice Note */}
              <button
                onClick={() => {
                  const voiceFab = document.querySelector('[data-voice-fab]') as HTMLButtonElement
                  if (voiceFab) voiceFab.click()
                }}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
                title="Voice Note"
              >
                <Mic className="h-6 w-6" style={{ color: 'var(--premium-indigo)' }} />
              </button>

              {/* Written Thought */}
              <button
                onClick={() => setCreateThoughtOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
                title="Thought"
              >
                <Brain className="h-6 w-6" style={{ color: 'var(--premium-indigo)' }} />
              </button>

              {/* Article */}
              <button
                onClick={() => setSaveArticleOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
                title="Article"
              >
                <FileText className="h-6 w-6" style={{ color: 'var(--premium-emerald)' }} />
              </button>

              {/* Project */}
              <button
                onClick={() => setCreateProjectOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
                title="Project"
              >
                <FolderKanban className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>
            </div>
          </div>
        </section>

        {/* 3. GET INSPIRATION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="premium-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="h-7 w-7" style={{ color: 'var(--premium-amber)' }} />
              <h2 className="text-2xl font-bold premium-text-platinum">Get Inspiration</h2>
            </div>

            {pendingSuggestions.length > 0 ? (
              <div className="space-y-4">
                {/* Smart Suggestion Widget */}
                <SmartSuggestionWidget />

                <Link
                  to="/suggestions"
                  className="block text-center py-3 rounded-lg font-medium transition-all hover:bg-white/5"
                  style={{ color: 'var(--premium-amber)' }}
                >
                  View All Suggestions ({pendingSuggestions.length}) <ArrowRight className="inline h-4 w-4 ml-1" />
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--premium-amber)', opacity: 0.5 }} />
                <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                  No suggestions yet. Complete your onboarding to get personalized project ideas!
                </p>
                <Link
                  to="/suggestions"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:bg-white/5"
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.2)',
                    color: 'var(--premium-amber)',
                    border: '1px solid rgba(251, 191, 36, 0.3)'
                  }}
                >
                  Generate Suggestions <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 4. EXPLORE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="premium-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-7 w-7" style={{ color: 'var(--premium-emerald)' }} />
              <h2 className="text-2xl font-bold premium-text-platinum">Explore</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Timeline */}
              <Link
                to="/knowledge-timeline"
                className="group premium-glass-subtle p-5 rounded-xl transition-all hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-6 w-6 mt-1" style={{ color: 'var(--premium-blue)' }} />
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Timeline</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        See your knowledge journey
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-blue)' }} />
                </div>
              </Link>

              {/* Constellation */}
              <Link
                to="/constellation"
                className="group premium-glass-subtle p-5 rounded-xl transition-all hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Network className="h-6 w-6 mt-1" style={{ color: 'var(--premium-indigo)' }} />
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Constellation</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        Explore your knowledge graph
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-indigo)' }} />
                </div>
              </Link>
            </div>

            {/* Card of the Day - Resurfacing */}
            {cardOfTheDay && (
              <div className="premium-glass-subtle p-5 rounded-xl border-2" style={{
                borderColor: 'rgba(139, 92, 246, 0.3)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))'
              }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5" style={{ color: 'var(--premium-purple)' }} />
                  <h3 className="font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                    Card of the Day
                  </h3>
                </div>
                <p className="mb-3 leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                  {cardOfTheDay.body}
                </p>
                <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                  From {new Date(cardOfTheDay.created_at).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Dialogs */}
      <SaveArticleDialog open={saveArticleOpen} onClose={() => setSaveArticleOpen(false)} />

      {/* Hidden trigger buttons for dialogs */}
      <div style={{ display: 'none' }}>
        <div ref={(el) => { if (el && createThoughtOpen) { el.querySelector('button')?.click(); setCreateThoughtOpen(false) } }}>
          <CreateMemoryDialog />
        </div>
        <div ref={(el) => { if (el && createProjectOpen) { el.querySelector('button')?.click(); setCreateProjectOpen(false) } }}>
          <CreateProjectDialog />
        </div>
      </div>
    </motion.div>
  )
}
