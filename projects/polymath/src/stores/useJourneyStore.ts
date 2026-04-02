/**
 * Journey Store — Post-onboarding Day 1→7 engagement bridge
 *
 * Tracks the user's first week after completing onboarding.
 * Progressive disclosure: unlock features as they complete daily challenges.
 * Each day has a specific action that builds on the previous one,
 * creating a habit loop before streaks can take over (~Day 7).
 *
 * Design:
 *   - journeyDay is calculated from onboardingCompletedAt
 *   - Each day has a challenge + reward (feature unlock or celebration)
 *   - Milestones fire events that other components can listen to
 *   - After Day 7, journey is "graduated" and the full homepage takes over
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DayChallenge {
  day: number
  title: string
  description: string
  action: 'voice_note' | 'read_article' | 'check_connections' | 'start_project' | 'complete_task' | 'explore_insights' | 'power_hour'
  reward: string
  celebrationText: string
}

export const JOURNEY_CHALLENGES: DayChallenge[] = [
  {
    day: 1,
    title: 'Capture your first thought',
    description: 'Record a voice note about whatever is on your mind right now.',
    action: 'voice_note',
    reward: 'Unlocked: Your thought feed',
    celebrationText: 'Your mind just got a second brain.',
  },
  {
    day: 2,
    title: 'Save something you read',
    description: 'Add an article or link — Polymath will connect it to your thoughts.',
    action: 'read_article',
    reward: 'Unlocked: Reading queue',
    celebrationText: 'Now Polymath reads with you.',
  },
  {
    day: 3,
    title: 'See your first connections',
    description: 'Check how your thoughts and reading are linking together.',
    action: 'check_connections',
    reward: 'Unlocked: Collision Reports',
    celebrationText: 'Your ideas are already talking to each other.',
  },
  {
    day: 4,
    title: 'Start a project',
    description: 'Pick one of your sparked ideas — or start fresh. Chat with Polymath to shape it.',
    action: 'start_project',
    reward: 'Unlocked: AI Council',
    celebrationText: 'From idea to project. That\'s the leap.',
  },
  {
    day: 5,
    title: 'Complete a task',
    description: 'Knock out one task on your project. Small wins compound.',
    action: 'complete_task',
    reward: 'Unlocked: Streaks',
    celebrationText: 'First task done. Momentum started.',
  },
  {
    day: 6,
    title: 'Explore your patterns',
    description: 'Visit Insights to see what Polymath has learned about how you think.',
    action: 'explore_insights',
    reward: 'Unlocked: Bedtime Ideas',
    celebrationText: 'Polymath is learning your mind.',
  },
  {
    day: 7,
    title: 'Run a Power Hour',
    description: 'A focused work session — Polymath plans the tasks, you do the work.',
    action: 'power_hour',
    reward: 'Full Polymath unlocked',
    celebrationText: 'You\'ve built the habit. Polymath is yours now.',
  },
]

interface JourneyStore {
  // Core state
  onboardingCompletedAt: string | null
  completedChallenges: number[] // day numbers
  firstProjectId: string | null
  firstConnectionSeen: boolean
  graduated: boolean
  dismissedTomorrowHook: string | null // ISO date string of last dismissal
  sessionStartedAt: string | null

  // Computed helpers
  getCurrentDay: () => number
  getCurrentChallenge: () => DayChallenge | null
  isChallengeComplete: (day: number) => boolean
  getCompletedCount: () => number
  isGraduated: () => boolean
  getTomorrowTeaser: () => string | null
  shouldShowTomorrowHook: () => boolean

  // Actions
  startJourney: () => void
  completeChallenge: (day: number) => void
  setFirstProjectId: (id: string) => void
  markFirstConnectionSeen: () => void
  graduate: () => void
  dismissTomorrowHook: () => void
  startSession: () => void
  reset: () => void
}

const TOMORROW_TEASERS: Record<number, string> = {
  1: 'Tomorrow: save something you\'ve been reading. Polymath will connect it to what you just said.',
  2: 'Tomorrow: see how your thoughts and reading are already linking together.',
  3: 'Tomorrow: turn one of those connections into a real project.',
  4: 'Tomorrow: complete your first task and start building momentum.',
  5: 'Tomorrow: discover what Polymath has learned about how you think.',
  6: 'Tomorrow: your first Power Hour — focused work, AI-planned.',
  7: 'You\'ve graduated. Polymath is yours now.',
}

export const useJourneyStore = create<JourneyStore>()(
  persist(
    (set, get) => ({
      onboardingCompletedAt: null,
      completedChallenges: [],
      firstProjectId: null,
      firstConnectionSeen: false,
      graduated: false,
      dismissedTomorrowHook: null,
      sessionStartedAt: null,

      getCurrentDay: () => {
        const { onboardingCompletedAt, graduated } = get()
        if (!onboardingCompletedAt || graduated) return 0

        const start = new Date(onboardingCompletedAt)
        const now = new Date()
        const diffMs = now.getTime() - start.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        // Day 1 is the day of onboarding, capped at 7
        return Math.min(Math.max(diffDays + 1, 1), 7)
      },

      getCurrentChallenge: () => {
        const { getCurrentDay, completedChallenges, graduated } = get()
        if (graduated) return null
        const day = getCurrentDay()
        if (day === 0) return null

        // Find the first incomplete challenge up to current day
        for (let d = 1; d <= day; d++) {
          if (!completedChallenges.includes(d)) {
            return JOURNEY_CHALLENGES[d - 1]
          }
        }

        // All challenges up to today complete — show today's if not done
        if (!completedChallenges.includes(day)) {
          return JOURNEY_CHALLENGES[day - 1]
        }

        return null
      },

      isChallengeComplete: (day: number) => {
        return get().completedChallenges.includes(day)
      },

      getCompletedCount: () => {
        return get().completedChallenges.length
      },

      isGraduated: () => {
        return get().graduated
      },

      getTomorrowTeaser: () => {
        const { completedChallenges, graduated } = get()
        if (graduated) return null
        const latestCompleted = Math.max(...completedChallenges, 0)
        return TOMORROW_TEASERS[latestCompleted] || null
      },

      shouldShowTomorrowHook: () => {
        const { dismissedTomorrowHook, graduated, completedChallenges } = get()
        if (graduated || completedChallenges.length === 0) return false

        // Don't show if dismissed today
        if (dismissedTomorrowHook) {
          const dismissed = new Date(dismissedTomorrowHook).toDateString()
          const today = new Date().toDateString()
          if (dismissed === today) return false
        }

        return true
      },

      startJourney: () => {
        set({
          onboardingCompletedAt: new Date().toISOString(),
          completedChallenges: [],
          graduated: false,
        })
      },

      completeChallenge: (day: number) => {
        const { completedChallenges } = get()
        if (completedChallenges.includes(day)) return

        const updated = [...completedChallenges, day].sort((a, b) => a - b)
        set({ completedChallenges: updated })

        // Fire event for celebration components
        const challenge = JOURNEY_CHALLENGES[day - 1]
        if (challenge) {
          window.dispatchEvent(new CustomEvent('journey-milestone', {
            detail: { day, challenge },
          }))
        }

        // Auto-graduate after all 7
        if (updated.length === 7) {
          set({ graduated: true })
          window.dispatchEvent(new CustomEvent('journey-graduated'))
        }
      },

      setFirstProjectId: (id: string) => {
        set({ firstProjectId: id })
      },

      markFirstConnectionSeen: () => {
        set({ firstConnectionSeen: true })
      },

      graduate: () => {
        set({ graduated: true })
      },

      dismissTomorrowHook: () => {
        set({ dismissedTomorrowHook: new Date().toISOString() })
      },

      startSession: () => {
        set({ sessionStartedAt: new Date().toISOString() })
      },

      reset: () => {
        set({
          onboardingCompletedAt: null,
          completedChallenges: [],
          firstProjectId: null,
          firstConnectionSeen: false,
          graduated: false,
          dismissedTomorrowHook: null,
          sessionStartedAt: null,
        })
      },
    }),
    {
      name: 'polymath-journey-v1',
    }
  )
)
