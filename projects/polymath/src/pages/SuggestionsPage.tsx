/**
 * Suggestions Page - Focused Spotlight UI
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { BuildProjectDialog } from '../components/suggestions/BuildProjectDialog'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { EmptyState } from '../components/ui/empty-state'
import { 
  Database, 
  Brain,
  X, 
  Plus,
  Clock, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/toast'
import type { ProjectSuggestion } from '../types'
import { cn } from '../lib/utils'
import { Textarea } from '../components/ui/textarea'

export function SuggestionsPage() {
  const {
    suggestions,
    loading,
    error,
    synthesizing,
    fetchSuggestions,
    rateSuggestion,
    buildSuggestion,
    triggerSynthesis
  } = useSuggestionStore()
  const { setContext } = useContextEngineStore()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedbackMode, setFeedbackMode] = useState<'none' | 'no' | 'later' | 'yes'>('none')
  const [rationale, setRationale] = useState('')
  const [buildDialogOpen, setBuildDialogOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigate = useNavigate()
  const { addToast } = useToast()
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  // Filter for only pending suggestions for the spotlight
  const pendingSuggestions = useMemo(() => 
    suggestions.filter(s => s.status === 'pending'),
    [suggestions]
  )

  const currentSuggestion = pendingSuggestions[currentIndex]

  const RATIONALE_OPTIONS = {
    no: [
      "Not my focus right now",
      "Too complex",
      "Already doing something similar",
      "Not interested in this tech"
    ],
    later: [
      "Great idea, no time now",
      "Need to learn more first",
      "Waiting for a better moment",
      "Save for future inspiration"
    ]
  }

  useEffect(() => {
    setContext('page', 'suggestions', 'Suggestions')
  }, [])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const handleAction = (type: 'no' | 'later' | 'yes') => {
    if (type === 'yes') {
      setBuildDialogOpen(true)
    } else {
      setFeedbackMode(type)
    }
  }

  const submitFeedback = async () => {
    if (!currentSuggestion) return
    
    setIsSubmitting(true)
    try {
      const rating = feedbackMode === 'no' ? -1 : 1
      
      await rateSuggestion(currentSuggestion.id, rating as -1 | 1, rationale)
      
      addToast({
        title: feedbackMode === 'no' ? 'Suggestion Dismissed' : 'Saved for later',
        description: 'Your feedback helps improve future recommendations.',
        variant: 'default'
      })

      setFeedbackMode('none')
      setRationale('')
      
      if (currentIndex >= pendingSuggestions.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1)
      }
    } catch (err) {
      addToast({
        title: 'Error',
        description: 'Failed to save feedback.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBuildConfirm = async (projectData: { title: string; description: string }) => {
    if (!currentSuggestion) return

    try {
      await buildSuggestion(currentSuggestion.id, projectData)

      addToast({
        title: 'Project Created',
        description: `"${projectData.title}" has been added to your projects.`,
        variant: 'success',
      })

      setBuildDialogOpen(false)
      
      setTimeout(() => navigate('/projects'), 1000)
    } catch (error) {
      addToast({
        title: 'Failed to build project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleSynthesize = async () => {
    try {
      setProgress(0)
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev < 50) return prev + 3
          if (prev < 70) return prev + 2
          if (prev < 90) return prev + 1
          return prev + 0.5
        })
      }, 500)

      await triggerSynthesis()

      if (progressInterval.current) clearInterval(progressInterval.current)
      setProgress(100)
      setTimeout(() => {
        setProgress(0)
        setCurrentIndex(0)
      }, 500)
    } catch (error) {
      if (progressInterval.current) clearInterval(progressInterval.current)
      setProgress(0)
    }
  }

  if (error && pendingSuggestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full premium-card border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6 text-center">
            <Database className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Error Loading Suggestions</h3>
            <p className="text-red-400 mb-6">{error}</p>
            <Button onClick={() => fetchSuggestions()} variant="outline" className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20 relative overflow-hidden" style={{ paddingTop: '5.5rem' }}>
      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-96 opacity-10" style={{
          background: 'radial-gradient(ellipse at top, var(--premium-blue), transparent 70%)'
        }} />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold premium-text-platinum tracking-tight">Discovery</h1>
            <p className="text-slate-400 text-sm">Focused suggestions for your next move</p>
          </div>
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="px-5 py-2.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-sm font-semibold hover:bg-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {synthesizing ? <Sparkles className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {synthesizing ? 'Synthesizing...' : 'Generate New'}
          </button>
        </div>

        {/* Progress bar for synthesis */}
        <AnimatePresence>
          {synthesizing && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div 
                  className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="premium-card p-12 flex flex-col items-center justify-center space-y-4">
            <div className="h-12 w-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-400 animate-pulse">Scanning knowledge graph...</p>
          </div>
        ) : pendingSuggestions.length === 0 ? (
          <EmptyState
            icon={Database}
            title="All caught up"
            description="No new suggestions at the moment. Add more thoughts or trigger a new synthesis."
            action={
              <Button onClick={handleSynthesize} className="btn-primary rounded-full px-8">
                Generate Now
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {/* Spotlight Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSuggestion.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, y: -20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 rounded-[2rem] blur-xl opacity-50" />
                <Card className="relative bg-slate-900/80 border-white/10 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-2xl">
                  <CardContent className="p-8 md:p-12">
                    {/* Top Meta */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                        {currentSuggestion.is_wildcard ? '🎲 Wildcard' : 'Recommended'}
                      </div>
                      <div className="text-slate-500 text-xs font-medium">
                        {currentIndex + 1} of {pendingSuggestions.length}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-3xl md:text-4xl font-bold premium-text-platinum mb-6 leading-tight">
                      {currentSuggestion.title}
                    </h2>
                    <p className="text-lg md:text-xl text-slate-300 leading-relaxed mb-8">
                      {currentSuggestion.description}
                    </p>

                    {/* Reasoning Section */}
                    {currentSuggestion.synthesis_reasoning && (
                      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-8">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-bold text-purple-300 uppercase tracking-wide">AI Rationale</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed italic">
                          "{currentSuggestion.synthesis_reasoning}"
                        </p>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">Novelty</div>
                        <div className="text-lg font-bold text-blue-400">{Math.round(currentSuggestion.novelty_score * 100)}%</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">Feasibility</div>
                        <div className="text-lg font-bold text-emerald-400">{Math.round(currentSuggestion.feasibility_score * 100)}%</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">Interest</div>
                        <div className="text-lg font-bold text-purple-400">{Math.round(currentSuggestion.interest_score * 100)}%</div>
                      </div>
                    </div>

                    {/* Capabilities Tags */}
                    {currentSuggestion.capabilities && currentSuggestion.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-12">
                        {currentSuggestion.capabilities.map(cap => (
                          <span key={cap.id} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/5 text-xs font-semibold text-slate-400">
                            {cap.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Main Actions */}
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => handleAction('no')}
                        className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                      >
                        <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                          <X className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-red-400">No</span>
                      </button>

                      <button
                        onClick={() => handleAction('later')}
                        className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all"
                      >
                        <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                          <Clock className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-amber-400">Maybe Later</span>
                      </button>

                      <button
                        onClick={() => handleAction('yes')}
                        className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 hover:border-blue-500/40 transition-all"
                      >
                        <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-all">
                          <Plus className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400 group-hover:text-blue-300 text-center">Add to Projects</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/5 disabled:opacity-20 transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500/50 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / pendingSuggestions.length) * 100}%` }}
                />
              </div>
              <button
                onClick={() => setCurrentIndex(prev => Math.min(pendingSuggestions.length - 1, prev + 1))}
                disabled={currentIndex === pendingSuggestions.length - 1}
                className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/5 disabled:opacity-20 transition-all"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rationale Modal */}
      <AnimatePresence>
        {feedbackMode !== 'none' && feedbackMode !== 'yes' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setFeedbackMode('none'); setRationale('') }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md premium-card p-8 shadow-2xl"
              style={{ background: 'var(--premium-surface-1)' }}
            >
              <h3 className="text-xl font-bold premium-text-platinum mb-2">
                {feedbackMode === 'no' ? 'Dismiss Suggestion' : 'Maybe Later'}
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                Briefly, why isn't this right for you today? This helps refine future suggestions.
              </p>

              {/* Rationale Chips */}
              <div className="flex flex-wrap gap-2 mb-6">
                {RATIONALE_OPTIONS[feedbackMode as 'no' | 'later'].map(option => (
                  <button
                    key={option}
                    onClick={() => setRationale(option)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      rationale === option 
                        ? "bg-blue-600/20 border-blue-500 text-blue-400" 
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <Textarea
                autoFocus
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Or type a custom reason..."
                className="w-full h-32 mb-6"
              />

              <div className="flex gap-3">
                <Button
                  onClick={() => { setFeedbackMode('none'); setRationale('') }}
                  variant="ghost"
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitFeedback}
                  disabled={isSubmitting || !rationale.trim()}
                  className={cn(
                    "flex-1 rounded-xl font-bold transition-all",
                    feedbackMode === 'no' 
                      ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-900/50' 
                      : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-900/50'
                  )}
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                  ) : 'Confirm'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Build Dialog */}
      <BuildProjectDialog
        suggestion={currentSuggestion}
        open={buildDialogOpen}
        onOpenChange={setBuildDialogOpen}
        onConfirm={handleBuildConfirm}
      />
    </div>
  )
}