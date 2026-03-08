/**
 * Streak Store — Loss aversion + momentum
 *
 * Principle: After ~7 days, the fear of LOSING a streak is stronger than
 * the motivation to GAIN one. Duolingo data: 7-day users are 3.6x more
 * retained. We exploit this via Kahneman's prospect theory — losses loom
 * ~2x larger than equivalent gains.
 *
 * Design:
 *   - recordCompletion() called whenever a todo is marked done
 *   - streak is the number of consecutive days with ≥1 completion
 *   - bestStreak tracks all-time high (shown on reset to re-motivate)
 *   - One grace day per month protects streak from single misses
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DayRecord {
  date: string  // YYYY-MM-DD
  count: number
}

interface StreakStore {
  history: DayRecord[]
  streak: number
  bestStreak: number
  graceDaysUsed: Record<string, boolean>  // month (YYYY-MM) → used

  recordCompletion: () => void
  useGraceDay: () => void
  getStreakMessage: () => string | null
}

function todayYMD() {
  return new Date().toISOString().split('T')[0]
}

function computeStreak(history: DayRecord[], graceDaysUsed: Record<string, boolean>): number {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))
  const today = todayYMD()
  const month = today.slice(0, 7)
  const hasGrace = !graceDaysUsed[month]

  let streak = 0
  let expectedDate = today
  let graceAvailable = hasGrace

  for (const record of sorted) {
    if (record.date === expectedDate) {
      if (record.count > 0) {
        streak++
      } else if (graceAvailable) {
        // Grace day absorbs a 0-count day
        graceAvailable = false
        streak++
      } else {
        break
      }
    } else if (record.date < expectedDate) {
      // Gap in history
      if (graceAvailable && streak > 0) {
        graceAvailable = false
        streak++
        // Continue from this record's date
        const d = new Date(record.date + 'T00:00:00')
        d.setDate(d.getDate() - 1)
        expectedDate = d.toISOString().split('T')[0]
        if (record.count > 0) continue
        else break
      } else {
        break
      }
    }
    const d = new Date(expectedDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    expectedDate = d.toISOString().split('T')[0]
  }

  return streak
}

export const useStreakStore = create<StreakStore>()(
  persist(
    (set, get) => ({
      history: [],
      streak: 0,
      bestStreak: 0,
      graceDaysUsed: {},

      recordCompletion: () => {
        const today = todayYMD()
        const { history, graceDaysUsed } = get()

        const existing = history.find(r => r.date === today)
        const newHistory: DayRecord[] = existing
          ? history.map(r => r.date === today ? { ...r, count: r.count + 1 } : r)
          : [...history, { date: today, count: 1 }]

        const newStreak = computeStreak(newHistory, graceDaysUsed)
        const newBest = Math.max(get().bestStreak, newStreak)

        set({ history: newHistory, streak: newStreak, bestStreak: newBest })
      },

      useGraceDay: () => {
        const today = todayYMD()
        const month = today.slice(0, 7)
        const { graceDaysUsed, history } = get()
        if (graceDaysUsed[month]) return

        const newGrace = { ...graceDaysUsed, [month]: true }
        const newStreak = computeStreak(history, newGrace)

        set({ graceDaysUsed: newGrace, streak: newStreak })
      },

      getStreakMessage: () => {
        const { streak } = get()
        if (streak === 0) return null
        if (streak === 1) return 'Day 1. Keep going.'
        if (streak < 7) return `${streak} days. Building momentum.`
        if (streak === 7) return `7 days. You\'re locked in.`
        if (streak < 14) return `${streak} days. Don\'t break it now.`
        if (streak < 30) return `${streak} days straight. Rare.`
        return `${streak} days. Exceptional.`
      },
    }),
    {
      name: 'polymath-streak-v2',
    }
  )
)
