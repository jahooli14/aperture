/**
 * Home Page - App Dashboard
 * Quick overview and navigation to key sections
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { Sparkles, Brain, Rocket, TrendingUp, ArrowRight, Plus } from 'lucide-react'

export function HomePage() {
  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()
  const { memories, fetchMemories } = useMemoryStore()

  useEffect(() => {
    fetchSuggestions()
    fetchProjects()
    fetchMemories()
  }, [])

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const sparkSuggestions = suggestions.filter(s => s.status === 'spark')
  const activeProjects = projects.filter(p => p.status === 'active')
  const recentMemories = memories.slice(0, 3)
  const recentSuggestions = pendingSuggestions.slice(0, 2)

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-neutral-900">
            Overview
          </h1>
          <p className="text-neutral-600 mt-1">
            Your creative workspace at a glance
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
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
                  <Link
                    key={suggestion.id}
                    to={`/suggestions/${suggestion.id}`}
                    className="pro-card p-4 block hover-lift border-2 border-transparent hover:border-orange-200"
                  >
                    <h3 className="font-medium text-neutral-900 mb-1">
                      {suggestion.title}
                    </h3>
                    <p className="text-sm text-neutral-600 line-clamp-2">
                      {suggestion.description}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="pro-card p-8 text-center">
                  <Sparkles className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600 mb-4">No new suggestions yet</p>
                  <Link
                    to="/suggestions"
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    View Suggestions
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
                  <div
                    key={memory.id}
                    className="pro-card p-4 border-2 border-transparent"
                  >
                    <div className="text-sm text-neutral-900 line-clamp-3">
                      {memory.body || memory.title}
                    </div>
                    <div className="text-xs text-neutral-500 mt-2">
                      {new Date(memory.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="pro-card p-8 text-center">
                  <Brain className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600 mb-4">No memories captured yet</p>
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
                    to={`/projects/${project.id}`}
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
              <div className="pro-card p-12 text-center">
                <Rocket className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  No active projects
                </h3>
                <p className="text-neutral-600 mb-6">
                  Start building by turning sparks into projects
                </p>
                <Link
                  to="/suggestions?filter=spark"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  View Sparks
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
