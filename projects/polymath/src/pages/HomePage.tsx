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
import {
  Layers,
  ArrowRight,
  Plus,
  Mic,
  FileText,
  FolderKanban,
  Sparkles,
  Search,
  TrendingUp,
  Moon,
  Calendar,
  Zap,
  Brain,
  X,
  AlertCircle,
  Check,
  Lightbulb,
  RefreshCw
} from 'lucide-react'
import { BrandName } from '../components/BrandName'
import { SubtleBackground } from '../components/SubtleBackground'
import type { Memory, Project, SynthesisInsight } from '../types'

interface InspirationData {
  type: 'article' | 'thought' | 'project' | 'empty'
  title: string
  description: string
  url?: string
  reasoning: string
}

function GetInspirationSection({ excludeProjectIds, hasPendingSuggestions, pendingSuggestionsCount, projectsLoading }: {
  excludeProjectIds: string[]
  hasPendingSuggestions: boolean
  pendingSuggestionsCount: number
  projectsLoading: boolean
}) {
  const [inspiration, setInspiration] = useState<InspirationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Don't fetch until projects have finished loading, and only fetch once
    if (projectsLoading || hasFetched) {
      return
    }

    const fetchInspiration = async () => {
      setLoading(true)
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
        setHasFetched(true)
      }
    }

    fetchInspiration()
  }, [projectsLoading, hasFetched, excludeProjectIds.join(',')])

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'article':
        return { icon: FileText, color: 'var(--premium-emerald)' }
      case 'thought':
        return { icon: Brain, color: 'var(--premium-indigo)' }
      case 'project':
        return { icon: Layers, color: 'var(--premium-blue)' }
      default:
        return { icon: Sparkles, color: 'var(--premium-amber)' }
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
      <div className="p-6 rounded-xl backdrop-blur-xl" style={{
        background: 'var(--premium-bg-2)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="mb-5">
          <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
            Get <span style={{ color: 'var(--premium-blue)' }}>inspiration</span>
          </h2>
        </div>

        {loading ? (
          <SkeletonCard variant="list" count={1} />
        ) : inspiration && inspiration.type !== 'empty' ? (
          <div className="space-y-3">
            <Link
              to={inspiration.url || '/projects'}
              className="group block p-4 rounded-xl transition-all duration-300"
              style={{
                background: 'var(--premium-bg-2)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--premium-bg-3)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--premium-bg-2)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}
            >
              {/* Title & Reasoning */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="text-xs mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                    {inspiration.reasoning}
                  </p>
                  <h3 className="premium-text-platinum font-bold text-base">
                    {inspiration.title}
                  </h3>
                </div>
              </div>

              {/* Next Step/Description - Interactive with Checkbox */}
              <div
                className="rounded-lg p-2.5 flex items-center justify-between gap-2"
                style={{
                  background: 'var(--premium-bg-3)'
                }}
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      // Optional: Handle checkbox click
                      haptic.light()
                    }}
                    className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all hover:bg-blue-500/20"
                    style={{
                      color: 'rgba(59, 130, 246, 0.9)',
                      border: '2px solid rgba(255, 255, 255, 0.3)'
                    }}
                    title="Mark as complete"
                  >
                    <Check className="h-3 w-3 opacity-0 hover:opacity-100" />
                  </button>
                  <div className="premium-text-platinum font-medium text-sm flex-1">
                    {inspiration.description}
                  </div>
                </div>
              </div>
            </Link>

            {hasPendingSuggestions && (
              <Link
                to="/suggestions"
                className="block text-center py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
                  color: 'var(--premium-blue)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                <Sparkles className="inline h-4 w-4 mr-2" />
                {pendingSuggestionsCount} Project {pendingSuggestionsCount === 1 ? 'Suggestion' : 'Suggestions'} Waiting
                <ArrowRight className="inline h-4 w-4 ml-2" />
              </Link>
            )}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No inspiration yet"
            description="No content to inspire from yet. Add thoughts, articles, or projects!"
          />
        )}
      </div>
    </section>
  )
}

import { useContextEngineStore } from '../stores/useContextEngineStore'

// Simple Dialog Component for displaying full insights
function InsightDialog({ insight, open, onClose }: { insight: SynthesisInsight | null; open: boolean; onClose: () => void }) {
  if (!insight) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[80vh]"
        style={{ background: 'var(--premium-bg-2)' }}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
          style={{ color: 'var(--premium-text-tertiary)' }}
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="mb-6 pr-8">
          <h2 className="text-xl font-bold premium-text-platinum mb-2">
            {insight.title}
          </h2>
          <div className="flex items-center gap-2">
             <span className="px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider" 
                   style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--premium-text-secondary)' }}>
               {insight.type}
             </span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="leading-relaxed text-base" style={{ color: 'var(--premium-text-primary)' }}>
              {insight.description}
            </p>
          </div>

          {/* Render timeline if available */}
          {insight.data && insight.data.timeline && Array.isArray(insight.data.timeline) && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--premium-text-secondary)' }}>Evolution Timeline</h3>
              <div className="space-y-4 relative pl-4 border-l-2 border-white/10">
                {insight.data.timeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative pl-4">
                    <div className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--premium-bg-2)]" 
                         style={{ backgroundColor: idx === insight.data.timeline.length - 1 ? 'var(--premium-blue)' : 'var(--premium-text-tertiary)' }} />
                    <div className="text-xs mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {item.date || 'Previously'}
                    </div>
                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                      {item.stance}
                    </div>
                    {item.quote && (
                      <div className="text-xs italic pl-2 border-l-2 border-white/10" style={{ color: 'var(--premium-text-secondary)' }}>
                        "{item.quote}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {insight.actionable && insight.action && (
             <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
               <h4 className="text-sm font-bold text-blue-400 mb-1">Recommendation</h4>
               <p className="text-sm text-blue-200">{insight.action}</p>
             </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function InsightsSection() {
  const [insights, setInsights] = useState<SynthesisInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [requirements, setRequirements] = useState<{ current: number; needed: number; tip: string } | null>(null)
  
  // Dialog State
  const [selectedInsight, setSelectedInsight] = useState<SynthesisInsight | null>(null)
  
  const navigate = useNavigate()

  const fetchInsights = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch('/api/analytics?resource=evolution')
      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setRequirements(data.requirements || null)
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'evolution': return <TrendingUp className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
      case 'pattern': return <Sparkles className="h-5 w-5" style={{ color: 'var(--premium-indigo)' }} />
      case 'collision': return <AlertCircle className="h-5 w-5" style={{ color: 'var(--premium-amber)' }} />
      case 'opportunity': return <Lightbulb className="h-5 w-5" style={{ color: 'var(--premium-emerald)' }} />
      default: return <Sparkles className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
      <div className="p-6 rounded-xl backdrop-blur-xl" style={{
        background: 'var(--premium-bg-2)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
            Your <span style={{ color: 'var(--premium-blue)' }}>insights</span>
          </h2>
          <button
            onClick={() => fetchInsights(true)}
            disabled={refreshing}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
            style={{ color: 'var(--premium-text-tertiary)' }}
            title="Refresh insights"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Sparkles className="h-6 w-6 animate-pulse" style={{ color: 'var(--premium-blue)' }} />
                <div className="absolute inset-0 animate-ping">
                  <Sparkles className="h-6 w-6 opacity-30" style={{ color: 'var(--premium-blue)' }} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                  Analyzing your thoughts...
                </p>
                <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                  Finding patterns and connections
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--premium-bg-3)' }} />
              <div className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--premium-bg-3)', animationDelay: '150ms' }} />
            </div>
          </div>
        ) : insights.length > 0 ? (
          <div className="space-y-3">
            {/* Show first 2 insights */}
            {insights.slice(0, 2).map((insight, index) => (
              <button
                key={index}
                onClick={() => setSelectedInsight(insight)}
                className="w-full text-left p-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: 'var(--premium-bg-3)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm mb-1 premium-text-platinum">
                      {insight.title}
                    </h3>
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                      {insight.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 mt-1 opacity-50" style={{ color: 'var(--premium-text-tertiary)' }} />
                </div>
              </button>
            ))}

            {insights.length > 2 && (
              <button
                onClick={() => navigate('/insights')}
                className="block w-full text-center py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
                style={{ color: 'var(--premium-blue)' }}
              >
                View All Insights ({insights.length}) <ArrowRight className="inline h-4 w-4 ml-1" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <TrendingUp className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--premium-text-tertiary)', opacity: 0.5 }} />
            <p className="text-sm mb-1" style={{ color: 'var(--premium-text-secondary)' }}>
              Building your insights...
            </p>
            {requirements ? (
              <>
                <p className="text-xs mb-2" style={{ color: 'var(--premium-text-tertiary)' }}>
                  {requirements.current}/{requirements.needed} {requirements.needed === 5 ? 'thoughts' : 'with themes'}
                </p>
                <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                  {requirements.tip}
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Add more thoughts with themes to see patterns emerge
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Full Insight Modal */}
      <InsightDialog 
        insight={selectedInsight} 
        open={!!selectedInsight} 
        onClose={() => setSelectedInsight(null)} 
      />
    </section>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects, loading: projectsLoading, updateProject } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()
  const { progress, requiredPrompts, fetchPrompts } = useOnboardingStore()
  const { setContext } = useContextEngineStore()

  useEffect(() => {
    setContext('home', 'home', 'Home')
  }, [])

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
                    color: '#ef4444'
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
                  color: '#ef4444'
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
      {/* Subtle Background Effect */}
      <SubtleBackground />
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
                    color: '#ef4444'
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
                  color: '#ef4444'
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
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.7)'
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
                background: 'rgba(60, 140, 180, 0.15)',
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
                    <h3 className="font-bold mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                      Complete Your Profile
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                      Answer a few questions to get personalized suggestions tailored to your interests
                    </p>
                    <Link
                      to="/onboarding"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:opacity-90"
                      style={{
                        backgroundColor: 'rgba(60, 140, 180, 0.6)',
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
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="mb-4">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                Add something <span style={{ color: 'var(--premium-blue)' }}>new</span>
              </h2>
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
                  background: 'var(--premium-bg-3)'
                }}
                title="Voice Note"
              >
                <Mic className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Written Thought */}
              <button
                onClick={() => setCreateThoughtOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: 'var(--premium-bg-3)'
                }}
                title="Thought"
              >
                <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Article */}
              <button
                onClick={() => setSaveArticleOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: 'var(--premium-bg-3)'
                }}
                title="Article"
              >
                <FileText className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Project */}
              <button
                onClick={() => setCreateProjectOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: 'var(--premium-bg-3)'
                }}
                title="Project"
              >
                <Layers className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>
            </div>
          </div>
        </section>

        {/* 2. KEEP THE MOMENTUM (Compact) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="mb-5">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                Keep the <span style={{ color: 'var(--premium-blue)' }}>momentum</span>
              </h2>
            </div>

            {projectsLoading ? (
              <SkeletonCard variant="list" count={2} />
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
                        background: 'var(--premium-bg-2)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--premium-bg-3)'
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--premium-bg-2)'
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
                          background: 'var(--premium-bg-3)'
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
                                  addToast({ title: 'Task complete!', description: nextTask.text, variant: 'success' })
                                  haptic.success()
                                } catch (error) {
                                  console.error('Failed to complete task:', error)
                                  addToast({ title: 'Failed to complete task', variant: 'destructive' })
                                }
                              }}
                              className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all hover:bg-blue-500/20"
                              style={{
                                color: 'rgba(59, 130, 246, 0.9)',
                                border: '2px solid rgba(255, 255, 255, 0.3)'
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
              <EmptyState
                icon={Layers}
                title="Ready to build something?"
                description="Projects are where ideas become reality."
                action={
                  <Link
                    to="/projects"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: 'var(--premium-blue)'
                    }}
                  >
                    Create Project <ArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* 3. GET INSPIRATION */}
        <GetInspirationSection
          excludeProjectIds={projects.filter(p => p.status === 'active').map(p => p.id)}
          hasPendingSuggestions={pendingSuggestions.length > 0}
          pendingSuggestionsCount={pendingSuggestions.length}
          projectsLoading={projectsLoading}
        />

        {/* 4. YOUR INSIGHTS */}
        <InsightsSection />

        {/* 5. EXPLORE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                Or just <span style={{ color: 'var(--premium-blue)' }}>explore</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Timeline */}
              <Link
                to="/knowledge-timeline"
                className="group p-5 rounded-xl transition-all"
                style={{
                  background: 'var(--premium-bg-2)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--premium-bg-3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--premium-bg-2)'
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1" style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <Calendar className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
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

              {/* Bedtime Ideas */}
              <Link
                to="/bedtime"
                className="group p-5 rounded-xl transition-all"
                style={{
                  background: 'var(--premium-bg-2)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--premium-bg-3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--premium-bg-2)'
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1" style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <Moon className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Bedtime ideas</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        Creative inspiration for sleep
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-blue)' }} />
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
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center" style={{
                      background: 'rgba(236, 72, 153, 0.1)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(236, 72, 153, 0.2)'
                    }}>
                      <Zap className="h-5 w-5" style={{ color: 'var(--premium-purple)' }} />
                    </div>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--premium-text-primary)' }}>
                      Thought of the day
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
