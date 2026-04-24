/**
 * Theme Store
 * Manages user theme preferences (accent color, intensity, font size)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentColor = 'cyan'
export type ThemeIntensity = 'subtle' | 'normal' | 'vibrant'
export type FontSize = 'small' | 'normal' | 'large'

interface ThemeState {
  accentColor: AccentColor
  intensity: ThemeIntensity
  fontSize: FontSize
  showBugTracker: boolean
  showRegenerateInsights: boolean

  // Actions
  setAccentColor: (color: AccentColor) => void
  setIntensity: (intensity: ThemeIntensity) => void
  setFontSize: (size: FontSize) => void
  setShowBugTracker: (show: boolean) => void
  setShowRegenerateInsights: (show: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColor: 'cyan',
      intensity: 'normal',
      fontSize: 'normal',
      showBugTracker: false,
      showRegenerateInsights: false,

      setAccentColor: (color) => set({ accentColor: color }),
      setIntensity: (intensity) => set({ intensity }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowBugTracker: (show) => set({ showBugTracker: show }),
      setShowRegenerateInsights: (show) => set({ showRegenerateInsights: show }),
    }),
    {
      name: 'rosette-theme',
    }
  )
)
