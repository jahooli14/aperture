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
import { PROJECT_COLORS } from '../components/projects/ProjectCard'
import { PowerHourHero } from '../components/home/PowerHourHero'
import type { Memory, Project, SynthesisInsight } from '../types'
import { CohesionSummaryWidget } from '../components/home/CohesionSummaryWidget'
import { MemoryDetailModal } from '../components/memories/MemoryDetailModal'
import { useContextEngineStore } from '../stores/useContextEngineStore'
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
              className="group block p-6 attention-card transition-all duration-300 flex-1 flex flex-col relative overflow-hidden active:scale-[0.98]"
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
            ? `${pendingSuggestionsCount} ${pendingSuggestionsCount === 1 ? 'Idea' : 'Ideas'} Waiting to be reviewed`
            : "See all project suggestions"
          }
          <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </section>
  )
}

// Simple Dialog Component for displaying full insights
function InsightDialog({ insight, open, onClose }: { insight: SynthesisInsight | null; open: boolean; onClose: () => void }) {
  if (!insight) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[80vh]"
        style={{ background: 'var(--brand-glass-bg)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          style={{ color: "var(--brand-primary)" }}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 pr-8">
          <h2 className="text-xl font-bold premium-text-platinum mb-2">
            {insight.title}
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-xl text-xs font-medium uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--brand-text-secondary)' }}>
              {insight.type}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="mb-6">
            <MarkdownRenderer
              content={insight.description}
              className="text-base"
              style={{ color: "var(--brand-primary)" }}
            />
          </div>

          {/* Render timeline if available */}
          {insight.data && insight.data.timeline && Array.isArray(insight.data.timeline) && (
            <div className="mt-6 pt-6 border-t border-[var(--glass-surface-hover)]">
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--brand-primary)" }}>Evolution Timeline</h3>
              <div className="space-y-4 relative pl-4 border-l-2 border-[var(--glass-surface-hover)]">
                {insight.data.timeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative pl-4">
                    <div className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--brand-glass-bg)]"
                      style={{ backgroundColor: idx === insight.data.timeline.length - 1 ? 'var(--brand-primary)' : 'var(--brand-text-muted)' }} />
                    <div className="text-xs mb-1" style={{ color: "var(--brand-primary)" }}>
                      {item.date || 'Previously'}
                    </div>
                    <div className="text-sm font-medium mb-1" style={{ color: "var(--brand-primary)" }}>
                      {item.stance}
                    </div>
                    {item.quote && (
                      <div className="text-xs italic pl-2 border-l-2 border-[var(--glass-surface-hover)]" style={{ color: "var(--brand-primary)" }}>
                        "{item.quote}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insight.actionable && insight.action && (
            <div className="mt-4 p-4 rounded-lg bg-brand-primary/10 border border-blue-500/20">
              <h4 className="text-sm font-bold text-brand-primary mb-1">Recommendation</h4>
              <p className="text-sm text-brand-primary">{insight.action}</p>
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
      case 'evolution': return <TrendingUp className="h-5 w-5 text-[var(--brand-primary)]" />
      case 'pattern': return <Zap className="h-5 w-5 text-[var(--brand-primary)]" />
      case 'collision': return <AlertCircle className="h-5 w-5 text-brand-text-secondary" />
      case 'opportunity': return <Lightbulb className="h-5 w-5 text-brand-text-secondary" />
      default: return <Lightbulb className="h-5 w-5 text-[var(--brand-text-secondary)]" />
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 aperture-shelf">
      <div className="flex items-center justify-between mb-0">
        <h2 className="section-header">
          your <span>insights</span>
        </h2>
        <button
          onClick={() => loadInsights(true)}
          disabled={refreshing}
          className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--glass-surface)]"
          style={{ color: "var(--brand-primary)" }}
          title="Refresh insights"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--brand-primary)" }}>
                Analyzing your thoughts...
              </p>
              <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
                Finding patterns and connections
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--glass-surface)' }} />
            <div className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--glass-surface)', animationDelay: '150ms' }} />
          </div>
        </div>
      ) : insights.length > 0 ? (
        <div className="space-y-3">
          {/* Show first 2 insights */}
          {insights.slice(0, 2).map((insight, index) => (
            <button
              key={index}
              onClick={() => setSelectedInsight(insight)}
              className="w-full text-left p-5 rounded-xl transition-all hover:border-white/20 active:scale-[0.99] glass-card glass-card-hover mt-2"
              style={{
                boxShadow: '3px 3px 0 rgba(0,0,0,0.5)'
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
                  <MarkdownRenderer
                    content={insight.description}
                    className="text-sm line-clamp-2"
                    style={{ color: "var(--brand-primary)" }}
                  />
                </div>
                <ArrowRight className="h-4 w-4 mt-1 opacity-50" style={{ color: "var(--brand-primary)" }} />
              </div>
            </button>
          ))}

          {insights.length > 2 && (
            <button
              onClick={() => navigate('/insights')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all hover:bg-[rgba(255,255,255,0.1)] border border-[var(--glass-surface)] text-[var(--brand-primary)] aperture-header"
            >
              View All Insights ({insights.length}) <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <TrendingUp className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--brand-text-muted)', opacity: 0.5 }} />
          <p className="text-sm mb-1" style={{ color: "var(--brand-primary)" }}>
            Building your insights...
          </p>
          {requirements ? (
            <>
              <p className="text-xs mb-2" style={{ color: "var(--brand-primary)" }}>
                {requirements.current}/{requirements.needed} {requirements.needed === 5 ? 'thoughts' : 'with themes'}
              </p>
              <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
                {requirements.tip}
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
              Add more thoughts with themes to see patterns emerge
            </p>
          )}
        </div>
      )}

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
import { Film, Book, Music, MapPin, Gamepad2, Monitor, FileText, Box as BoxIcon, List as ListIcon } from 'lucide-react'
import { useListStore } from '../stores/useListStore'

// List-type icon map (shared across home components)
const LIST_ICON_MAP: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  film: Film, book: Book, music: Music, place: MapPin, game: Gamepad2,
  tech: Monitor, software: Monitor, article: FileText,
}

function RecentThoughtsSection({ memories, onOpenMemory }: { memories: Memory[], onOpenMemory: (id: string) => void }) {
  const recent = [...memories]
    .sort((a, b) => {
      const aTime = new Date(a.created_at || '').getTime()
      const bTime = new Date(b.created_at || '').getTime()
      return bTime - aTime
    })
    .slice(0, 3)

  if (recent.length === 0) return null

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 aperture-shelf">
      <h2 className="section-header mb-4">
        on your <span>mind</span>
      </h2>
      <div className="space-y-3">
        {recent.map((memory) => {
          const src = memory.source_reference
          const isFromList = src?.type === 'list_item' && src.title
          const SrcIcon = isFromList ? (LIST_ICON_MAP[src!.list_type || ''] || BoxIcon) : null
          return (
            <button
              key={memory.id}
              onClick={() => onOpenMemory(memory.id)}
              className="w-full text-left p-4 glass-card glass-card-hover rounded-xl transition-all"
              style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.5)' }}
            >
              {isFromList && SrcIcon && (
                <div className="flex items-center gap-1 mb-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest"
                    style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.7)' }}
                  >
                    <SrcIcon className="w-2.5 h-2.5" />
                    {src!.title}
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed line-clamp-2 aperture-body" style={{ color: 'var(--brand-text-primary)' }}>
                {memory.body || memory.title}
              </p>
              <p className="text-xs mt-2 opacity-50 aperture-body" style={{ color: 'var(--brand-primary)' }}>
                {new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ---- List quick-add sheet shown from home capture row ----
function HomeListQuickAdd({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lists, fetchLists, addListItem } = useListStore()
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) { fetchLists(); setText(''); setSelectedListId(null) }
  }, [isOpen])

  useEffect(() => {
    if (selectedListId) setTimeout(() => inputRef.current?.focus(), 80)
  }, [selectedListId])

  const selectedList = lists.find(l => l.id === selectedListId)

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || !selectedListId || submitting) return
    setSubmitting(true)
    try {
      await addListItem({ list_id: selectedListId, content: text.trim(), status: 'pending' })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-10"
        style={{ background: '#141f32', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 -20px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--brand-primary)' }}>
          Add to list
        </p>

        {!selectedListId ? (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lists.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--brand-text-secondary)' }}>No lists yet</p>
                <Link
                  to="/lists"
                  onClick={onClose}
                  className="text-[11px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  Create your first list →
                </Link>
              </div>
            ) : lists.map(list => {
              const Icon = LIST_ICON_MAP[list.type] || BoxIcon
              return (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-text-primary)] uppercase tracking-tight">{list.title}</p>
                    {list.description && <p className="text-[10px] text-[var(--brand-text-secondary)] truncate">{list.description}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <form onSubmit={handleAdd}>
            <button
              type="button"
              onClick={() => setSelectedListId(null)}
              className="flex items-center gap-1.5 mb-4 text-[10px] font-black uppercase tracking-widest"
              style={{ color: 'var(--brand-primary)' }}
            >
              ← {selectedList?.title}
            </button>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Add to ${selectedList?.title || 'list'}...`}
              className="w-full px-4 py-3 rounded-xl text-sm text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-primary)]/20 focus:outline-none mb-3"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--brand-primary)' }}
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </form>
        )}
      </div>
    </>
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

  useEffect(() => {
    setContext('home', 'home', 'Home')
  }, [])

  const { addToast } = useToast()

  const [cardOfTheDay, setCardOfTheDay] = useState<Memory | null>(null)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  const [saveArticleOpen, setSaveArticleOpen] = useState(false)
  const [createThoughtOpen, setCreateThoughtOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [listQuickAddOpen, setListQuickAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [driftModeOpen, setDriftModeOpen] = useState(false)
  const [breakPrompts, setBreakPrompts] = useState<any[]>([])
  const [showMorningFollowUp, setShowMorningFollowUp] = useState(true)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)


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

      {/* Fixed Header Bar - Brand & Search */}
      <div
        className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--glass-border)] backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(var(--brand-bg-rgb), 0.8)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl aperture-header" style={{
            color: 'var(--brand-text-secondary)',
            opacity: 0.9
          }}>
            <BrandName className="inline" showLogo={true} />
          </h1>
          <button
            onClick={() => navigate('/search')}
            className="h-10 w-10 rounded-lg flex items-center justify-center transition-all hover:bg-[var(--glass-surface)]"
            style={{ color: "var(--brand-primary)" }}
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
        <motion.section
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 mt-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-text-muted)] mb-3 px-1">What's happening?</p>
          <div className="flex items-center gap-2">
            {/* Voice */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('openVoiceCapture'))
              }}
              className="flex-1 flex flex-col items-center gap-1 py-3 glass-button active:scale-95 transition-transform"
              title="Voice Note"
            >
              <Mic className="h-5 w-5 text-brand-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary opacity-60">Voice</span>
            </button>

            {/* Thought */}
            <button
              onClick={() => setCreateThoughtOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 py-3 glass-button active:scale-95 transition-transform"
              title="Thought"
            >
              <Brain className="h-5 w-5 text-brand-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary opacity-60">Thought</span>
            </button>

            {/* List — replaces Article, which now lives in Lists */}
            <button
              onClick={() => setListQuickAddOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 py-3 glass-button active:scale-95 transition-transform"
              title="Add to list"
            >
              <ListIcon className="h-5 w-5 text-brand-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary opacity-60">List</span>
            </button>

            {/* Project */}
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 py-3 glass-button active:scale-95 transition-transform"
              title="Project"
            >
              <Layers className="h-5 w-5 text-brand-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary opacity-60">Project</span>
            </button>
          </div>
        </motion.section>

        {/* Aperture Power Hour - The Hero Engine */}
        <motion.section
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 aperture-shelf"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.12 }}
        >
          <PowerHourHero />
        </motion.section>

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
        <motion.div
          className="aperture-shelf"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
        >
          <FocusStream />
        </motion.div>

        {/* 3. WHAT'S ON YOUR MIND - Recent Thoughts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.28 }}
        >
        <RecentThoughtsSection
          memories={memories}
          onOpenMemory={(id) => {
            const m = memories.find(m => m.id === id) || null
            setSelectedMemory(m)
          }}
        />
        </motion.div>


        {/* 6. EXPLORE (Bottom Links) */}
        <motion.section
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 aperture-shelf"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.36 }}
        >
          <div className="mb-0">
            <h2 className="section-header">
              or just <span>explore</span>
            </h2>
          </div>

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
              className="p-5 glass-card glass-card-hover transition-all active:scale-[0.98]"
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
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-30 text-[var(--brand-primary)]" />
              </div>
            </Link>

            {/* Drift Mode */}
            <button
              onClick={handleOpenDrift}
              className="p-5 glass-card glass-card-hover transition-all text-left active:scale-[0.98]"
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
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-30 text-[var(--brand-primary)]" />
              </div>
            </button>

            {/* Discover Projects */}
            <Link
              to="/suggestions"
              className="p-5 glass-card glass-card-hover transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mt-1 bg-[var(--glass-surface)] border-2 border-[var(--glass-surface-hover)]">
                    <Lightbulb className="h-5 w-5 text-[var(--brand-text-secondary)]" />
                  </div>
                  <div>
                    <h2 className="section-header !mb-1 !text-xl uppercase">Discover Projects</h2>
                    <p className="text-sm aperture-body text-[var(--brand-text-secondary)]">
                      AI recommendations
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-30 text-[var(--brand-primary)]" />
              </div>
            </Link>

            {/* Analysis */}
            <Link
              to="/insights"
              className="p-5 glass-card glass-card-hover transition-all active:scale-[0.98]"
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
                <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-30 text-[var(--brand-primary)]" />
              </div>
            </Link>
          </div>
        </motion.section>

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
      <CreateMemoryDialog isOpen={createThoughtOpen} onOpenChange={setCreateThoughtOpen} hideTrigger />
      <CreateProjectDialog isOpen={createProjectOpen} onOpenChange={setCreateProjectOpen} hideTrigger />
      <HomeListQuickAdd isOpen={listQuickAddOpen} onClose={() => setListQuickAddOpen(false)} />
      <MemoryDetailModal
        memory={selectedMemory}
        isOpen={!!selectedMemory}
        onClose={() => setSelectedMemory(null)}
      />
    </motion.div>
  )
}