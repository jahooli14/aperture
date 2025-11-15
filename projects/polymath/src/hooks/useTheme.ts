/**
 * useTheme Hook
 * Applies theme preferences to the document
 */

import { useEffect } from 'react'
import { useThemeStore } from '../stores/useThemeStore'
import { applyTheme } from '../lib/theme'

export function useTheme() {
  const { accentColor, intensity, fontSize } = useThemeStore()

  useEffect(() => {
    applyTheme(accentColor, intensity, fontSize)
  }, [accentColor, intensity, fontSize])

  return { accentColor, intensity, fontSize }
}
