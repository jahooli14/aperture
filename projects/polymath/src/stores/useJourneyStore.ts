/**
 * Journey Store — Post-onboarding engagement flywheel
 *
 * The north star loop:
 *   Data in → Polymath knows you → suggests projects → chat builds it out
 *   → encourages more data → better suggestions → repeat
 *
 * This store tracks:
 *   - Onboarding analysis (themes, capabilities, first_insight) — persisted
 *   - Day 1→7 challenges that teach the flywheel, not just features
 *   - Graduation → ongoing "feed the loop" nudges
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OnboardingProfile {
  themes: string[]
  capabilities: string[]
  firstInsight: string
}

export interface DayChallenge {
  day: number
  title: string
  description: string
  action: 'voice_note' | 'read_article' | 'check_connections' | 'start_project' | 'complete_task' | 'explore_insights' | 'power_hour'
  reward: string
  celebrationText: string
}

/**
 * Challenges redesigned around the flywheel:
 * Day 1: Add data (voice) → system learns
 * Day 2: Add data (article) → system connects it to your project
 * Day 3: See the connections → proof the loop works
 * Day 4: Complete a task → project moves forward
 * Day 5: Add more data (voice) → see how suggestions improve
 * Day 6: Explore what Polymath learned → visible learning
 * Day 7: Power Hour → full loop in action
 */
export const JOURNEY_CHALLENGES: DayChallenge[] = [
  {
    day: 1,
    title: 'Tell Polymath more',
    description: 'Record a voice note — the more you share, the better your suggestions get.',
    action: 'voice_note',
    reward: 'Polymath is learning what you care about',
    celebrationText: 'That thought is now part of your knowledge graph.',
  },
  {
    day: 2,
    title: 'Feed it something you read',
    description: 'Save an article — Polymath will connect it to your project and thoughts.',
    action: 'read_article',
    reward: 'New connections forming with your project',
    celebrationText: 'Polymath just linked that to what you\'ve been thinking about.',
  },
  {
    day: 3,
    title: 'See the connections',
    description: 'Your thoughts and reading are linking together. Check the Insights page.',
    action: 'check_connections',
    reward: 'You can see how Polymath thinks about you',
    celebrationText: 'This is what happens when ideas talk to each other.',
  },
  {
    day: 4,
    title: 'Ship something small',
    description: 'Complete one task on your project. Small wins compound.',
    action: 'complete_task',
    reward: 'Momentum started — streaks unlock tomorrow',
    celebrationText: 'First task shipped. The project is moving.',
  },
  {
    day: 5,
    title: 'Teach Polymath something new',
    description: 'Record another thought — watch how your suggestions sharpen.',
    action: 'voice_note',
    reward: 'Your suggestions just got more specific',
    celebrationText: 'More data, sharper ideas. The flywheel is spinning.',
  },
  {
    day: 6,
    title: 'See what Polymath learned',
    description: 'Visit Insights — your patterns, themes, and the connections you can\'t see.',
    action: 'explore_insights',
    reward: 'You can see your own thinking patterns',
    celebrationText: 'Polymath mapped your mind. Keep feeding it.',
  },
  {
    day: 7,
    title: 'Run a Power Hour',
    description: 'Polymath plans your session from everything it knows. You just do the work.',
    action: 'power_hour',
    reward: 'The full loop is yours',
    celebrationText: 'Data in, projects out. You own the loop now.',
  },
]

interface JourneyStore {
  // Core state
  onboardingCompletedAt: string | null
  onboardingProfile: OnboardingProfile | null
  completedChallenges: number[]
  firstProjectId: string | null
  firstConnectionSeen: boolean
  graduated: boolean
  dismissedTomorrowHook: string | null
  dismissedFeedNudge: string | null // ISO date of last "feed the loop" dismissal
  sessionStartedAt: string | null
  dataPointCount: number // tracks how many things user has added post-onboarding

  // Computed helpers
  getCurrentDay: () => number
  getCurrentChallenge: () => DayChallenge | null
  isChallengeComplete: (day: number) => boolean
  getCompletedCount: () => number
  isGraduated: () => boolean
  getTomorrowTeaser: () => string | null
  shouldShowTomorrowHook: () => boolean
  shouldShowFeedNudge: () => boolean

  // Actions
  startJourney: (profile?: OnboardingProfile) => void
  completeChallenge: (day: number) => void
  setFirstProjectId: (id: string) => void
  markFirstConnectionSeen: () => void
  graduate: () => void
  dismissTomorrowHook: () => void
  dismissFeedNudge: () => void
  startSession: () => void
  incrementDataPoints: () => void
  reset: () => void
}

const TOMORROW_TEASERS: Record<number, string> = {
  1: 'Tomorrow: save something you\'ve been reading. Polymath will connect it to your project.',
  2: 'Tomorrow: see the connections forming between your thoughts, your reading, and your project.',
  3: 'Tomorrow: ship a task on your project. Small wins make the suggestions sharper.',
  4: 'Tomorrow: teach Polymath something new. One more thought makes every suggestion better.',
  5: 'Tomorrow: see what Polymath learned about how you think.',
  6: 'Tomorrow: your first Power Hour. Everything Polymath knows, focused into one session.',
  7: 'The loop is yours. Keep adding, keep building.',
}

export const useJourneyStore = create<JourneyStore>()(
  persist(
    (set, get) => ({
      onboardingCompletedAt: null,
      onboardingProfile: null,
      completedChallenges: [],
      firstProjectId: null,
      firstConnectionSeen: false,
      graduated: false,
      dismissedTomorrowHook: null,
      dismissedFeedNudge: null,
      sessionStartedAt: null,
      dataPointCount: 0,

      getCurrentDay: () => {
        const { onboardingCompletedAt, graduated } = get()
        if (!onboardingCompletedAt || graduated) return 0

        const start = new Date(onboardingCompletedAt)
        const now = new Date()
        const diffMs = now.getTime() - start.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        return Math.min(Math.max(diffDays + 1, 1), 7)
      },

      getCurrentChallenge: () => {
        const { getCurrentDay, completedChallenges, graduated } = get()
        if (graduated) return null
        const day = getCurrentDay()
        if (day === 0) return null

        for (let d = 1; d <= day; d++) {
          if (!completedChallenges.includes(d)) {
            return JOURNEY_CHALLENGES[d - 1]
          }
        }

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

        if (dismissedTomorrowHook) {
          const dismissed = new Date(dismissedTomorrowHook).toDateString()
          const today = new Date().toDateString()
          if (dismissed === today) return false
        }

        return true
      },

      shouldShowFeedNudge: () => {
        const { graduated, dismissedFeedNudge, onboardingCompletedAt } = get()
        if (!graduated || !onboardingCompletedAt) return false

        // Show every 3 days after graduation
        if (dismissedFeedNudge) {
          const dismissed = new Date(dismissedFeedNudge)
          const now = new Date()
          const daysSince = Math.floor((now.getTime() - dismissed.getTime()) / (1000 * 60 * 60 * 24))
          if (daysSince < 3) return false
        }

        return true
      },

      startJourney: (profile?: OnboardingProfile) => {
        set({
          onboardingCompletedAt: new Date().toISOString(),
          completedChallenges: [],
          graduated: false,
          onboardingProfile: profile || null,
        })
      },

      completeChallenge: (day: number) => {
        const { completedChallenges } = get()
        if (completedChallenges.includes(day)) return

        const updated = [...completedChallenges, day].sort((a, b) => a - b)
        set({ completedChallenges: updated })

        const challenge = JOURNEY_CHALLENGES[day - 1]
        if (challenge) {
          window.dispatchEvent(new CustomEvent('journey-milestone', {
            detail: { day, challenge },
          }))
        }

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

      dismissFeedNudge: () => {
        set({ dismissedFeedNudge: new Date().toISOString() })
      },

      startSession: () => {
        set({ sessionStartedAt: new Date().toISOString() })
      },

      incrementDataPoints: () => {
        set({ dataPointCount: get().dataPointCount + 1 })
      },

      reset: () => {
        set({
          onboardingCompletedAt: null,
          onboardingProfile: null,
          completedChallenges: [],
          firstProjectId: null,
          firstConnectionSeen: false,
          graduated: false,
          dismissedTomorrowHook: null,
          dismissedFeedNudge: null,
          sessionStartedAt: null,
          dataPointCount: 0,
        })
      },
    }),
    {
      name: 'polymath-journey-v1',
    }
  )
)
