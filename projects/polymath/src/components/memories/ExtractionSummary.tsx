import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Users, Hash, Heart, Link2, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { incrementDataPoints, onboardingCompletedAt } = useJourneyStore()

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout>

    const handleExtraction = (e: CustomEvent<ExtractionDetail>) => {
      setExtraction(e.detail)
      setVisible(true)

      // Track data point for the flywheel
      if (onboardingCompletedAt) {
        incrementDataPoints()
      }

      // Show longer when there's a bridge insight worth reading
      const duration = e.detail.bridgeInsight ? 7000 : 4000
      clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => setVisible(false), duration)
    }

    window.addEventListener('memory-extracted', handleExtraction as EventListener)
    return () => {
      window.removeEventListener('memory-extracted', handleExtraction as EventListener)
      clearTimeout(dismissTimer)
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
          onClick={() => setVisible(false)}
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
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/insights') }}
                  className="w-full text-left flex items-start gap-2 group"
                >
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
                  <ArrowRight
                    className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{ color: 'var(--brand-primary)' }}
                  />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
