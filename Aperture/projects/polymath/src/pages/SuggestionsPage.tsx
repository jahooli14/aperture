/**
 * Suggestions Page - Stunning Visual Design
 */

import { useEffect, useState, useRef } from 'react'
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

  const handleBuildConfirm = async (projectData: { title: string; description: string; type: 'creative' | 'technical' | 'learning' }) => {
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
    <div className="min-h-screen py-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
        <div className="inline-flex items-center justify-center mb-4">
          <Sparkles className="h-12 w-12 text-orange-600" />
        </div>
        <h1 className="text-4xl font-bold mb-3 text-neutral-900">
          Project Suggestions
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-6">
          Ideas that match what you can do with what you care about
        </p>
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={handleSynthesize}
              disabled={synthesizing}
              className="btn-primary inline-flex items-center gap-2 min-w-[200px]"
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
            </Button>

            {/* Progress Bar */}
            {synthesizing && (
              <div className="w-[300px] h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}
          </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-10">
          <div className="flex flex-wrap gap-2 justify-center">
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
                    ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 bg-white rounded-full px-6 py-3 border-2 border-gray-200 w-fit mx-auto">
            <Label htmlFor="sort" className="text-sm font-semibold whitespace-nowrap text-gray-700">
              Sort by:
            </Label>
            <Select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border-0 bg-transparent font-medium text-gray-900 focus:ring-0 pr-8"
            >
              <option value="points">Points</option>
              <option value="recent">Recent</option>
              <option value="rating">Rating</option>
            </Select>
          </div>
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
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent mb-4"></div>
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
                    <Sparkles className="h-16 w-16 text-orange-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-neutral-900 mb-4">Your Suggestions Are On The Way</h3>
                  <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                    Polymath generates personalized project ideas by analyzing your interests and capabilities.
                  </p>
                </div>

                {/* How it works */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-2">1. Capture Ideas</h4>
                    <p className="text-sm text-neutral-600">
                      Record your thoughts and interests via voice notes or manual entries
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-2">2. AI Synthesis</h4>
                    <p className="text-sm text-neutral-600">
                      Every Monday at 9am UTC, AI generates unique project suggestions for you
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                      <Lightbulb className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-2">3. Get Inspired</h4>
                    <p className="text-sm text-neutral-600">
                      Review suggestions, rate what sparks your interest, and build projects
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="text-center space-y-4">
                  <p className="text-neutral-600 font-medium">
                    Next synthesis runs <span className="font-bold text-orange-600">Monday at 9:00 AM UTC</span>
                  </p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <Link to="/memories">
                      <Button className="btn-primary">
                        Capture Your First Memory
                      </Button>
                    </Link>
                    <Link to="/projects">
                      <Button className="btn-secondary">
                        View Your Projects
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm text-neutral-500 mt-6">
                    Tip: The more memories and interests you capture, the better your suggestions will be
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
    </div>
  )
}
