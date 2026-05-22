import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Users, Hash, Heart, X, Lightbulb, BookOpen, ListPlus, Wrench, ArrowRight, Sparkles } from 'lucide-react'
import { useJourneyStore } from '../../stores/useJourneyStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { CreateProjectDialog } from '../projects/CreateProjectDialog'

interface ExtractionDetail {
  memoryId: string
  topics: number
  people: number
  themes: number
  tone: string | null
  connections: number
  bridgeInsight: string | null
  triageCategory: string | null
  suggestedProjectId: string | null
}

export function ExtractionSummary() {
  const navigate = useNavigate()
  const [extraction, setExtraction] = useState<ExtractionDetail | null>(null)
  const [visible, setVisible] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { incrementDataPoints, onboardingCompletedAt } = useJourneyStore()
  const allProjects = useProjectStore(s => s.allProjects)

  useEffect(() => {
    const handleExtraction = (e: CustomEvent<ExtractionDetail>) => {
      setExtraction(e.detail)
      setVisible(true)

      // Track data point for the flywheel
      if (onboardingCompletedAt) {
        incrementDataPoints()
      }
    }

    window.addEventListener('memory-extracted', handleExtraction as EventListener)
    return () => {
      window.removeEventListener('memory-extracted', handleExtraction as EventListener)
    }
  }, [onboardingCompletedAt])

  return (
    <>
    <CreateProjectDialog isOpen={createOpen} onOpenChange={setCreateOpen} hideTrigger />
    <AnimatePresence>
      {visible && extraction && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-24 left-4 right-4 z-50 md:left-1/2 md:-translate-x-1/2 md:w-auto md:max-w-sm"
        >
          <div className="px-4 py-3 rounded-2xl bg-[#1a1f35]/95 backdrop-blur-xl border border-[var(--glass-surface-hover)] shadow-2xl">
            {/* Row 1: extraction stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-xs text-brand-primary font-medium">
                  Understood
                </span>
              </div>
              <div className="h-3 w-px bg-[rgba(255,255,255,0.1)]" />
              <div className="flex items-center gap-2.5 text-xs text-[var(--brand-text-secondary)]">
                {extraction.topics > 0 && (
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {extraction.topics} topic{extraction.topics > 1 ? 's' : ''}
                  </span>
                )}
                {extraction.people > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-brand-primary" />
                    {extraction.people} {extraction.people > 1 ? 'people' : 'person'}
                  </span>
                )}
                {extraction.tone && (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {extraction.tone}
                  </span>
                )}
              </div>
              {/* Dismiss button */}
              <button
                onClick={() => setVisible(false)}
                className="ml-auto flex-shrink-0 p-1 rounded-md transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                style={{ color: 'var(--brand-text-muted)' }}
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Row 2: thought bridge — shown only when present */}
            {extraction.bridgeInsight && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-start gap-2">
                  <div
                    className="flex-shrink-0 h-1.5 w-1.5 rounded-full mt-1.5"
                    style={{ backgroundColor: 'var(--brand-primary)', opacity: 0.7 }}
                  />
                  <p
                    className="text-xs leading-relaxed flex-1"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    {extraction.bridgeInsight}
                  </p>
                </div>
              </>
            )}

            {/* Row 3: intent routing — show what the harness did with the thought */}
            {extraction.triageCategory === 'new_project_idea' && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-center gap-2 flex-wrap">
                  <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Sounds like a project —</span>
                  {extraction.suggestedProjectId && allProjects.find(p => p.id === extraction.suggestedProjectId) && (
                    <button
                      onClick={() => { setVisible(false); navigate(`/projects/${extraction.suggestedProjectId}`) }}
                      className="text-xs font-bold underline"
                      style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                    >
                      add to {allProjects.find(p => p.id === extraction.suggestedProjectId)?.title}
                    </button>
                  )}
                  <button
                    onClick={() => { setVisible(false); setCreateOpen(true) }}
                    className="text-xs font-bold underline"
                    style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                  >
                    start something new
                  </button>
                </div>
              </>
            )}

            {extraction.triageCategory === 'task_update' && extraction.suggestedProjectId && allProjects.find(p => p.id === extraction.suggestedProjectId) && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-center gap-2 flex-wrap">
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Added to</span>
                  <button
                    onClick={() => { setVisible(false); navigate(`/projects/${extraction.suggestedProjectId}`) }}
                    className="text-xs font-bold underline"
                    style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                  >
                    {allProjects.find(p => p.id === extraction.suggestedProjectId)?.title}
                  </button>
                </div>
              </>
            )}

            {extraction.triageCategory === 'list_item' && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-center gap-2 flex-wrap">
                  <ListPlus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Added to a list.</span>
                  <button
                    onClick={() => { setVisible(false); navigate('/lists') }}
                    className="text-xs font-bold underline"
                    style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                  >
                    see lists
                  </button>
                </div>
              </>
            )}

            {extraction.triageCategory === 'reading_lead' && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-center gap-2 flex-wrap">
                  <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Added to your reading queue.</span>
                  <button
                    onClick={() => { setVisible(false); navigate('/reading') }}
                    className="text-xs font-bold underline"
                    style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                  >
                    open
                  </button>
                </div>
              </>
            )}

            {extraction.triageCategory === 'annoyance' && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-center gap-2 flex-wrap">
                  <Wrench className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Logged a frustration.</span>
                </div>
              </>
            )}

            {extraction.triageCategory === 'taste_signal' && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <div className="w-full text-left flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>Kept as a taste signal.</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
