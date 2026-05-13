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
}

export const useSessionContextStore = create<SessionContextState>()(
  persist(
    (set) => ({
      feeling: null,
      setFeeling: (next) => set({ feeling: next }),
      clear: () => set({ feeling: null }),
    }),
    {
      name: 'polymath:session-context',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
