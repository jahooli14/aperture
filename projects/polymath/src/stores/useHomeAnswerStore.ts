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
 * `startRequestId` is the same door used for the other direction: "work on
 * this one, now". A ▶ on a mini card, or the chat answering with
 * start_session, points the answer box at that project AND opens the
 * session contract on it — rather than each surface owning its own copy of
 * a session flow, which is how the home ended up with three of them. It
 * deliberately does NOT touch is_priority: the star is a durable
 * commitment, and one session on something else shouldn't quietly
 * overwrite it.
 */

import { create } from 'zustand'

interface HomeAnswerState {
  overrideProjectId: string | null
  /** Set when something asked for a session to open on this project. */
  startRequestId: string | null
  setOverride: (id: string) => void
  clearOverride: () => void
  requestStart: (id: string) => void
  clearStartRequest: () => void
}

export const useHomeAnswerStore = create<HomeAnswerState>((set) => ({
  overrideProjectId: null,
  startRequestId: null,
  setOverride: (id) => set({ overrideProjectId: id }),
  clearOverride: () => set({ overrideProjectId: null, startRequestId: null }),
  // Points the answer box at the project and asks it to start, in one set
  // so the card can never open a contract for a project it isn't showing.
  requestStart: (id) => set({ overrideProjectId: id, startRequestId: id }),
  clearStartRequest: () => set({ startRequestId: null }),
}))
