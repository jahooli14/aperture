/**
 * Home Page - App Dashboard
 * Quick overview and navigation to key sections
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { SuggestionDetailDialog } from '../components/suggestions/SuggestionDetailDialog'
import { DemoDataBanner } from '../components/onboarding/DemoDataBanner'
import { Sparkles, Brain, Rocket, TrendingUp, ArrowRight, Plus } from 'lucide-react'
import type { ProjectSuggestion } from '../types'
import { supabase } from '../lib/supabase'

export function HomePage() {
  const { suggestions, fetchSuggestions, rateSuggestion, buildSuggestion } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()

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
  const recentMemories = memories.slice(0, 3)
  const recentSuggestions = pendingSuggestions.slice(0, 2)

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

  return (
    <>
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
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900">
            Overview
          </h1>
        </div>

        {/* Stats Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Memories Stat */}
            <Link
              to="/memories"
              className="group pro-card hover-lift p-6 border-2 border-transparent hover:border-orange-200"
            >
              <div className="flex items-center justify-between mb-3">
                <Brain className="h-8 w-8 text-orange-600" strokeWidth={1.5} />
                <ArrowRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-1">
                {memories.length}
              </div>
              <div className="text-sm text-neutral-600">
                Memories
              </div>
            </Link>

            {/* New Suggestions Stat */}
            <Link
              to="/suggestions"
              className="group pro-card hover-lift p-6 border-2 border-transparent hover:border-orange-200"
            >
              <div className="flex items-center justify-between mb-3">
                <Sparkles className="h-8 w-8 text-orange-600" strokeWidth={1.5} />
                <ArrowRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-1">
                {pendingSuggestions.length}
              </div>
              <div className="text-sm text-neutral-600">
                New Ideas
              </div>
            </Link>

            {/* Sparks Stat */}
            <Link
              to="/suggestions?filter=spark"
              className="group pro-card hover-lift p-6 border-2 border-transparent hover:border-amber-200"
            >
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="h-8 w-8 text-amber-600" strokeWidth={1.5} />
                <ArrowRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-1">
                {sparkSuggestions.length}
              </div>
              <div className="text-sm text-neutral-600">
                Sparks
              </div>
            </Link>

            {/* Active Projects Stat */}
            <Link
              to="/projects"
              className="group pro-card hover-lift p-6 border-2 border-transparent hover:border-orange-200"
            >
              <div className="flex items-center justify-between mb-3">
                <Rocket className="h-8 w-8 text-orange-600" strokeWidth={1.5} />
                <ArrowRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-1">
                {activeProjects.length}
              </div>
              <div className="text-sm text-neutral-600">
                Active
              </div>
            </Link>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Suggestions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Recent Suggestions
                </h2>
                <Link
                  to="/suggestions"
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
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
                      className="pro-card p-4 w-full text-left hover-lift border-2 border-transparent hover:border-orange-200"
                    >
                      <h3 className="font-medium text-neutral-900 mb-1">
                        {suggestion.title}
                      </h3>
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {suggestion.description}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="pro-card p-8 text-center">
                    <Sparkles className="h-12 w-12 text-orange-400 mx-auto mb-3" />
                    <p className="text-neutral-900 font-semibold mb-2">Ready to Generate Ideas?</p>
                    <p className="text-sm text-neutral-600 mb-4">
                      {memories.length > 0
                        ? "You have memories captured. Click Generate Ideas to see AI synthesis!"
                        : "Add some memories, then generate personalized project suggestions"
                      }
                    </p>
                    <Link
                      to="/suggestions"
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {memories.length > 0 ? "Generate Ideas" : "View Suggestions"}
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Recent Memories */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Recent Memories
                </h2>
                <Link
                  to="/memories"
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
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
                      className="pro-card p-4 block hover-lift border-2 border-transparent hover:border-orange-200"
                    >
                      <div className="text-sm text-neutral-900 line-clamp-3">
                        {memory.body || memory.title}
                      </div>
                      <div className="text-xs text-neutral-500 mt-2">
                        {new Date(memory.created_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="pro-card p-8 text-center">
                    <Brain className="h-12 w-12 text-orange-400 mx-auto mb-3" />
                    <p className="text-neutral-900 font-semibold mb-2">Start Your Knowledge Graph</p>
                    <p className="text-sm text-neutral-600 mb-4">
                      Capture your thoughts, skills, and interests via voice notes or text
                    </p>
                    <Link
                      to="/memories"
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Memory
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Active Projects */}
            <section className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Active Projects
                </h2>
                <Link
                  to="/projects"
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
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
                      className="pro-card p-5 hover-lift border-2 border-transparent hover:border-orange-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-neutral-900 flex-1">
                          {project.title}
                        </h3>
                        <Rocket className="h-5 w-5 text-orange-600 flex-shrink-0 ml-2" />
                      </div>
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {project.description}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="pro-card p-8 text-center">
                  <Rocket className="h-12 w-12 text-orange-400 mx-auto mb-3" />
                  <p className="text-neutral-900 font-semibold mb-2">Build Your First Project</p>
                  <p className="text-sm text-neutral-600 mb-4">
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
    </>
  )
}
