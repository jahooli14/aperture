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
import { Sparkles, Calendar, Brain, Lightbulb, Database, Network, Workflow } from 'lucide-react'
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
        title: 'Project Created',
        description: `"${projectData.title}" has been added to your projects.`,
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
      className="min-h-screen pt-12 pb-24"
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
            className="premium-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '9999px' }}
          >
            {synthesizing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze & Generate
              </>
            )}
          </button>
        </div>
        {/* Centered header content below button */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Sparkles className="h-12 w-12" style={{ color: 'var(--premium-blue)' }} />
          </div>
          <h1 className="premium-text-platinum mb-3" style={{
            fontSize: 'var(--premium-text-display-sm)',
            fontWeight: 700,
            letterSpacing: 'var(--premium-tracking-tight)'
          }}>
            Project Suggestions
          </h1>
          <p style={{
            fontSize: 'var(--premium-text-body-lg)',
            color: 'var(--premium-text-secondary)'
          }}>
            AI-generated project recommendations based on your knowledge and interests
          </p>
        </div>
        {/* Progress Bar */}
        {synthesizing && (
          <div className="flex justify-center mt-4">
            <div className="w-[300px] h-2 rounded-full overflow-hidden" style={{
              background: 'var(--premium-surface-2)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  background: 'var(--premium-blue)',
                  boxShadow: 'var(--premium-glow-blue)'
                }}
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
                    ? 'premium-btn-primary shadow-md'
                    : 'premium-glass border-2'
                }`}
                style={filter !== key ? {
                  color: 'var(--premium-text-secondary)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                } : undefined}
              >
                {label}
              </Button>
            ))}
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 premium-glass" style={{
            borderColor: 'rgba(239, 68, 68, 0.3)',
            background: 'rgba(220, 38, 38, 0.1)'
          }}>
            <CardContent className="pt-6">
              <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <Card className="premium-card">
            <CardContent className="py-24">
              <div className="text-center">
                <div
                  className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-r-transparent mb-4"
                  style={{
                    borderColor: 'var(--premium-blue)',
                    borderRightColor: 'transparent'
                  }}
                ></div>
                <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Loading suggestions...</p>
              </div>
            </CardContent>
          </Card>
        ) : suggestions.length === 0 ? (
          /* Empty State */
          <Card className="premium-card">
            <CardContent className="py-16">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center justify-center mb-6">
                  <Database className="h-12 w-12" style={{ color: 'var(--premium-blue)' }} />
                </div>
                <h3 className="premium-text-platinum mb-4" style={{
                  fontSize: 'var(--premium-text-h1)',
                  fontWeight: 600,
                  letterSpacing: 'var(--premium-tracking-tight)'
                }}>AI-Powered Project Discovery</h3>
                <p className="max-w-xl mx-auto mb-8" style={{
                  fontSize: 'var(--premium-text-body-lg)',
                  color: 'var(--premium-text-secondary)',
                  lineHeight: '1.6'
                }}>
                  Generate intelligent project recommendations by analyzing patterns across your captured thoughts, skills, and interests. The AI identifies viable connections between domains to suggest actionable projects.
                </p>

                {/* Feature highlights */}
                <div className="grid md:grid-cols-3 gap-6 mb-10">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center mb-3">
                      <Brain className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <p className="text-sm font-medium premium-text-platinum mb-1">Content Analysis</p>
                    <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Extracts themes and capabilities from your knowledge base
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="inline-flex items-center justify-center mb-3">
                      <Network className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <p className="text-sm font-medium premium-text-platinum mb-1">Cross-Domain Synthesis</p>
                    <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Identifies non-obvious combinations across different areas
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="inline-flex items-center justify-center mb-3">
                      <Workflow className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <p className="text-sm font-medium premium-text-platinum mb-1">Actionable Recommendations</p>
                    <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Generates concrete project proposals with implementation paths
                    </p>
                  </div>
                </div>

                <div className="premium-glass-subtle rounded-lg p-4 inline-block">
                  <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                    Click <span className="premium-text-platinum font-semibold">Analyze & Generate</span> above to begin
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
