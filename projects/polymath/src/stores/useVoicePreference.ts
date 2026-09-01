/**
 * Voice vs. text, remembered once instead of re-fought every phase.
 *
 * Every voice-first surface (project creation, session planning, the
 * debrief) defaults to listening automatically -- but "switch to text"
 * used to be a per-component toggle, reset the moment you moved to the
 * next phase or opened the app again tomorrow. For someone who genuinely
 * doesn't want to talk out loud (a train, a shared room, a sleeping
 * house), that's the same tax paid over and over. One switch, remembered
 * in this browser, and every surface reads it.
 *
 * localStorage rather than sessionStorage on purpose: "I prefer typing"
 * is a fact about the person, not about right now.
 */

import { create } from 'zustand'

const KEY = 'aperture-prefers-text'

function loadPrefersText(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface VoicePreferenceState {
  prefersText: boolean
  setPrefersText: (prefersText: boolean) => void
}

export const useVoicePreference = create<VoicePreferenceState>((set) => ({
  prefersText: loadPrefersText(),
  setPrefersText: (prefersText) => {
    try {
      if (prefersText) localStorage.setItem(KEY, '1')
      else localStorage.removeItem(KEY)
    } catch {
      // Storage unavailable -- the toggle still works for this render.
    }
    set({ prefersText })
  },
}))
