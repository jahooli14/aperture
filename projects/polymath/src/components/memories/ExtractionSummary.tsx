import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Users, Hash, Heart, Link2, X } from 'lucide-react'
import { useJourneyStore } from '../../stores/useJourneyStore'

interface ExtractionDetail {
  memoryId: string
  topics: number
  people: number
  themes: number
  tone: string | null
  connections: number
  bridgeInsight: string | null
}

export function ExtractionSummary() {
  const [extraction, setExtraction] = useState<ExtractionDetail | null>(null)
  const [visible, setVisible] = useState(false)
  const { incrementDataPoints, onboardingCompletedAt } = useJourneyStore()

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
                  {extraction.connections > 0 ? 'Connected' : 'Understood'}
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
                {extraction.connections > 0 && (
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    {extraction.connections} link{extraction.connections > 1 ? 's' : ''}
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

            {/* Row 1.5: flywheel feedback — shown when connections found */}
            {extraction.connections > 0 && !extraction.bridgeInsight && onboardingCompletedAt && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)] my-2.5" />
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
                  {extraction.connections} new {extraction.connections === 1 ? 'connection' : 'connections'} to your existing thoughts. Your suggestions are getting sharper.
                </p>
              </>
            )}

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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
