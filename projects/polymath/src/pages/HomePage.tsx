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
  RefreshCw,
  Wind,
  Rss,
  Map as MapIcon,
  Sparkles
} from 'lucide-react'
import { CapabilitiesSection } from '../components/home/CapabilitiesSection'
import { BrandName } from '../components/BrandName'
import { SubtleBackground } from '../components/SubtleBackground'
import { DriftMode } from '../components/bedtime/DriftMode'
import { PROJECT_COLORS } from '../components/projects/ProjectCard'
import { PowerHourHero } from '../components/home/PowerHourHero'
import type { Memory, Project, SynthesisInsight } from '../types'

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
  sparkCandidate
}: {
  excludeProjectIds: string[]
  hasPendingSuggestions: boolean
  pendingSuggestionsCount: number
  projectsLoading: boolean
  sparkCandidate: Project | null
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

  // Reusable Glass Card Style
  const glassCardStyle = (rgb: string = '59, 130, 246') => ({
    background: `linear-gradient(135deg, rgba(${rgb}, 0.15), rgba(${rgb}, 0.05))`,
    boxShadow: `0 4px 16px rgba(${rgb}, 0.1)`,
    borderColor: `rgba(${rgb}, 0.2)`
  })

  // Theme helper for Spark
  const getTheme = (type: string, title: string) => {
    const t = type?.toLowerCase().trim() || ''

    let rgb = PROJECT_COLORS[t]

    // Deterministic fallback
    if (!rgb) {
      const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
      let hash = 0
      for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash)
      }
      rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
    }

    return {
      borderColor: `rgba(${rgb}, 0.2)`,
      backgroundColor: `rgba(${rgb}, 0.1)`,
      textColor: `rgb(${rgb})`,
      rgb: rgb
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
      <div className="p-6 rounded-xl backdrop-blur-xl" style={{
        background: 'var(--premium-bg-2)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
            Get <span style={{ color: 'var(--premium-blue)' }}>inspiration</span>
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
                className="group block p-5 rounded-xl transition-all duration-300 border flex-1 flex flex-col relative overflow-hidden backdrop-blur-xl"
                style={glassCardStyle('139, 92, 246')} // Violet/Purple for thought/article - keep specialized
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(139, 92, 246, 0.1))`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))`
                }}
              >
                <div className="relative z-10 flex-1 flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1" style={{
                      backgroundColor: `rgba(139, 92, 246, 0.1)`,
                      color: 'rgb(167, 139, 250)',
                      borderColor: `rgba(139, 92, 246, 0.3)`
                    }}>
                      Recommended
                    </span>
                  </div>

                  <h3 className="premium-text-platinum font-bold text-lg mb-2">
                    {inspiration.title}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                    {inspiration.reasoning}
                  </p>

                  <div className="p-3 rounded-lg mt-auto" style={{
                    backgroundColor: `rgba(139, 92, 246, 0.1)`,
                    border: `1px solid rgba(139, 92, 246, 0.3)`
                  }}>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-gray-200 line-clamp-2">{inspiration.description}</p>
                    </div>
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
                  className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300 border flex flex-col"
                  onClick={() => navigate(`/projects/${sparkCandidate.id}`)}
                  style={{
                    background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`,
                    boxShadow: `0 4px 16px rgba(${theme.rgb}, 0.1)`,
                    borderColor: theme.borderColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.25), rgba(${theme.rgb}, 0.1))`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`
                  }}
                >
                  <div className="relative z-10 flex-1 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1" style={{
                        backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                        color: theme.textColor,
                        borderColor: `rgba(${theme.rgb}, 0.3)`
                      }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.textColor }} /> Spark
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
                        ~20 min
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      {sparkCandidate.title}
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                      Perfect for your current {timeContextEnergy} energy.
                    </p>

                    {nextTask && (
                      <div className="p-3 rounded-lg mt-auto" style={{
                        backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                        border: `1px solid rgba(${theme.rgb}, 0.3)`
                      }}>
                        <p className="text-xs font-medium mb-1" style={{ color: theme.textColor }}>NEXT STEP</p>
                        <p className="text-sm text-gray-200 line-clamp-2">{nextTask.text}</p>
                      </div>
                    )}
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
                background: 'rgba(255, 255, 255, 0.02)',
                borderColor: 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-2">
                <Lightbulb className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-200">Need more ideas?</h3>
              <p className="text-sm text-slate-500">Generate new project suggestions based on your interests.</p>
            </Link>
          )}

        </div>

        {/* Suggestion Call to Action - Footer */}
        <div className="mt-4">
          {hasPendingSuggestions ? (
            <Link
              to="/suggestions"
              className="block text-center py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))',
                color: '#22d3ee', // Cyan-400
                border: '1px solid rgba(6, 182, 212, 0.3)'
              }}
            >
              <Zap className="inline h-4 w-4 mr-2" />
              {pendingSuggestionsCount} {pendingSuggestionsCount === 1 ? 'Idea' : 'Ideas'} Waiting to be reviewed
              <ArrowRight className="inline h-4 w-4 ml-2" />
            </Link>
          ) : (
            <Link
              to="/suggestions"
              className="block text-center py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5 active:scale-[0.99]"
              style={{
                color: 'var(--premium-cyan, #06b6d4)'
              }}
            >
              See all project suggestions <ArrowRight className="inline h-4 w-4 ml-1" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

import { useContextEngineStore } from '../stores/useContextEngineStore'
import { readingDb } from '../lib/db'

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

  const loadInsights = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // 1. Try cache first
      if (!isRefresh) {
        const cached = await readingDb.getDashboard('evolution')
        if (cached) {
          setInsights(cached.insights || [])
          setRequirements(cached.requirements || null)
          setLoading(false)
        }
      }

      // 2. Fetch fresh data if online
      if (navigator.onLine) {
        const response = await fetch('/api/analytics?resource=evolution')
        if (response.ok) {
          const data = await response.json()
          setInsights(data.insights || [])
          setRequirements(data.requirements || null)
          await readingDb.cacheDashboard('evolution', data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadInsights()
  }, [])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'evolution': return <TrendingUp className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
      case 'pattern': return <Zap className="h-5 w-5" style={{ color: 'var(--premium-indigo)' }} />
      case 'collision': return <AlertCircle className="h-5 w-5" style={{ color: 'var(--premium-amber)' }} />
      case 'opportunity': return <Lightbulb className="h-5 w-5" style={{ color: 'var(--premium-emerald)' }} />
      default: return <Lightbulb className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
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
            onClick={() => loadInsights(true)}
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
              <div>
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
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

import { FocusStream } from '../components/home/FocusStream'

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
  const [driftModeOpen, setDriftModeOpen] = useState(false)
  const [breakPrompts, setBreakPrompts] = useState<any[]>([])


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

        setRefreshKey(k => k + 1)
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

    // Filter by energy
    const matching = activeProjects.filter(p => {
      const nextTask = p.metadata?.tasks?.find((t: any) => !t.done)
      if (nextTask?.energy_level) return nextTask.energy_level === energy
      return (p.energy_level || 'moderate') === energy
    })

    const pool = matching.length > 0 ? matching : activeProjects
    // Deterministic "random" based on date to avoid flickering on re-renders
    const seed = new Date().getDate()
    return pool[seed % pool.length]
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
      <div className="min-h-screen py-12 px-4 flex items-center justify-center" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="max-w-2xl w-full premium-card p-8 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold premium-text-platinum">Initialization Error</h2>
          </div>
          <p className="text-red-400 mb-8 font-mono text-sm p-4 bg-black/30 rounded-lg border border-red-500/10">
            {error}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            >
              Try Again
            </button>
            <Link to="/settings" className="text-red-400/70 hover:text-red-400 underline text-sm transition-colors">
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
          className="fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full flex items-center justify-center shadow-lg"
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
            <div className="max-w-4xl mx-auto text-red-400 font-mono text-xs">
              {storedErrors.map((e: any, i: number) => <div key={i} className="mb-2 p-2 bg-red-900/20 rounded">{e.message}</div>)}
              <button onClick={() => { localStorage.removeItem('app_errors'); window.location.reload() }} className="mt-2 text-white underline">Clear & Reload</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Header Bar - Brand & Search */}
      <div
        className="fixed top-0 left-0 right-0 z-40 border-b border-white"
        style={{
          backgroundColor: 'var(--zebra-black)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl" style={{
            fontWeight: 600,
            letterSpacing: 'var(--premium-tracking-tight)',
            color: 'var(--premium-text-secondary)',
            opacity: 0.7
          }}>
            <BrandName className="inline" showLogo={true} />
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
                background: 'rgba(6, 182, 212, 0.15)', // Cyan tint
                boxShadow: '0 8px 32px rgba(6, 182, 212, 0.15)'
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
                        backgroundColor: 'rgba(6, 182, 212, 0.6)',
                        color: 'rgba(255, 255, 255, 0.95)',
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

        {/* Aperture Power Hour - The Hero Engine */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <PowerHourHero />
        </section>

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
                onClick={(e) => {
                  e.stopPropagation()
                  window.dispatchEvent(new CustomEvent('openVoiceCapture'))
                }}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
                style={{ background: 'var(--premium-bg-3)' }}
                title="Voice Note"
              >
                <Mic className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Written Thought */}
              <button
                onClick={() => setCreateThoughtOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
                style={{ background: 'var(--premium-bg-3)' }}
                title="Thought"
              >
                <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Article */}
              <button
                onClick={() => setSaveArticleOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
                style={{ background: 'var(--premium-bg-3)' }}
                title="Article"
              >
                <FileText className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>

              {/* Project */}
              <button
                onClick={() => setCreateProjectOpen(true)}
                className="flex-1 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
                style={{ background: 'var(--premium-bg-3)' }}
                title="Project"
              >
                <Layers className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              </button>
            </div>
          </div>
        </section>

        {/* Drift Mode Overlay */}
        {driftModeOpen && (
          <DriftMode
            mode="break"
            prompts={breakPrompts}
            onClose={() => setDriftModeOpen(false)}
          />
        )}

        {/* 2. KEEP THE MOMENTUM (Focus Stream) */}
        <FocusStream />

        {/* 3. GET INSPIRATION (Glass Cards + Spark) */}
        <GetInspirationSection
          excludeProjectIds={projects.filter(p => p.status === 'active').map(p => p.id)}
          hasPendingSuggestions={pendingSuggestions.length > 0}
          pendingSuggestionsCount={pendingSuggestions.length}
          projectsLoading={projectsLoading}
          sparkCandidate={sparkCandidate}
        />

        {/* 4. YOUR INSIGHTS (Cyan Theme) */}
        <InsightsSection />


        {/* 6. EXPLORE (Bottom Links) */}
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

            {/* Card of the Day - Resurfacing - Enhanced Design */}
            {cardOfTheDay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="premium-glass-subtle p-6 rounded-2xl relative overflow-hidden mb-6"
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
                    <h3 className="font-bold text-lg" style={{ color: 'var(--premium-text-primary)' }}>
                      Thought of the day
                    </h3>
                  </div>
                  <p className="mb-4 leading-relaxed text-lg italic" style={{
                    color: 'var(--premium-text-primary)',
                    fontWeight: 500,
                    fontFamily: 'serif'
                  }}>
                    "{cardOfTheDay.body}"
                  </p>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                    <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--premium-purple)' }} />
                    <span>From {new Date(cardOfTheDay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Divider */}
            <div className="w-full h-px bg-white/10 my-6" />

            {/* Grid: Mindset & Discovery Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      background: 'rgba(99, 102, 241, 0.1)', // Indigo for sleep/dreams
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(99, 102, 241, 0.2)'
                    }}>
                      <Moon className="h-5 w-5" style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Bedtime ideas</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        Creative inspiration for sleep
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#818cf8' }} />
                </div>
              </Link>

              {/* Drift Mode */}
              <button
                onClick={handleOpenDrift}
                className="group p-5 rounded-xl transition-all text-left"
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
                      background: 'rgba(99, 102, 241, 0.1)', // Indigo
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(99, 102, 241, 0.2)'
                    }}>
                      <Wind className="h-5 w-5" style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Drift Mode</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        Mental reset & hypnagogic insights
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#818cf8' }} />
                </div>
              </button>

              {/* Discover Projects */}
              <Link
                to="/suggestions"
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
                      <Lightbulb className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Discover Projects</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        AI recommendations
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-blue)' }} />
                </div>
              </Link>

              {/* Analysis */}
              <Link
                to="/insights"
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
                      <TrendingUp className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Analysis</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        Patterns & Insights
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-blue)' }} />
                </div>
              </Link>
            </div>
          </div >
        </section >

        <CapabilitiesSection />
      </div >

      {/* Dialogs */}
      < SaveArticleDialog open={saveArticleOpen} onClose={() => setSaveArticleOpen(false)} />


      {/* Hidden trigger buttons for dialogs */}
      <div style={{ display: 'none' }}>
        <div ref={(el) => { if (el && createThoughtOpen) { el.querySelector('button')?.click(); setCreateThoughtOpen(false) } }}>
          <CreateMemoryDialog />
        </div>
        <div ref={(el) => { if (el && createProjectOpen) { el.querySelector('button')?.click(); setCreateProjectOpen(false) } }}>
          <CreateProjectDialog />
        </div>
      </div>
    </motion.div >
  )
}