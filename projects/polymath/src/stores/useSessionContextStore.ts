/**
 * Session Context Store
 *
 * Per-session "how are you feeling right now" state. CLAUDE.md §Inputs #1
 * calls for one tap before home renders so The Moment can calibrate to
 * context (focused / scattered / restless). This store carries that
 * state without intercepting the home render — anything that needs it
 * (project-ideas re-roll, Keep Going filtering) can read it directly.
 *
 * Persisted to sessionStorage on purpose: a feeling expires when the
 * user closes the tab. A focused state from yesterday morning shouldn't
 * shape today's home.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type SessionFeeling = 'focused' | 'scattered' | 'restless'

interface SessionContextState {
  feeling: SessionFeeling | null
  setFeeling: (next: SessionFeeling | null) => void
  clear: () => void
  // True once the user has been shown the at-open prompt this session,
  // even if they dismissed it without choosing. Prevents the modal
  // from popping back on every navigation.
  promptSeen: boolean
  markPromptSeen: () => void
}

export const useSessionContextStore = create<SessionContextState>()(
  persist(
    (set) => ({
      feeling: null,
      setFeeling: (next) => set({ feeling: next, promptSeen: true }),
      clear: () => set({ feeling: null }),
      promptSeen: false,
      markPromptSeen: () => set({ promptSeen: true }),
    }),
    {
      name: 'polymath:session-context',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
