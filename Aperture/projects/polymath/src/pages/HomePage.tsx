/**
 * Home Page - Progress Dashboard
 * Keeps users on track with their goals and active projects
 */

import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useToast } from '../components/ui/toast'
import { SmartSuggestionWidget } from '../components/SmartSuggestionWidget'
import { useAnalytics, trackSectionClick, type SectionId } from '../hooks/useAnalytics'
import { useAdaptiveLayout } from '../hooks/useAdaptiveLayout'
import { Brain, Rocket, TrendingUp, ArrowRight, Plus, BookOpen, Clock, Zap, Battery, Link2, Sparkles, Search } from 'lucide-react'
import { BrandName } from '../components/BrandName'
import type { ProjectScore, DailyQueueResponse } from '../types'

export function HomePage() {
  const navigate = useNavigate()
  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()
  const [dailyQueue, setDailyQueue] = useState<ProjectScore[]>([])
  const [queueLoading, setQueueLoading] = useState(false)

  // Adaptive layout system
  const { sectionOrder, isAdaptive } = useAdaptiveLayout()

  useEffect(() => {
    fetchSuggestions()
    fetchProjects()
    fetchMemories()
    fetchDailyQueue()
  }, [])

  const fetchDailyQueue = async () => {
    setQueueLoading(true)
    try {
      const response = await fetch('/api/projects?resource=daily-queue')
      if (response.ok) {
        const data: DailyQueueResponse = await response.json()
        setDailyQueue(data.queue.slice(0, 2)) // Get top 2 items for preview
      }
    } catch (err) {
      console.error('Failed to fetch daily queue:', err)
    } finally {
      setQueueLoading(false)
    }
  }

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const sparkSuggestions = suggestions.filter(s => s.status === 'spark')
  const activeProjects = projects.filter(p => p.status === 'active')
  const priorityProjects = projects.filter(p => p.priority && p.status === 'active')
  const recentMemories = memories.slice(0, 3)

  // Section Components with Analytics Tracking
  const SmartSuggestionSection = () => {
    const analytics = useAnalytics('smart-suggestion')
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <SmartSuggestionWidget />
      </section>
    )
  }

  const PriorityProjectsSection = () => {
    const analytics = useAnalytics('priority-projects')

    if (priorityProjects.length === 0) return null

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="premium-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="premium-text-platinum text-sm font-bold flex items-center gap-2">
              ⭐ Priority
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{
              backgroundColor: 'rgba(251, 191, 36, 0.15)',
              color: '#fbbf24'
            }}>
              {priorityProjects.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorityProjects.map(project => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                onClick={() => analytics.trackClick()}
                className="group block p-3 rounded-lg border-2 hover:bg-white/5 transition-all"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm flex-1 line-clamp-1" style={{ color: 'var(--premium-text-primary)' }}>
                    {project.title}
                  </h3>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-amber)' }} />
                </div>
                {project.metadata?.next_step && (
                  <p className="text-xs line-clamp-2" style={{ color: 'var(--premium-text-tertiary)' }}>
                    {project.metadata.next_step}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const DailyQueueSection = () => {
    const analytics = useAnalytics('daily-queue')

    if (dailyQueue.length === 0) return null

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
        case 'hot_streak': return 'Hot Streak'
        case 'needs_attention': return 'Needs Attention'
        case 'fresh_energy': return 'Fresh Energy'
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

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6" style={{ color: 'var(--premium-amber)' }} />
              <h2 className="premium-text-platinum" style={{
                fontSize: 'var(--premium-text-h3)',
                fontWeight: 700
              }}>
                Today's Focus
              </h2>
            </div>
            <Link
              to="/today"
              onClick={() => analytics.trackClick()}
              className="text-sm font-medium inline-flex items-center gap-2 hover:gap-3 transition-all"
              style={{ color: 'var(--premium-amber)' }}
            >
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyQueue.map((score) => {
              const project = score.project
              const nextStep = project.metadata?.next_step

              return (
                <Link
                  key={score.project_id}
                  to="/today"
                  onClick={() => analytics.trackClick()}
                  className="group premium-glass-subtle p-4 rounded-xl transition-all duration-300 hover:bg-white/10"
                >
                  {/* Category Badge */}
                  <div className="mb-4">
                    <span
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-md"
                      style={{ background: getCategoryColor(score.category) }}
                    >
                      {getCategoryLabel(score.category)}
                    </span>
                  </div>

                  {/* Project Title */}
                  <h3 className="premium-text-platinum font-bold text-lg mb-3 flex items-start justify-between gap-2">
                    <span className="flex-1">{project.title}</span>
                    <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-amber)' }} />
                  </h3>

                  {/* Next Step */}
                  {nextStep && (
                    <div className="premium-glass-subtle rounded-lg p-4 mb-4">
                      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--premium-amber)' }}>
                        NEXT STEP:
                      </div>
                      <div className="premium-text-platinum font-medium text-sm">
                        {nextStep}
                      </div>
                    </div>
                  )}

                  {/* Match Reason */}
                  <div className="mb-4 p-3 rounded-lg border-2" style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                      {score.match_reason}
                    </p>
                  </div>

                  {/* Requirements */}
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(project.estimated_next_step_time)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Battery className="h-3.5 w-3.5" />
                      {project.energy_level || 'Moderate'} energy
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const QuickStatsSection = () => {
    const analytics = useAnalytics('quick-stats')

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/memories" onClick={() => analytics.trackClick()} className="premium-stat-card group">
            <div className="flex items-center justify-between mb-3">
              <Brain className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--premium-indigo)' }} />
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-platinum-muted)' }} />
            </div>
            <div className="text-3xl font-bold mb-1 premium-text-platinum" style={{ fontSize: 'var(--premium-text-display-sm)', letterSpacing: 'var(--premium-tracking-tight)' }}>
              {memories.length}
            </div>
            <div className="text-sm" style={{ color: 'var(--premium-text-secondary)', fontSize: 'var(--premium-text-body-sm)', letterSpacing: 'var(--premium-tracking-wide)' }}>
              THOUGHTS
            </div>
          </Link>

          <Link to="/suggestions" onClick={() => analytics.trackClick()} className="premium-stat-card group">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--premium-blue)' }} />
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-platinum-muted)' }} />
            </div>
            <div className="text-3xl font-bold mb-1 premium-text-platinum" style={{ fontSize: 'var(--premium-text-display-sm)', letterSpacing: 'var(--premium-tracking-tight)' }}>
              {pendingSuggestions.length}
            </div>
            <div className="text-sm" style={{ color: 'var(--premium-text-secondary)', fontSize: 'var(--premium-text-body-sm)', letterSpacing: 'var(--premium-tracking-wide)' }}>
              SUGGESTED
            </div>
          </Link>

          <Link to="/suggestions?filter=spark" onClick={() => analytics.trackClick()} className="premium-stat-card group">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--premium-amber)' }} />
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-platinum-muted)' }} />
            </div>
            <div className="text-3xl font-bold mb-1 premium-text-gold" style={{ fontSize: 'var(--premium-text-display-sm)', letterSpacing: 'var(--premium-tracking-tight)' }}>
              {sparkSuggestions.length}
            </div>
            <div className="text-sm" style={{ color: 'var(--premium-text-secondary)', fontSize: 'var(--premium-text-body-sm)', letterSpacing: 'var(--premium-tracking-wide)' }}>
              SPARKS
            </div>
          </Link>

          <Link to="/projects" onClick={() => analytics.trackClick()} className="premium-stat-card group">
            <div className="flex items-center justify-between mb-3">
              <Rocket className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--premium-emerald)' }} />
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-platinum-muted)' }} />
            </div>
            <div className="text-3xl font-bold mb-1 premium-text-platinum" style={{ fontSize: 'var(--premium-text-display-sm)', letterSpacing: 'var(--premium-tracking-tight)' }}>
              {activeProjects.length}
            </div>
            <div className="text-sm" style={{ color: 'var(--premium-text-secondary)', fontSize: 'var(--premium-text-body-sm)', letterSpacing: 'var(--premium-tracking-wide)' }}>
              ACTIVE
            </div>
          </Link>
        </div>
      </section>
    )
  }

  const ConnectionHintSection = () => {
    const analytics = useAnalytics('connection-hint')
    const [showHint, setShowHint] = useState(() => {
      // Only show on first visit
      const hasSeenHint = localStorage.getItem('hasSeenConnectionHint')
      return !hasSeenHint
    })

    if (memories.length === 0 || projects.length === 0) return null
    if (!showHint) return null

    const handleClick = () => {
      localStorage.setItem('hasSeenConnectionHint', 'true')
      setShowHint(false)
      analytics.trackClick()
    }

    const handleDismiss = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      localStorage.setItem('hasSeenConnectionHint', 'true')
      setShowHint(false)
    }

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Link
          to="/constellation"
          onClick={handleClick}
          className="block premium-card p-4 border hover:bg-white/5 transition-all relative"
          style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            style={{ color: 'var(--premium-text-tertiary)' }}
            aria-label="Dismiss"
          >
            ×
          </button>
          <div className="flex items-center gap-3 pr-8">
            <Link2 className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                Link your thoughts, articles, and projects together
              </p>
              <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                Blue badges show connections • View graph →
              </p>
            </div>
          </div>
        </Link>
      </section>
    )
  }

  // Render sections in adaptive order
  const renderSections = () => {
    const sectionMap: Record<SectionId, () => JSX.Element | null> = {
      'smart-suggestion': SmartSuggestionSection,
      'priority-projects': PriorityProjectsSection,
      'daily-queue': DailyQueueSection,
      'quick-stats': QuickStatsSection,
      'connection-hint': ConnectionHintSection
    }

    return sectionOrder.map((sectionId, index) => {
      const SectionComponent = sectionMap[sectionId]
      return <div key={sectionId}>{SectionComponent()}</div>
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="min-h-screen py-6 pb-24">
        {/* Header with Search */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="premium-text-platinum flex-1 text-center" style={{
              fontSize: 'var(--premium-text-h1)',
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

        {/* Adaptive Layout - Sections render in order based on user behavior */}
        {renderSections()}
      </div>
    </motion.div>
  )
}
