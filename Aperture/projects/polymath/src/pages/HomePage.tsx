/**
 * Home Page - Prestigious Design
 * Landing page with overview and quick stats
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { Sparkles, Brain, Rocket, TrendingUp, ArrowRight } from 'lucide-react'

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

  return (
    <div className="min-h-screen">
      {/* Hero Section - Prestigious */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-orange-50/30 to-white py-24 px-4">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-50/60 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center mb-8">
            <div className="relative">
              <Sparkles className="h-16 w-16 text-orange-600" strokeWidth={1.5} />
              <div className="absolute inset-0 bg-orange-600/10 blur-xl rounded-full" />
            </div>
          </div>

          {/* Main heading */}
          <h1 className="text-6xl md:text-7xl font-bold mb-6 text-neutral-900 tracking-tight">
            Polymath
          </h1>

          {/* Tagline */}
          <p className="text-2xl md:text-3xl font-light text-neutral-600 mb-6 tracking-wide">
            Your creative project companion
          </p>

          {/* Description */}
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            Discovers project ideas by connecting what you can do with what you love
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
            <Link
              to="/suggestions"
              className="btn-primary inline-flex items-center gap-2 text-lg px-8"
            >
              View Suggestions
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/memories"
              className="btn-secondary inline-flex items-center gap-2 text-lg px-8"
            >
              <Brain className="h-5 w-5" />
              My Memories
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Grid - Elevated Design */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 mb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Memories Stat */}
          <Link
            to="/memories"
            className="group pro-card hover-lift p-8 text-center border-2 border-transparent hover:border-orange-200"
          >
            <Brain className="h-10 w-10 text-orange-600 mx-auto mb-4" strokeWidth={1.5} />
            <div className="text-4xl font-bold text-neutral-900 mb-2">
              {memories.length}
            </div>
            <div className="text-sm font-medium text-neutral-600 mb-1">
              Total Memories
            </div>
            <div className="text-xs text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
              View all →
            </div>
          </Link>

          {/* New Suggestions Stat */}
          <Link
            to="/suggestions"
            className="group pro-card hover-lift p-8 text-center border-2 border-transparent hover:border-orange-200"
          >
            <Sparkles className="h-10 w-10 text-orange-600 mx-auto mb-4" strokeWidth={1.5} />
            <div className="text-4xl font-bold text-neutral-900 mb-2">
              {pendingSuggestions.length}
            </div>
            <div className="text-sm font-medium text-neutral-600 mb-1">
              New Suggestions
            </div>
            <div className="text-xs text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Rate ideas →
            </div>
          </Link>

          {/* Sparks Stat */}
          <Link
            to="/suggestions?filter=spark"
            className="group pro-card hover-lift p-8 text-center border-2 border-transparent hover:border-amber-200 bg-gradient-to-br from-amber-50/50 to-white"
          >
            <TrendingUp className="h-10 w-10 text-amber-600 mx-auto mb-4" strokeWidth={1.5} />
            <div className="text-4xl font-bold text-neutral-900 mb-2">
              {sparkSuggestions.length}
            </div>
            <div className="text-sm font-medium text-neutral-600 mb-1">
              Sparks
            </div>
            <div className="text-xs text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Ideas you liked →
            </div>
          </Link>

          {/* Active Projects Stat */}
          <Link
            to="/projects"
            className="group pro-card hover-lift p-8 text-center border-2 border-transparent hover:border-orange-200"
          >
            <Rocket className="h-10 w-10 text-orange-600 mx-auto mb-4" strokeWidth={1.5} />
            <div className="text-4xl font-bold text-neutral-900 mb-2">
              {activeProjects.length}
            </div>
            <div className="text-sm font-medium text-neutral-600 mb-1">
              Active Projects
            </div>
            <div className="text-xs text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Currently working →
            </div>
          </Link>
        </div>
      </section>

      {/* How It Works - Premium Design */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-neutral-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Polymath combines AI synthesis with your personal knowledge graph
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Step 1 */}
          <div className="relative">
            <div className="pro-card p-8 h-full">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold mb-6">
                1
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                Capture Interests
              </h3>
              <p className="text-neutral-600 leading-relaxed">
                Voice notes and manual entries reveal recurring themes and topics you care about
              </p>
            </div>
            {/* Connector line - hidden on mobile */}
            <div className="hidden lg:block absolute top-14 left-full w-8 h-px bg-gradient-to-r from-orange-200 to-transparent" />
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="pro-card p-8 h-full">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                Build Capabilities
              </h3>
              <p className="text-neutral-600 leading-relaxed">
                System tracks your technical skills and strengths as you complete projects
              </p>
            </div>
            <div className="hidden lg:block absolute top-14 left-full w-8 h-px bg-gradient-to-r from-orange-200 to-transparent" />
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="pro-card p-8 h-full">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                AI Synthesis
              </h3>
              <p className="text-neutral-600 leading-relaxed">
                Weekly generation of novel project ideas at the intersection of your skills and interests
              </p>
            </div>
            <div className="hidden lg:block absolute top-14 left-full w-8 h-px bg-gradient-to-r from-orange-200 to-transparent" />
          </div>

          {/* Step 4 */}
          <div className="pro-card p-8 h-full">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold mb-6">
              4
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-3">
              Rate & Build
            </h3>
            <p className="text-neutral-600 leading-relaxed">
              Spark ideas you like, build them into projects, and the system learns your preferences
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="pro-card p-12 text-center bg-gradient-to-br from-orange-50/50 to-white border-2 border-orange-100">
          <h3 className="text-3xl font-bold text-neutral-900 mb-4">
            Ready to start synthesizing?
          </h3>
          <p className="text-lg text-neutral-600 mb-8 max-w-2xl mx-auto">
            Capture your first memory or explore AI-generated project suggestions
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/suggestions" className="btn-primary inline-flex items-center gap-2 text-lg px-8">
              View Suggestions
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/projects" className="btn-secondary inline-flex items-center gap-2 text-lg px-8">
              <Rocket className="h-5 w-5" />
              My Projects
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
