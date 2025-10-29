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
import { Brain, Rocket, TrendingUp, ArrowRight, Plus, BookOpen, Clock, Zap, Battery } from 'lucide-react'
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

  // Get today's date and motivational message
  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const motivationalMessages = [
    "Let's make progress today",
    "Every step forward counts",
    "Your ideas deserve attention",
    "Build something meaningful",
    "Turn thoughts into action"
  ]
  const motivationalMessage = motivationalMessages[today.getDay() % motivationalMessages.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="min-h-screen py-6 pb-24">
        {/* Header Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <h1 className="premium-text-platinum mb-2" style={{
            fontSize: 'var(--premium-text-h1)',
            fontWeight: 700,
            letterSpacing: 'var(--premium-tracking-tight)',
            textShadow: '0 0 20px rgba(229, 231, 235, 0.2)'
          }}>
            Welcome to Clandestined
          </h1>
          <div className="flex items-center justify-center gap-3 flex-wrap" style={{ color: 'var(--premium-text-secondary)' }}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span style={{ fontSize: 'var(--premium-text-body-base)' }}>{dateString}</span>
            </div>
            <span>•</span>
            <p style={{ fontSize: 'var(--premium-text-body-lg)', fontWeight: 500 }}>
              {motivationalMessage}
            </p>
          </div>
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

        {/* Recent Activity - 3 Columns */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <h2 className="premium-text-platinum mb-4" style={{ fontSize: 'var(--premium-text-h3)', fontWeight: 700 }}>
            Recent Activity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Latest Thoughts */}
            <div className="premium-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="h-6 w-6" style={{ color: 'var(--premium-indigo)' }} />
                <h3 className="premium-text-platinum font-semibold" style={{ fontSize: 'var(--premium-text-body-lg)' }}>
                  Latest Thoughts
                </h3>
              </div>
              <div className="space-y-3">
                {recentMemories.length > 0 ? (
                  <>
                    {recentMemories.map(memory => (
                      <Link
                        key={memory.id}
                        to="/memories"
                        className="block premium-glass-subtle p-3 rounded-lg hover:bg-white/10 transition-all"
                      >
                        <div className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                          {memory.body || memory.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                          <Clock className="h-3 w-3" />
                          {new Date(memory.created_at).toLocaleDateString()}
                        </div>
                      </Link>
                    ))}
                    <Link
                      to="/memories"
                      className="block text-center text-sm font-medium pt-2" style={{ color: 'var(--premium-indigo)' }}
                    >
                      View all thoughts →
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" style={{ color: 'var(--premium-indigo)' }} />
                    <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                      No thoughts yet
                    </p>
                    <Link to="/memories" className="text-sm font-medium" style={{ color: 'var(--premium-indigo)' }}>
                      Capture your first →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Reading */}
            <div className="premium-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="h-6 w-6" style={{ color: 'var(--premium-emerald)' }} />
                <h3 className="premium-text-platinum font-semibold" style={{ fontSize: 'var(--premium-text-body-lg)' }}>
                  Latest Reading
                </h3>
              </div>
              <div className="text-center py-6">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" style={{ color: 'var(--premium-emerald)' }} />
                <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                  No reading items yet
                </p>
                <Link to="/reading" className="text-sm font-medium" style={{ color: 'var(--premium-emerald)' }}>
                  Add reading →
                </Link>
              </div>
            </div>

            {/* Active Project Progress */}
            <div className="premium-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <Rocket className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                <h3 className="premium-text-platinum font-semibold" style={{ fontSize: 'var(--premium-text-body-lg)' }}>
                  Project Progress
                </h3>
              </div>
              <div className="space-y-3">
                {activeProjects.length > 0 ? (
                  <>
                    {activeProjects.slice(0, 3).map(project => (
                      <Link
                        key={project.id}
                        to="/projects"
                        className="block premium-glass-subtle p-3 rounded-lg hover:bg-white/10 transition-all"
                      >
                        <div className="font-medium mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                          {project.title}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                          Status: Active
                        </div>
                      </Link>
                    ))}
                    <Link
                      to="/projects"
                      className="block text-center text-sm font-medium pt-2" style={{ color: 'var(--premium-blue)' }}
                    >
                      View all projects →
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Rocket className="h-10 w-10 mx-auto mb-2 opacity-50" style={{ color: 'var(--premium-blue)' }} />
                    <p className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                      No active projects
                    </p>
                    <Link to="/projects" className="text-sm font-medium" style={{ color: 'var(--premium-blue)' }}>
                      Create project →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions - Always Visible */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="premium-text-platinum mb-4" style={{ fontSize: 'var(--premium-text-h3)', fontWeight: 700 }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/memories"
              className="premium-card p-6 text-center group hover:bg-white/5 transition-all"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--premium-indigo-glow)' }}>
                <Brain className="h-8 w-8" style={{ color: 'var(--premium-indigo)' }} />
              </div>
              <h3 className="premium-text-platinum font-bold mb-2" style={{ fontSize: 'var(--premium-text-body-lg)' }}>
                Capture Thought
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                Record a voice note or write down an idea
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--premium-indigo)' }}>
                Start now <ArrowRight className="h-4 w-4" />
              </div>
            </Link>

            <Link
              to="/reading"
              className="premium-card p-6 text-center group hover:bg-white/5 transition-all"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--premium-emerald-glow)' }}>
                <BookOpen className="h-8 w-8" style={{ color: 'var(--premium-emerald)' }} />
              </div>
              <h3 className="premium-text-platinum font-bold mb-2" style={{ fontSize: 'var(--premium-text-body-lg)' }}>
                Add Reading
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                Save articles and content for later
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--premium-emerald)' }}>
                Add item <ArrowRight className="h-4 w-4" />
              </div>
            </Link>

            <Link
              to="/projects"
              className="premium-card p-6 text-center group hover:bg-white/5 transition-all"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--premium-blue-glow)' }}>
                <Rocket className="h-8 w-8" style={{ color: 'var(--premium-blue)' }} />
              </div>
              <h3 className="premium-text-platinum font-bold mb-2" style={{ fontSize: 'var(--premium-text-body-lg)' }}>
                Create Project
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                Turn your ideas into tracked projects
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--premium-blue)' }}>
                Get started <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        </section>
      </div>
    </motion.div>
  )
}
