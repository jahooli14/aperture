/**
 * useTheme Hook
 * Applies theme preferences to the document
 */

import { useEffect } from 'react'
import { useThemeStore } from '../stores/useThemeStore'
import { applyTheme } from '../lib/theme'

export function useTheme() {
  const { accentColor, bgAccentColor, intensity, fontSize } = useThemeStore()

  useEffect(() => {
    applyTheme(accentColor, bgAccentColor, intensity, fontSize)
  }, [accentColor, bgAccentColor, intensity, fontSize])

  return { accentColor, bgAccentColor, intensity, fontSize }
}
