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
  AlertCircle,
  Check
} from 'lucide-react'
import { BrandName } from '../components/BrandName'
import type { Memory, Project } from '../types'

interface InspirationData {
  type: 'article' | 'thought' | 'project' | 'empty'
  title: string
  description: string
  url?: string
  reasoning: string
}

function GetInspirationSection({ excludeProjectIds, hasPendingSuggestions, pendingSuggestionsCount }: {
  excludeProjectIds: string[]
  hasPendingSuggestions: boolean
  pendingSuggestionsCount: number
}) {
  const [inspiration, setInspiration] = useState<InspirationData | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchInspiration = async () => {
      try {
        const excludeParam = excludeProjectIds.length > 0 ? `&exclude=${excludeProjectIds.join(',')}` : ''
        const response = await fetch(`/api/analytics?resource=inspiration${excludeParam}`)
        if (response.ok) {
          const data = await response.json()
          setInspiration(data)
        }
      } catch (error) {
        console.error('Failed to fetch inspiration:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInspiration()
  }, [excludeProjectIds.join(',')])

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'article':
        return { icon: FileText, color: 'var(--premium-emerald)' }
      case 'thought':
        return { icon: Brain, color: 'var(--premium-indigo)' }
      case 'project':
        return { icon: FolderKanban, color: 'var(--premium-blue)' }
      default:
        return { icon: Sparkles, color: 'var(--premium-amber)' }
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
      <div className="p-6 rounded-xl backdrop-blur-xl" style={{
        background: 'rgba(25, 35, 55, 0.6)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="mb-5">
          <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>Get Inspiration</h2>
        </div>

        {loading ? (
          <div className="premium-glass-subtle p-3 rounded-xl animate-pulse">
            {/* Skeleton loader - compact */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded bg-white/10"></div>
                <div className="h-5 bg-white/10 rounded w-2/3"></div>
              </div>
              <div className="h-4 bg-white/10 rounded w-full"></div>
              <div className="h-4 bg-white/10 rounded w-4/5"></div>
            </div>
          </div>
        ) : inspiration && inspiration.type !== 'empty' ? (
          <div className="space-y-3">
            {inspiration.url ? (
              <Link
                to={inspiration.url}
                className="group block p-3 rounded-xl transition-all duration-300"
                style={{
                  background: 'rgba(30, 42, 88, 0.6)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 42, 88, 0.8)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 42, 88, 0.6)'
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs flex-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {inspiration.reasoning}
                    </p>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: getIconAndColor(inspiration.type).color }} />
                  </div>
                  <h3 className="premium-text-platinum font-bold text-base line-clamp-2">
                    {inspiration.title}
                  </h3>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                    {inspiration.description}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="p-3 rounded-xl" style={{
                background: 'rgba(30, 42, 88, 0.6)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <div className="space-y-2">
                  <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                    {inspiration.reasoning}
                  </p>
                  <h3 className="premium-text-platinum font-bold text-base">
                    {inspiration.title}
                  </h3>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                    {inspiration.description}
                  </p>
                </div>
              </div>
            )}

            {hasPendingSuggestions && (
              <Link
                to="/suggestions"
                className="block text-center py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
                style={{ color: 'var(--premium-blue)' }}
              >
                View Project Suggestions ({pendingSuggestionsCount}) <ArrowRight className="inline h-4 w-4 ml-1" />
              </Link>
            )}
          </div>
        ) : (
          <div className="premium-glass-subtle p-4 rounded-xl text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--premium-amber)', opacity: 0.5 }} />
            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
              No content to inspire from yet. Add thoughts, articles, or projects!
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Wrap store hooks in try-catch for safety
  let suggestions: any[] = []
  let fetchSuggestions = () => {}
  let projects: any[] = []
  let projectsLoading = false
  let fetchProjects = () => {}
  let updateProject = async (_id: string, _data: Partial<Project>) => {}
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
    projectsLoading = projectStore.loading
    fetchProjects = projectStore.fetchProjects
    updateProject = projectStore.updateProject

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

  const { addToast } = useToast()

  const [cardOfTheDay, setCardOfTheDay] = useState<Memory | null>(null)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  const [saveArticleOpen, setSaveArticleOpen] = useState(false)
  const [createThoughtOpen, setCreateThoughtOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Refetch data whenever user navigates to this page
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchProjects()
        fetchSuggestions()
        fetchMemories()
        await fetchCardOfTheDay()
        fetchPrompts()
        setRefreshKey(k => k + 1)
      } catch (err) {
        setError(`Failed to load data: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

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
      const aTime = new Date(a.updated_at || a.last_active).getTime()
      const bTime = new Date(b.updated_at || b.last_active).getTime()
      return bTime - aTime
    })[0] || null

  // Projects to show in "Keep Momentum" section
  const projectsToShow = [priorityProject, recentProject].filter(Boolean) as Project[]

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
  const isDev = import.meta.env.DEV

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {/* Debug Panel Toggle - Only show in development if there are errors */}
      {isDev && storedErrors.length > 0 && (
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
        {isDev && showDebugPanel && storedErrors.length > 0 && (
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

      {/* Fixed Header Bar - Brand & Search */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.05)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl" style={{
            fontWeight: 600,
            letterSpacing: 'var(--premium-tracking-tight)',
            color: 'var(--premium-text-secondary)',
            opacity: 0.7
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
              <div className="premium-card p-6 relative" style={{
                background: 'rgba(15, 85, 135, 0.15)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}>
                <button
                  onClick={() => setShowOnboardingBanner(false)}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                  style={{ color: 'var(--premium-text-tertiary)' }}
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-4 pr-10">
                  <div className="flex-1">
                    <h3 className="font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                      Complete Your Profile
                      <span className="text-sm px-2 py-0.5 rounded-full" style={{
                        backgroundColor: 'rgba(15, 85, 135, 0.3)',
                        color: 'rgba(15, 85, 135, 0.9)'
                      }}>
                        {progress.completed_required}/{progress.total_required}
                      </span>
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                      Answer {requiredPrompts.length} foundational questions to unlock personalized suggestions
                    </p>
                    <Link
                      to="/onboarding"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:opacity-90"
                      style={{
                        backgroundColor: 'rgba(15, 85, 135, 0.6)',
                        color: 'rgba(200, 240, 255, 0.95)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Complete Now
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. ADD SOMETHING NEW */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'rgba(25, 35, 55, 0.6)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="mb-4">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>Add Something New</h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Voice Note */}
              <button
                onClick={() => {
                  const voiceFab = document.querySelector('[data-voice-fab]') as HTMLButtonElement
                  if (voiceFab) voiceFab.click()
                }}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: 'rgba(30, 42, 88, 0.8)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(38, 50, 96, 0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 42, 88, 0.8)'}
                title="Voice Note"
              >
                <Mic className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Written Thought */}
              <button
                onClick={() => setCreateThoughtOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: 'rgba(30, 42, 88, 0.8)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(38, 50, 96, 0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 42, 88, 0.8)'}
                title="Thought"
              >
                <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Article */}
              <button
                onClick={() => setSaveArticleOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: 'rgba(30, 42, 88, 0.8)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(38, 50, 96, 0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 42, 88, 0.8)'}
                title="Article"
              >
                <FileText className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Project */}
              <button
                onClick={() => setCreateProjectOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: 'rgba(30, 42, 88, 0.8)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(38, 50, 96, 0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 42, 88, 0.8)'}
                title="Project"
              >
                <FolderKanban className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>
            </div>
          </div>
        </section>

        {/* 2. KEEP THE MOMENTUM (Compact) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'rgba(25, 35, 55, 0.6)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="mb-5">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>Keep the Momentum</h2>
            </div>

            {projectsLoading ? (
              <div className="space-y-3">
                {/* Skeleton loaders - compact */}
                {[1, 2].map((i) => (
                  <div key={i} className="premium-glass-subtle p-3 rounded-xl animate-pulse">
                    {/* Title skeleton */}
                    <div className="h-5 bg-white/10 rounded-lg w-2/3 mb-2"></div>
                    {/* Next Action box skeleton */}
                    <div className="rounded-lg p-2 border border-white/10 bg-white/5">
                      <div className="h-3 bg-white/10 rounded w-4/5"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : projectsToShow.length > 0 ? (
              <div className="space-y-3">
                {projectsToShow.map((project) => {
                  // Get first incomplete task from the tasks array
                  const tasks = (project.metadata?.tasks || []) as Array<{ id: string; text: string; done: boolean; created_at: string; order: number }>
                  const nextTask = tasks
                    .sort((a, b) => a.order - b.order)
                    .find(task => !task.done)
                  const nextStep = nextTask?.text

                  // Calculate progress
                  const totalTasks = tasks.length
                  const completedTasks = tasks.filter(t => t.done).length
                  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="group block p-4 rounded-xl transition-all duration-300"
                      style={{
                        background: 'rgba(30, 42, 88, 0.6)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(30, 42, 88, 0.8)'
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(30, 42, 88, 0.6)'
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      {/* Project Title & Priority Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="premium-text-platinum font-bold text-base flex-1">
                          {project.title}
                        </h3>

                        {project.is_priority && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="h-2 w-2 rounded-full" style={{
                              backgroundColor: 'var(--premium-blue)',
                              boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)'
                            }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--premium-blue)' }}>
                              Priority
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Next Step - Interactive with Checkbox */}
                      <div
                        className="rounded-lg p-2.5 flex items-center justify-between gap-2"
                        style={{
                          backgroundColor: 'rgba(15, 85, 135, 0.3)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {nextTask ? (
                          <div className="flex items-start gap-2.5 flex-1">
                            <button
                              onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const updatedTasks = tasks.map(t =>
                                  t.id === nextTask.id ? { ...t, done: true } : t
                                )
                                try {
                                  await updateProject(project.id, {
                                    metadata: { ...project.metadata, tasks: updatedTasks }
                                  })
                                  addToast({ title: '✓ Task complete!', description: nextTask.text, variant: 'success' })
                                  haptic.success()
                                } catch (error) {
                                  console.error('Failed to complete task:', error)
                                  addToast({ title: 'Failed to complete task', variant: 'destructive' })
                                }
                              }}
                              className="flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all hover:bg-blue-500/20 hover:border-blue-500"
                              style={{
                                borderColor: 'rgba(59, 130, 246, 0.6)',
                                color: 'rgba(59, 130, 246, 0.9)'
                              }}
                              title="Mark as complete"
                            >
                              <Check className="h-3 w-3 opacity-0 hover:opacity-100" />
                            </button>
                            <div className="premium-text-platinum font-medium text-sm flex-1">
                              {nextStep}
                            </div>
                          </div>
                        ) : (
                          <div className="premium-text-platinum font-medium text-sm flex-1">
                            No tasks yet - click to add one
                          </div>
                        )}
                        {totalTasks > 0 && (
                          <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--premium-text-tertiary)' }}>
                            {completedTasks}/{totalTasks}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}

                <Link
                  to="/projects"
                  className="block text-center py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
                  style={{ color: 'var(--premium-blue)' }}
                >
                  View All Projects <ArrowRight className="inline h-4 w-4 ml-1" />
                </Link>
              </div>
            ) : (
              <div className="premium-glass-subtle p-4 rounded-xl text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full mb-3" style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <Rocket className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                </div>
                <h3 className="font-bold mb-2 premium-text-platinum text-sm">Ready to build something?</h3>
                <p className="mb-3 text-xs max-w-md mx-auto" style={{ color: 'var(--premium-text-secondary)' }}>
                  Projects are where ideas become reality.
                </p>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: 'var(--premium-blue)',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Create Project <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 3. GET INSPIRATION */}
        <GetInspirationSection
          excludeProjectIds={projectsToShow.map(p => p.id)}
          hasPendingSuggestions={pendingSuggestions.length > 0}
          pendingSuggestionsCount={pendingSuggestions.length}
        />

        {/* 4. EXPLORE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'rgba(25, 35, 55, 0.6)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>Explore</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Timeline */}
              <Link
                to="/knowledge-timeline"
                className="group p-5 rounded-xl transition-all"
                style={{
                  background: 'rgba(30, 42, 88, 0.6)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 42, 88, 0.8)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 42, 88, 0.6)'
                }}
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
                className="group p-5 rounded-xl transition-all"
                style={{
                  background: 'rgba(30, 42, 88, 0.6)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 42, 88, 0.8)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 42, 88, 0.6)'
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Network className="h-6 w-6 mt-1" style={{ color: 'var(--premium-blue)' }} />
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

            {/* Card of the Day - Resurfacing - Enhanced Design */}
            {cardOfTheDay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="premium-glass-subtle p-6 rounded-2xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.20))',
                  boxShadow: '0 12px 40px rgba(139, 92, 246, 0.2)'
                }}
              >
                {/* Ambient glow effect */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.3), transparent 60%)',
                    pointerEvents: 'none'
                  }}
                />

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-6 w-6" style={{ color: 'var(--premium-purple)' }} />
                    <h3 className="font-bold text-lg" style={{ color: 'var(--premium-text-primary)' }}>
                      Thought of the Day
                    </h3>
                  </div>
                  <p className="mb-4 leading-relaxed text-lg" style={{
                    color: 'var(--premium-text-primary)',
                    fontWeight: 500
                  }}>
                    {cardOfTheDay.body}
                  </p>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                    <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--premium-purple)' }} />
                    <span>From {new Date(cardOfTheDay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </motion.div>
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
