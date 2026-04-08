/**
 * PolymathProfileCard — Shows what Polymath knows + nudges more data
 *
 * Two modes:
 *   1. During journey (Day 1-7): Integrated into JourneyMilestones
 *   2. Post-graduation: Standalone card showing profile + feed-the-loop nudge
 *
 * This is the visible proof that "data in → value out" works.
 * Without it, users never see the system learning.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Mic, Plus, X, Zap } from 'lucide-react'
import { useJourneyStore } from '../../stores/useJourneyStore'

export function PolymathProfileCard() {
  const {
    onboardingProfile,
    graduated,
    dataPointCount,
    shouldShowFeedNudge,
    dismissFeedNudge,
    incrementDataPoints,
  } = useJourneyStore()

  const [dismissed, setDismissed] = useState(false)

  // Only show post-graduation, and only if we have a profile
  if (!graduated || !onboardingProfile || dismissed) return null

  const { themes, capabilities } = onboardingProfile
  const showNudge = shouldShowFeedNudge()

  const handleVoiceCapture = () => {
    window.dispatchEvent(new CustomEvent('openVoiceCapture'))
    incrementDataPoints()
    dismissFeedNudge()
  }

  const handleDismiss = () => {
    setDismissed(true)
    if (showNudge) dismissFeedNudge()
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.05), rgba(var(--brand-primary-rgb),0.04))',
          border: '1px solid rgba(var(--brand-primary-rgb),0.1)',
        }}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.08)] z-10"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="px-5 py-4">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(var(--brand-primary-rgb),0.1)' }}
            >
              <Brain className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-primary)', opacity: 0.6 }}>
                What Polymath knows
              </p>
            </div>
            {dataPointCount > 0 && (
              <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: 'rgb(34,197,94)' }}>
                +{dataPointCount} since onboarding
              </span>
            )}
          </div>

          {/* Themes */}
          {themes.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                You care about
              </p>
              <div className="flex flex-wrap gap-1.5">
                {themes.map((theme, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(var(--brand-primary-rgb),0.08)',
                      color: 'var(--brand-primary)',
                      border: '1px solid rgba(var(--brand-primary-rgb),0.12)',
                    }}
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                You bring
              </p>
              <div className="flex flex-wrap gap-1.5">
                {capabilities.map((cap, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      color: 'rgb(245,158,11)',
                      border: '1px solid rgba(245,158,11,0.12)',
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feed-the-loop nudge */}
        <AnimatePresence>
          {showNudge && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-4"
            >
              <div
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-[rgba(var(--brand-primary-rgb),0.08)]"
                onClick={handleVoiceCapture}
                style={{
                  background: 'rgba(var(--brand-primary-rgb),0.04)',
                  border: '1px dashed rgba(var(--brand-primary-rgb),0.15)',
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(var(--brand-primary-rgb),0.1)' }}>
                  <Mic className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--brand-text-primary)' }}>
                    Tell me more
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
                    The more you share, the sharper your suggestions get.
                  </p>
                </div>
                <Zap className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand-primary)', opacity: 0.4 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
