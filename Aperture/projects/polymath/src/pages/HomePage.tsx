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
  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()
  const { progress, requiredPrompts, fetchPrompts } = useOnboardingStore()
  const [dailyQueue, setDailyQueue] = useState<ProjectScore[]>([])
  const [cardOfTheDay, setCardOfTheDay] = useState<Memory | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  const [saveArticleOpen, setSaveArticleOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.allSettled([
          fetchSuggestions(),
          fetchProjects(),
          fetchMemories(),
          fetchDailyQueue(),
          fetchCardOfTheDay(),
          fetchPrompts()
        ])
      } catch (err) {
        console.error('[HomePage] Error loading data:', err)
      }
    }
    loadData()
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

  const pendingSuggestions = Array.isArray(suggestions) ? suggestions.filter(s => s.status === 'pending') : []
  const activeProjects = Array.isArray(projects) ? projects.filter(p => p.status === 'active') : []
  const priorityProject = Array.isArray(projects) ? projects.find(p => p.priority && p.status === 'active') : null
  const recentProject = activeProjects.length > 0
    ? activeProjects
        .filter(p => !p.priority)
        .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0]
    : null

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
            ) : dailyQueue.length > 0 ? (
              <div className="space-y-4">
                {dailyQueue.map((score) => {
                  const project = score.project
                  const nextStep = project.metadata?.next_step

                  return (
                    <Link
                      key={score.project_id}
                      to={`/projects/${score.project_id}`}
                      className="group block premium-glass-subtle p-5 rounded-xl transition-all duration-300 hover:bg-white/10"
                    >
                      {/* Category Badge */}
                      <div className="mb-3">
                        <span
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-md"
                          style={{ background: getCategoryColor(score.category) }}
                        >
                          {getCategoryLabel(score.category)}
                        </span>
                      </div>

                      {/* Project Title */}
                      <h3 className="premium-text-platinum font-bold text-xl mb-3 flex items-start justify-between gap-2">
                        <span className="flex-1">{project.title}</span>
                        <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-amber)' }} />
                      </h3>

                      {/* Next Step */}
                      {nextStep && (
                        <div className="premium-glass-subtle rounded-lg p-4 mb-3">
                          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--premium-amber)' }}>
                            NEXT STEP:
                          </div>
                          <div className="premium-text-platinum font-medium">
                            {nextStep}
                          </div>
                        </div>
                      )}

                      {/* Match Reason */}
                      <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                        {score.match_reason}
                      </p>
                    </Link>
                  )
                })}

                <Link
                  to="/today"
                  className="block text-center py-3 rounded-lg font-medium transition-all hover:bg-white/5"
                  style={{ color: 'var(--premium-blue)' }}
                >
                  View Full Daily Queue <ArrowRight className="inline h-4 w-4 ml-1" />
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
            <div className="flex items-center gap-3 mb-6">
              <Plus className="h-7 w-7" style={{ color: 'var(--premium-indigo)' }} />
              <h2 className="text-2xl font-bold premium-text-platinum">Add Something New</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Voice Note - Opens voice modal (handled by FloatingNav FAB) */}
              <button
                onClick={() => {
                  // Trigger the floating voice button
                  const voiceFab = document.querySelector('[data-voice-fab]') as HTMLButtonElement
                  if (voiceFab) voiceFab.click()
                }}
                className="group premium-glass-subtle p-6 rounded-xl transition-all hover:bg-white/10 text-left"
              >
                <div className="flex flex-col items-start gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all" style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }}>
                    <Mic className="h-6 w-6" style={{ color: 'var(--premium-indigo)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 premium-text-platinum">Voice Note</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Speak your thoughts
                    </p>
                  </div>
                </div>
              </button>

              {/* Written Thought */}
              <button
                onClick={() => navigate('/memories')}
                className="group premium-glass-subtle p-6 rounded-xl transition-all hover:bg-white/10 text-left"
              >
                <div className="flex flex-col items-start gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all" style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }}>
                    <Brain className="h-6 w-6" style={{ color: 'var(--premium-indigo)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 premium-text-platinum">Thought</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Write a memory
                    </p>
                  </div>
                </div>
              </button>

              {/* Article */}
              <button
                onClick={() => setSaveArticleOpen(true)}
                className="group premium-glass-subtle p-6 rounded-xl transition-all hover:bg-white/10 text-left"
              >
                <div className="flex flex-col items-start gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all" style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <FileText className="h-6 w-6" style={{ color: 'var(--premium-emerald)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 premium-text-platinum">Article</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Save to read later
                    </p>
                  </div>
                </div>
              </button>

              {/* Project */}
              <button
                onClick={() => navigate('/projects')}
                className="group premium-glass-subtle p-6 rounded-xl transition-all hover:bg-white/10 text-left"
              >
                <div className="flex flex-col items-start gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all" style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>
                    <FolderKanban className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1 premium-text-platinum">Project</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Start building
                    </p>
                  </div>
                </div>
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
                to="/timeline"
                className="group premium-glass-subtle p-5 rounded-xl transition-all hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-6 w-6 mt-1" style={{ color: 'var(--premium-blue)' }} />
                    <div>
                      <h3 className="font-bold mb-1 premium-text-platinum">Timeline</h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                        See your thinking patterns
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
    </motion.div>
  )
}
