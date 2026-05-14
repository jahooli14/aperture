/**
 * Theme Store
 * Manages user theme preferences. Two colours are user-pickable:
 *   - accentColor: the app-wide primary (was always cyan)
 *   - bgAccentColor: the cool depth tone in the body atmosphere overlay
 * Plus intensity / font size / debug toggles.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeIntensity = 'subtle' | 'normal' | 'vibrant'
export type FontSize = 'small' | 'normal' | 'large'

export const DEFAULT_ACCENT_COLOR = '#38bdf8'
export const DEFAULT_BG_ACCENT_COLOR = '#6366f1'

interface ThemeState {
  accentColor: string      // hex, e.g. '#38bdf8'
  bgAccentColor: string    // hex, e.g. '#6366f1'
  intensity: ThemeIntensity
  fontSize: FontSize
  showBugTracker: boolean

  setAccentColor: (color: string) => void
  setBgAccentColor: (color: string) => void
  resetThemeColors: () => void
  setIntensity: (intensity: ThemeIntensity) => void
  setFontSize: (size: FontSize) => void
  setShowBugTracker: (show: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColor: DEFAULT_ACCENT_COLOR,
      bgAccentColor: DEFAULT_BG_ACCENT_COLOR,
      intensity: 'normal',
      fontSize: 'normal',
      showBugTracker: false,

      setAccentColor: (color) => set({ accentColor: color }),
      setBgAccentColor: (color) => set({ bgAccentColor: color }),
      resetThemeColors: () => set({
        accentColor: DEFAULT_ACCENT_COLOR,
        bgAccentColor: DEFAULT_BG_ACCENT_COLOR,
      }),
      setIntensity: (intensity) => set({ intensity }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowBugTracker: (show) => set({ showBugTracker: show }),
    }),
    {
      name: 'rosette-theme',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        // v1 stored accentColor as a string enum ('cyan'). v2 stores hex.
        const state = (persisted ?? {}) as Partial<ThemeState> & { accentColor?: unknown }
        if (version < 2) {
          if (typeof state.accentColor !== 'string' || !state.accentColor.startsWith('#')) {
            state.accentColor = DEFAULT_ACCENT_COLOR
          }
          if (typeof state.bgAccentColor !== 'string' || !state.bgAccentColor.startsWith('#')) {
            state.bgAccentColor = DEFAULT_BG_ACCENT_COLOR
          }
        }
        return state as ThemeState
      },
    }
  )
)
