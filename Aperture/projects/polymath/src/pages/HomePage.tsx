/**
 * Home Page - App Dashboard
 * Quick overview and navigation to key sections
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
import { SuggestionDetailDialog } from '../components/suggestions/SuggestionDetailDialog'
import { DemoDataBanner } from '../components/onboarding/DemoDataBanner'
import { Sparkles, Brain, Rocket, TrendingUp, ArrowRight, Plus } from 'lucide-react'
import type { ProjectSuggestion } from '../types'
import { supabase } from '../lib/supabase'

export function HomePage() {
  const { suggestions, fetchSuggestions, rateSuggestion, buildSuggestion } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()
  const { addOfflineCapture } = useOfflineSync()
  const { isOnline } = useOnlineStatus()
  const { addToast } = useToast()

  const [selectedSuggestion, setSelectedSuggestion] = useState<ProjectSuggestion | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [showDemoBanner, setShowDemoBanner] = useState(false)

  useEffect(() => {
    fetchSuggestions()
    fetchProjects()
    fetchMemories()
  }, [])

  useEffect(() => {
    // Always show banner if demo data is present (ignore dismissed state)
    if (memories.length > 0) {
      const hasDemoMemory = memories.some(m => m.audiopen_id?.startsWith('demo-'))
      if (hasDemoMemory) {
        setShowDemoBanner(true)
      }
    }
  }, [memories])

  const handleDataCleared = async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Clear user's data in order (respecting foreign keys)
      await supabase.from('project_suggestions').delete().eq('user_id', user.id)
      await supabase.from('projects').delete().eq('user_id', user.id)

      // Clear all memories (no user_id field in memories table)
      const demoMemoryIds = memories
        .filter(m => m.audiopen_id?.startsWith('demo-'))
        .map(m => m.id)

      if (demoMemoryIds.length > 0) {
        await supabase.from('memories').delete().in('id', demoMemoryIds)
      }

      // Mark demo as dismissed
      localStorage.setItem('polymath_demo_dismissed', 'true')

      // Refresh data
      await Promise.all([
        fetchMemories(),
        fetchSuggestions(),
        fetchProjects()
      ])

      setShowDemoBanner(false)
    } catch (error) {
      console.error('Error clearing demo data:', error)
    }
  }

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const sparkSuggestions = suggestions.filter(s => s.status === 'spark')
  const activeProjects = projects.filter(p => p.status === 'active')
  const priorityProjects = projects.filter(p => p.priority && p.metadata?.next_step) // NEW: Priority projects with next steps
  const recentMemories = memories.slice(0, 3)
  const recentSuggestions = pendingSuggestions.slice(0, 2)
  const [aiSparks, setAiSparks] = useState<any[]>([]) // NEW: AI-suggested connections

  // NEW: Fetch AI-generated connection suggestions (Sparks)
  useEffect(() => {
    const fetchAiSparks = async () => {
      try {
        const response = await fetch('/api/related?connections=true&ai_suggested=true&limit=3')
        if (response.ok) {
          const data = await response.json()
          setAiSparks(data.connections || [])
        }
      } catch (error) {
        console.error('Failed to fetch AI Sparks:', error)
      }
    }
    if (memories.length > 0 || projects.length > 0) {
      fetchAiSparks()
    }
  }, [memories.length, projects.length])

  const handleSuggestionClick = (suggestion: ProjectSuggestion) => {
    setSelectedSuggestion(suggestion)
    setDetailDialogOpen(true)
  }

  const handleRate = async (id: string, rating: number) => {
    await rateSuggestion(id, rating)
  }

  const handleBuild = async (id: string) => {
    // This would normally open build dialog, but we'll just navigate
    window.location.href = '/suggestions'
  }

  const handleVoiceCapture = async (transcript: string) => {
    if (!transcript) return

    try {
      if (isOnline) {
        // Online: send to memories API for parsing
        const response = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        })

        if (!response.ok) {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('text/html')) {
            throw new Error('Thoughts API not available')
          }
          throw new Error(`Failed to save thought: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('✓ Memory created:', data)

        // Success! Show confirmation
        addToast({
          title: 'Thought saved!',
          description: 'Your voice note has been captured.',
          variant: 'success',
        })

        await fetchMemories()
      } else {
        // Offline: queue for later
        await addOfflineCapture(transcript)
        addToast({
          title: 'Queued for sync',
          description: 'Will process when back online.',
          variant: 'default',
        })
      }
    } catch (error) {
      console.error('Failed to capture:', error)
      // Fallback to offline queue if API fails
      try {
        await addOfflineCapture(transcript)
        addToast({
          title: 'Queued for sync',
          description: 'Will process when API is available.',
          variant: 'default',
        })
      } catch (offlineError) {
        console.error('Failed to queue offline:', offlineError)
        addToast({
          title: 'Failed to save',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Demo Data Banner */}
      {showDemoBanner && (
        <DemoDataBanner
          onDismiss={() => {
            // Don't save dismissed state - always show if demo data exists
            setShowDemoBanner(false)
          }}
          onDataCleared={handleDataCleared}
        />
      )}

      <div className="min-h-screen py-12">
        {/* Header - Premium Typography */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
          <h1 className="premium-text-platinum" style={{
            fontSize: 'var(--premium-text-h1)',
            fontWeight: 700,
            letterSpacing: 'var(--premium-tracking-tight)',
            textShadow: '0 0 20px rgba(229, 231, 235, 0.2)'
          }}>
            Overview
          </h1>
        </div>

        {/* Stats Grid - Premium Dark */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Thoughts Stat */}
            <Link
              to="/memories"
              className="premium-stat-card group"
            >
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

            {/* New Suggestions Stat */}
            <Link
              to="/suggestions"
              className="premium-stat-card group"
            >
              <div className="flex items-center justify-between mb-3">
                <Sparkles className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--premium-blue)' }} />
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--premium-platinum-muted)' }} />
              </div>
              <div className="text-3xl font-bold mb-1 premium-text-platinum" style={{ fontSize: 'var(--premium-text-display-sm)', letterSpacing: 'var(--premium-tracking-tight)' }}>
                {pendingSuggestions.length}
              </div>
              <div className="text-sm" style={{ color: 'var(--premium-text-secondary)', fontSize: 'var(--premium-text-body-sm)', letterSpacing: 'var(--premium-tracking-wide)' }}>
                NEW IDEAS
              </div>
            </Link>

            {/* Sparks Stat */}
            <Link
              to="/suggestions?filter=spark"
              className="premium-stat-card group"
            >
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

            {/* Active Projects Stat */}
            <Link
              to="/projects"
              className="premium-stat-card group"
            >
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

        {/* Main Content Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          {/* NEW: Priority Project Steps - Top Module */}
          {priorityProjects.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 premium-text-platinum" style={{ fontSize: 'var(--premium-text-h2)', fontWeight: 700 }}>
                  <Rocket className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                  Active Project Steps
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priorityProjects.map(project => (
                  <Link
                    key={project.id}
                    to={`/projects`}
                    className="group premium-card p-6 transition-all duration-300"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg premium-text-platinum">{project.title}</h3>
                        <div className="px-2 py-1 rounded-lg premium-glass-subtle text-xs font-bold" style={{ color: 'var(--premium-blue)' }}>
                          PRIORITY
                        </div>
                      </div>
                      <div className="premium-glass-subtle rounded-xl p-4">
                        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--premium-blue)' }}>
                          NEXT STEP:
                        </div>
                        <div className="premium-text-platinum font-medium">
                          {project.metadata?.next_step}
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-2 transition-all duration-300 group-hover:h-3" style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* NEW: AI-Generated Sparks */}
            {aiSparks.length > 0 && (
              <section className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="flex items-center gap-2 premium-text-platinum" style={{ fontSize: 'var(--premium-text-h2)', fontWeight: 700 }}>
                    <Sparkles className="h-5 w-5" style={{ color: 'var(--premium-amber)' }} />
                    AI-Generated Sparks
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aiSparks.slice(0, 3).map((spark, index) => (
                    <div
                      key={index}
                      className="premium-card p-5 transition-all duration-300"
                    >
                      <div className="absolute top-0 right-0 p-2">
                        <Sparkles className="h-4 w-4" style={{ color: 'var(--premium-amber)' }} />
                      </div>
                      <div className="text-sm font-medium mb-2" style={{ color: 'var(--premium-amber)' }}>
                        Connection Suggestion
                      </div>
                      <div className="text-sm mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                        {spark.ai_reasoning || 'AI found a potential connection between your items'}
                      </div>
                      <button className="text-xs font-medium" style={{ color: 'var(--premium-blue)' }}>
                        View connection →
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Suggestions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="premium-text-platinum" style={{ fontSize: 'var(--premium-text-h2)', fontWeight: 700 }}>
                  Recent Suggestions
                </h2>
                <Link
                  to="/suggestions"
                  className="text-sm font-medium" style={{ color: 'var(--premium-blue)' }}
                >
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {recentSuggestions.length > 0 ? (
                  recentSuggestions.map(suggestion => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="group premium-card p-4 w-full text-left transition-all duration-300"
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }} />
                      <div className="relative z-10">
                        <h3 className="font-medium premium-text-platinum mb-1">
                          {suggestion.title}
                        </h3>
                        <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                          {suggestion.description}
                        </p>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                    </button>
                  ))
                ) : (
                  <div className="premium-card p-8 text-center">
                    <Sparkles className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--premium-blue)' }} />
                    <p className="premium-text-platinum font-semibold mb-2">Ready to Generate Sparks?</p>
                    <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                      {memories.length > 0
                        ? "You have thoughts captured. Click Generate Sparks to see AI connections!"
                        : "Add some thoughts, then generate personalized project suggestions"
                      }
                    </p>
                    <Link
                      to="/suggestions"
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {memories.length > 0 ? "Generate Sparks" : "View Suggestions"}
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Recent Thoughts */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="premium-text-platinum" style={{ fontSize: 'var(--premium-text-h2)', fontWeight: 700 }}>
                  Recent Thoughts
                </h2>
                <Link
                  to="/memories"
                  className="text-sm font-medium" style={{ color: 'var(--premium-blue)' }}
                >
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {recentMemories.length > 0 ? (
                  recentMemories.map(memory => (
                    <Link
                      key={memory.id}
                      to="/memories"
                      className="group premium-card p-4 block transition-all duration-300"
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }} />
                      <div className="relative z-10">
                        <div className="text-sm line-clamp-3" style={{ color: 'var(--premium-text-secondary)' }}>
                          {memory.body || memory.title}
                        </div>
                        <div className="text-xs mt-2" style={{ color: 'var(--premium-text-tertiary)' }}>
                          {new Date(memory.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
                    </Link>
                  ))
                ) : (
                  <div className="premium-card p-8 text-center">
                    <Brain className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--premium-indigo)' }} />
                    <p className="premium-text-platinum font-semibold mb-2">Start Your Knowledge Graph</p>
                    <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                      Capture your thoughts, skills, and interests via voice notes or text
                    </p>
                    <Link
                      to="/memories"
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Thought
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Active Projects */}
            <section className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="premium-text-platinum" style={{ fontSize: 'var(--premium-text-h2)', fontWeight: 700 }}>
                  Active Projects
                </h2>
                <Link
                  to="/projects"
                  className="text-sm font-medium" style={{ color: 'var(--premium-blue)' }}
                >
                  View all →
                </Link>
              </div>
              {activeProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeProjects.slice(0, 3).map(project => (
                    <Link
                      key={project.id}
                      to="/projects"
                      className="group premium-card p-5 transition-all duration-300"
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }} />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold premium-text-platinum flex-1">
                            {project.title}
                          </h3>
                          <Rocket className="h-5 w-5 flex-shrink-0 ml-2" style={{ color: 'var(--premium-blue)' }} />
                        </div>
                        <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                          {project.description}
                        </p>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2" style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="premium-card p-8 text-center">
                  <Rocket className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--premium-blue)' }} />
                  <p className="premium-text-platinum font-semibold mb-2">Build Your First Project</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                    Generate ideas, find what sparks, then build with progress tracking
                  </p>
                  <Link
                    to="/suggestions"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    View Suggestions
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Suggestion Detail Dialog */}
        <SuggestionDetailDialog
          suggestion={selectedSuggestion}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onRate={handleRate}
          onBuild={handleBuild}
        />
      </div>
    </motion.div>
  )
}
