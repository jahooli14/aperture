/**
 * Home Page - Progress Dashboard
 * Keeps users on track with their goals and active projects
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useToast } from '../components/ui/toast'
import { Brain, Rocket, TrendingUp, ArrowRight, Plus, BookOpen, Clock, Zap, Battery, Link2, Sparkles } from 'lucide-react'
import type { ProjectScore, DailyQueueResponse } from '../types'

export function HomePage() {
  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()
  const [dailyQueue, setDailyQueue] = useState<ProjectScore[]>([])
  const [queueLoading, setQueueLoading] = useState(false)

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="min-h-screen py-6 pb-24">
        {/* Simple Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <h1 className="premium-text-platinum text-center" style={{
            fontSize: 'var(--premium-text-h1)',
            fontWeight: 700,
            letterSpacing: 'var(--premium-tracking-tight)'
          }}>
            Clandestined
          </h1>
        </div>

        {/* Priority Projects - At the Top! */}
        {priorityProjects.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
            <div className="premium-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-6 w-6" style={{ color: 'var(--premium-amber)' }} />
                <h2 className="premium-text-platinum" style={{
                  fontSize: 'var(--premium-text-h3)',
                  fontWeight: 700
                }}>
                  ⭐ Priority Projects
                </h2>
              </div>
              <div className="space-y-4">
                {priorityProjects.map(project => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block premium-glass-subtle p-4 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold flex-1" style={{ color: 'var(--premium-text-primary)', fontSize: 'var(--premium-text-body-lg)' }}>
                        {project.title}
                      </h3>
                      <ArrowRight className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--premium-amber)' }} />
                    </div>
                    {project.metadata?.next_step && (
                      <div className="premium-glass-subtle rounded-lg p-3 mt-3">
                        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--premium-amber)' }}>
                          NEXT STEP:
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                          {project.metadata.next_step}
                        </div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Today's Focus - Daily Queue */}
        {dailyQueue.length > 0 && (
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

                  const getCategoryColor = (category: string) => {
                    switch (category) {
                      case 'hot_streak': return 'linear-gradient(135deg, #3b82f6, #ef4444)'
                      case 'needs_attention': return 'linear-gradient(135deg, #f59e0b, #3b82f6)'
                      case 'fresh_energy': return 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                      default: return 'linear-gradient(135deg, #6b7280, #9ca3af)'
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
                    <Link
                      key={score.project_id}
                      to="/today"
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
                      <div className="mb-4 p-3 rounded-lg" style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
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
        )}

        {/* Quick Stats Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/memories" className="premium-stat-card group">
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

            <Link to="/suggestions" className="premium-stat-card group">
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

            <Link to="/suggestions?filter=spark" className="premium-stat-card group">
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

            <Link to="/projects" className="premium-stat-card group">
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

        {/* Simplified Connection Hint - Only show if user has content */}
        {memories.length > 0 && projects.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
            <Link to="/constellation" className="block premium-card p-4 border hover:bg-white/5 transition-all" style={{
              borderColor: 'rgba(59, 130, 246, 0.2)'
            }}>
              <div className="flex items-center gap-3">
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
        )}
      </div>
    </motion.div>
  )
}
