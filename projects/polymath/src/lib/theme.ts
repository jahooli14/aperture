/**
 * Theme Configuration
 * Defines color palettes and applies theme dynamically
 */

import type { AccentColor, ThemeIntensity, FontSize } from '../stores/useThemeStore'

// Color palettes for each accent color
const colorPalettes: Record<AccentColor, { primary: string; light: string; dark: string }> = {
  cyan: {
    primary: 'rgb(var(--brand-primary-rgb))',
    light: 'rgb(var(--color-accent-light-rgb))',
    dark: 'rgb(var(--color-accent-dark-rgb))',
  },
}

// Intensity multipliers for colors
const intensityFactors: Record<ThemeIntensity, { opacity: number; saturation: number }> = {
  subtle: { opacity: 0.7, saturation: 0.8 },
  normal: { opacity: 1, saturation: 1 },
  vibrant: { opacity: 1, saturation: 1.2 },
}

// Font size scales
const fontSizeScales: Record<FontSize, { base: string; scale: number }> = {
  small: { base: '14px', scale: 0.9 },
  normal: { base: '16px', scale: 1 },
  large: { base: '18px', scale: 1.1 },
}

/**
 * Apply theme to document root
 */
export function applyTheme(
  accentColor: AccentColor,
  intensity: ThemeIntensity,
  fontSize: FontSize
) {
  const root = document.documentElement
  const palette = colorPalettes[accentColor]
  const { opacity, saturation } = intensityFactors[intensity]
  const { base, scale } = fontSizeScales[fontSize]

  // Apply accent colors
  root.style.setProperty('--premium-blue', palette.primary)
  root.style.setProperty('--premium-blue-light', palette.light)
  root.style.setProperty('--premium-blue-dark', palette.dark)

  // Apply opacity for intensity
  root.style.setProperty('--theme-opacity', opacity.toString())

  // Apply font size
  root.style.setProperty('--base-font-size', base)
  root.style.setProperty('--font-scale', scale.toString())
  root.style.fontSize = base

  // Apply saturation filter (vibrant mode)
  if (saturation !== 1) {
    root.style.filter = `saturate(${saturation})`
  } else {
    root.style.filter = ''
  }
}

/**
 * Get color palette preview for a given accent color
 */
export function getColorPreview(accentColor: AccentColor) {
  return colorPalettes[accentColor]
}

/**
 * Get all available accent colors
 */
export function getAvailableColors(): AccentColor[] {
  return Object.keys(colorPalettes) as AccentColor[]
}
