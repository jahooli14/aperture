/**
 * TomorrowHook — Session-end teaser
 *
 * Shows after the user has been on the homepage for a while (or completed
 * their daily challenge), giving them a reason to come back tomorrow.
 *
 * The psychology: create anticipation for what's next rather than just
 * hoping they remember to open the app. Each teaser references what
 * tomorrow's challenge unlocks, building curiosity.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sunrise, X } from 'lucide-react'
import { useJourneyStore } from '../../stores/useJourneyStore'

export function TomorrowHook() {
  const {
    getTomorrowTeaser,
    shouldShowTomorrowHook,
    dismissTomorrowHook,
    onboardingCompletedAt,
    graduated,
    completedChallenges,
  } = useJourneyStore()

  const [visible, setVisible] = useState(false)

  const teaser = getTomorrowTeaser()
  const shouldShow = shouldShowTomorrowHook()

  // Show after 45 seconds on the page (user has spent time engaging)
  useEffect(() => {
    if (!shouldShow || !teaser) return

    const timer = setTimeout(() => {
      setVisible(true)
    }, 45000)

    return () => clearTimeout(timer)
  }, [shouldShow, teaser])

  // Also show immediately if the user just completed a challenge
  useEffect(() => {
    if (!shouldShow || !teaser) return

    const handler = () => {
      // Small delay after milestone celebration
      setTimeout(() => setVisible(true), 5000)
    }

    window.addEventListener('journey-milestone', handler)
    return () => window.removeEventListener('journey-milestone', handler)
  }, [shouldShow, teaser])

  if (!onboardingCompletedAt || graduated || !teaser) return null

  const handleDismiss = () => {
    setVisible(false)
    dismissTomorrowHook()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
        >
          <div
            className="relative p-5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.06), rgba(var(--brand-primary-rgb),0.04))',
              border: '1px solid rgba(245,158,11,0.15)',
            }}
          >
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-3.5 pr-6">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                <Sunrise className="h-5 w-5" style={{ color: 'rgb(245,158,11)' }} />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                >
                  {teaser}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                >
                  Day {completedChallenges.length} of 7 complete
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
