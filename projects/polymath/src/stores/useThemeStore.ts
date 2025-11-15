/**
 * Theme Store
 * Manages user theme preferences (accent color, intensity, font size)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentColor = 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple'
export type ThemeIntensity = 'subtle' | 'normal' | 'vibrant'
export type FontSize = 'small' | 'normal' | 'large'

interface ThemeState {
  accentColor: AccentColor
  intensity: ThemeIntensity
  fontSize: FontSize

  // Actions
  setAccentColor: (color: AccentColor) => void
  setIntensity: (intensity: ThemeIntensity) => void
  setFontSize: (size: FontSize) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColor: 'blue',
      intensity: 'normal',
      fontSize: 'normal',

      setAccentColor: (color) => set({ accentColor: color }),
      setIntensity: (intensity) => set({ intensity }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: 'polymath-theme',
    }
  )
)
