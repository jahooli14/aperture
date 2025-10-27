/**
 * Suggestions Page - Stunning Visual Design
 */

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { SuggestionCard } from '../components/suggestions/SuggestionCard'
import { SuggestionDetailDialog } from '../components/suggestions/SuggestionDetailDialog'
import { BuildProjectDialog } from '../components/suggestions/BuildProjectDialog'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { Sparkles, Calendar, Brain, Lightbulb } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/toast'
import type { ProjectSuggestion } from '../types'

export function SuggestionsPage() {
  const {
    suggestions,
    loading,
    error,
    filter,
    sortBy,
    synthesizing,
    fetchSuggestions,
    rateSuggestion,
    buildSuggestion,
    triggerSynthesis,
    setFilter,
    setSortBy
  } = useSuggestionStore()

  const [selectedSuggestion, setSelectedSuggestion] = useState<ProjectSuggestion | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [buildDialogOpen, setBuildDialogOpen] = useState(false)
  const [suggestionToBuild, setSuggestionToBuild] = useState<ProjectSuggestion | null>(null)
  const [progress, setProgress] = useState(0)

  const navigate = useNavigate()
  const { addToast } = useToast()
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const handleRate = async (id: string, rating: number) => {
    await rateSuggestion(id, rating)
  }

  const handleBuild = async (id: string) => {
    const suggestion = suggestions.find(s => s.id === id)
    if (suggestion) {
      setSuggestionToBuild(suggestion)
      setBuildDialogOpen(true)
    }
  }

  const handleBuildConfirm = async (projectData: { title: string; description: string }) => {
    if (!suggestionToBuild) return

    try {
      await buildSuggestion(suggestionToBuild.id, projectData)

      addToast({
        title: '🎉 Project built!',
        description: `"${projectData.title}" is now in your projects.`,
        variant: 'success',
      })

      setBuildDialogOpen(false)

      // Navigate to projects page after short delay
      setTimeout(() => {
        navigate('/projects')
      }, 1500)
    } catch (error) {
      addToast({
        title: 'Failed to build project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
      throw error // Re-throw to keep dialog open
    }
  }

  const handleViewDetail = (id: string) => {
    const suggestion = suggestions.find(s => s.id === id)
    if (suggestion) {
      setSelectedSuggestion(suggestion)
      setDetailDialogOpen(true)
    }
  }

  const handleSynthesize = async () => {
    try {
      // Reset and start progress
      setProgress(0)

      // Simulate progress (real synthesis takes ~20-40 seconds)
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          // Slow down as we approach 90% to avoid completing before API
          if (prev < 50) return prev + 3
          if (prev < 70) return prev + 2
          if (prev < 90) return prev + 1
          return prev + 0.5
        })
      }, 500)

      await triggerSynthesis()

      // Complete progress
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
      setProgress(100)

      // Reset after short delay
      setTimeout(() => setProgress(0), 500)
    } catch (error) {
      console.error('Synthesis failed:', error)
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
      setProgress(0)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  return (
    <motion.div
      className="min-h-screen py-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header with Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        {/* Button row - pushes content down */}
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="px-6 py-2.5 bg-blue-900 text-white rounded-full font-medium hover:bg-blue-950 transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {synthesizing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Ideas
              </>
            )}
          </button>
        </div>
        {/* Centered header content below button */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Sparkles className="h-12 w-12 text-blue-900" />
          </div>
          <h1 className="text-4xl font-bold mb-3 text-neutral-900">
            Project Suggestions
          </h1>
          <p className="text-lg text-neutral-600">
            Ideas that match what you can do with what you care about
          </p>
        </div>
        {/* Progress Bar */}
        {synthesizing && (
          <div className="flex justify-center mt-4">
            <div className="w-[300px] h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-900 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2 justify-center mb-10">
            {[
              { key: 'pending', label: 'New' },
              { key: 'spark', label: 'Sparks' },
              { key: 'saved', label: 'Saved' },
              { key: 'built', label: 'Built' },
              { key: 'all', label: 'All' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                onClick={() => setFilter(key as typeof filter)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
                  filter === key
                    ? 'bg-blue-900 text-white shadow-md hover:bg-blue-950'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                {label}
              </Button>
            ))}
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600 font-semibold">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <Card className="pro-card">
            <CardContent className="py-24">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-900 border-r-transparent mb-4"></div>
                <p className="text-lg text-neutral-600">Loading suggestions...</p>
              </div>
            </CardContent>
          </Card>
        ) : suggestions.length === 0 ? (
          /* Empty State */
          <Card className="pro-card">
            <CardContent className="py-16">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-12">
                  <div className="inline-flex items-center justify-center mb-6">
                    <Sparkles className="h-16 w-16 text-blue-900" />
                  </div>
                  <h3 className="text-3xl font-bold text-neutral-900 mb-4">Ready to See the Magic?</h3>
                  <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-6">
                    You have thoughts captured. Let's see what happens when AI connects them.
                  </p>

                  {/* Highlight Generate Ideas button */}
                  <div className="inline-block bg-gradient-to-r from-blue-50 to-amber-50 border-2 border-blue-200 rounded-2xl p-8 mb-8 animate-pulse-subtle">
                    <p className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">Click the button above ↗</p>
                    <p className="text-2xl font-bold text-neutral-900 mb-2">Generate Ideas</p>
                    <p className="text-sm text-neutral-600">Watch AI synthesize your thoughts into project suggestions in real-time</p>
                  </div>
                </div>

                {/* How it works */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-900 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-2">1. Analyze Thoughts</h4>
                    <p className="text-sm text-neutral-600">
                      AI reads your captured interests, skills, and life insights
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-900 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-2">2. Find Connections</h4>
                    <p className="text-sm text-neutral-600">
                      Discovers unexpected combinations between your work AND hobbies
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-900 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                      <Lightbulb className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-2">3. Generate Projects</h4>
                    <p className="text-sm text-neutral-600">
                      Creates unique project ideas that bridge domains
                    </p>
                  </div>
                </div>

                {/* Demo tip */}
                <div className="text-center">
                  <p className="text-sm text-neutral-500 mb-2">
                    💡 <strong>Demo Tip:</strong> Watch for cross-domain synthesis like "Parenting + React" or "Woodworking + Tech"
                  </p>
                  <p className="text-xs text-neutral-400">
                    Synthesis takes 20-30 seconds - real AI at work, not static templates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Suggestions Grid - Bento Box Layout with Stagger Animation */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children mt-8">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onRate={handleRate}
                onBuild={handleBuild}
                onViewDetail={handleViewDetail}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <SuggestionDetailDialog
        suggestion={selectedSuggestion}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onRate={handleRate}
        onBuild={handleBuild}
      />

      {/* Build Project Dialog */}
      <BuildProjectDialog
        suggestion={suggestionToBuild}
        open={buildDialogOpen}
        onOpenChange={setBuildDialogOpen}
        onConfirm={handleBuildConfirm}
      />
    </motion.div>
  )
}
