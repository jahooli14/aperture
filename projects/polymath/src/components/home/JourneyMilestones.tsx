/**
 * JourneyMilestones — Day 1→7 progressive challenge card on the homepage
 *
 * Replaces the "full power user dashboard" for new users.
 * Shows the current day's challenge, progress dots, and completion state.
 * Fires navigation/actions when the user taps the challenge.
 *
 * After Day 7 (or graduation), this component returns null and the
 * full homepage takes over.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, Mic, FileText, Link2, Layers, ListChecks, TrendingUp, Zap, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useJourneyStore, JOURNEY_CHALLENGES } from '../../stores/useJourneyStore'
import type { DayChallenge } from '../../stores/useJourneyStore'

const ACTION_ICONS: Record<DayChallenge['action'], typeof Mic> = {
  voice_note: Mic,
  read_article: FileText,
  check_connections: Link2,
  start_project: Layers,
  complete_task: ListChecks,
  explore_insights: TrendingUp,
  power_hour: Zap,
}

const ACTION_ROUTES: Record<DayChallenge['action'], string> = {
  voice_note: '', // dispatches event
  read_article: '/reading',
  check_connections: '/insights',
  start_project: '/projects',
  complete_task: '/todos',
  explore_insights: '/insights',
  power_hour: '', // opens power hour on homepage
}

export function JourneyMilestones() {
  const navigate = useNavigate()
  const {
    getCurrentDay,
    getCurrentChallenge,
    completedChallenges,
    graduated,
    onboardingCompletedAt,
  } = useJourneyStore()

  const [celebration, setCelebration] = useState<DayChallenge | null>(null)

  const currentDay = getCurrentDay()
  const currentChallenge = getCurrentChallenge()

  // Listen for milestone celebrations
  useEffect(() => {
    const handler = (e: CustomEvent<{ day: number; challenge: DayChallenge }>) => {
      setCelebration(e.detail.challenge)
      // Auto-dismiss after 4 seconds
      setTimeout(() => setCelebration(null), 4000)
    }

    window.addEventListener('journey-milestone', handler as EventListener)
    return () => window.removeEventListener('journey-milestone', handler as EventListener)
  }, [])

  // Don't render if not in journey or graduated
  if (!onboardingCompletedAt || graduated) return null

  const handleChallengeAction = (challenge: DayChallenge) => {
    if (challenge.action === 'voice_note') {
      window.dispatchEvent(new CustomEvent('openVoiceCapture'))
      return
    }
    if (challenge.action === 'power_hour') {
      // Scroll to power hour section on homepage
      const el = document.querySelector('[data-power-hour]')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const route = ACTION_ROUTES[challenge.action]
    if (route) navigate(route)
  }

  const Icon = currentChallenge ? ACTION_ICONS[currentChallenge.action] : Zap

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
      {/* Celebration overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mb-4 p-5 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(99,179,237,0.12))',
              border: '1px solid rgba(34,197,94,0.25)',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(34,197,94,0.15)' }}
            >
              <Trophy className="h-6 w-6" style={{ color: 'rgb(34,197,94)' }} />
            </motion.div>
            <p className="text-base font-semibold mb-1" style={{ color: 'var(--brand-text-primary)' }}>
              {celebration.celebrationText}
            </p>
            <p className="text-xs" style={{ color: 'var(--brand-primary)', opacity: 0.8 }}>
              {celebration.reward}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main journey card */}
      {currentChallenge && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,179,237,0.08), rgba(168,85,247,0.06))',
            border: '1px solid rgba(99,179,237,0.15)',
          }}
        >
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 px-5 pt-4 pb-2">
            {JOURNEY_CHALLENGES.map((_, i) => {
              const day = i + 1
              const isComplete = completedChallenges.includes(day)
              const isCurrent = currentChallenge.day === day
              return (
                <motion.div
                  key={day}
                  className="flex items-center justify-center rounded-full"
                  animate={{
                    width: isCurrent ? 22 : 8,
                    height: 8,
                    backgroundColor: isComplete
                      ? 'rgb(34,197,94)'
                      : isCurrent
                        ? 'var(--brand-primary)'
                        : 'rgba(255,255,255,0.1)',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {isComplete && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </motion.div>
              )
            })}
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
              Day {currentDay} of 7
            </span>
          </div>

          {/* Challenge content */}
          <button
            onClick={() => handleChallengeAction(currentChallenge)}
            className="w-full px-5 pb-5 pt-2 flex items-center gap-4 text-left group transition-all"
          >
            <div
              className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{
                background: 'rgba(99,179,237,0.12)',
                border: '1px solid rgba(99,179,237,0.2)',
              }}
            >
              <Icon className="h-6 w-6" style={{ color: 'var(--brand-primary)' }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold mb-0.5" style={{ color: 'var(--brand-text-primary)' }}>
                {currentChallenge.title}
              </p>
              <p className="text-sm line-clamp-1" style={{ color: 'var(--brand-text-secondary)', opacity: 0.7 }}>
                {currentChallenge.description}
              </p>
            </div>

            <ChevronRight
              className="h-5 w-5 flex-shrink-0 transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--brand-primary)', opacity: 0.5 }}
            />
          </button>
        </motion.div>
      )}

      {/* All done for today — show encouragement */}
      {!currentChallenge && !graduated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-5 rounded-2xl text-center"
          style={{
            background: 'var(--brand-glass-bg)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--brand-text-secondary)' }}>
            Today's challenge complete. Come back tomorrow for the next one.
          </p>
          <div className="flex justify-center gap-1.5 mt-3">
            {JOURNEY_CHALLENGES.map((_, i) => {
              const isComplete = completedChallenges.includes(i + 1)
              return (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isComplete ? 'rgb(34,197,94)' : 'rgba(255,255,255,0.1)',
                  }}
                />
              )
            })}
          </div>
        </motion.div>
      )}
    </section>
  )
}
