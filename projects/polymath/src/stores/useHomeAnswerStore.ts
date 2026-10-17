/**
 * Which project TodaysAnswerCard should show as "today's answer" right
 * now, when that's been decided by creating something new rather than by
 * the real is_priority flag.
 *
 * Priority changes (set_priority, add_up_next) don't need this — those
 * mutate an existing project's real state, and TodaysAnswerCard's own
 * usePriorityProject() selector already picks that up live. This exists
 * only for the two paths that CREATE a project without making it the
 * priority: tapping a corpus-signal chip, and confirming a new-project
 * proposal from inside the Focus chat thread. The chat's confirm card
 * lives three components below TodaysAnswerCard (Card → SteerPanel →
 * FocusChat → FocusChatNewProjectCard), too deep to reach a local
 * setState by prop — a shared store is the door back up.
 *
 * `showOnHome` is the same door for "put this one on the card": the arrow on a
 * project card points the home card at it. It deliberately does NOT touch
 * is_priority: the star is a durable commitment, and looking at something
 * else for a bit shouldn't quietly overwrite it.
 */

import { create } from 'zustand'

interface HomeAnswerState {
  overrideProjectId: string | null
  setOverride: (id: string) => void
  clearOverride: () => void
  /** Point the home card at this project. */
  showOnHome: (id: string) => void
}

export const useHomeAnswerStore = create<HomeAnswerState>((set) => ({
  overrideProjectId: null,
  setOverride: (id) => set({ overrideProjectId: id }),
  clearOverride: () => set({ overrideProjectId: null }),
  showOnHome: (id) => set({ overrideProjectId: id }),
}))
