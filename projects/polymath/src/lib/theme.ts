/**
 * Theme Configuration
 * Writes the user's picked colours and preferences onto :root as CSS
 * variables. Everything downstream reads --brand-primary-rgb /
 * --bg-accent-rgb, so a single setProperty repaints the whole app.
 */

import type { ThemeIntensity, FontSize } from '../stores/useThemeStore'

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

interface Rgb { r: number; g: number; b: number }
interface Hsl { h: number; s: number; l: number }

const FALLBACK_RGB: Rgb = { r: 56, g: 189, b: 248 } // #38bdf8

function hexToRgb(hex: string): Rgb {
  if (typeof hex !== 'string' || !/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) {
    return FALLBACK_RGB
  }
  const cleaned = hex.replace('#', '')
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned
  const num = parseInt(full, 16)
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  }
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break
    case gn: h = ((bn - rn) / d + 2); break
    default: h = ((rn - gn) / d + 4)
  }
  return { h: h * 60, s, l }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const hn = h / 360
  return {
    r: Math.round(hue2rgb(hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(hn) * 255),
    b: Math.round(hue2rgb(hn - 1 / 3) * 255),
  }
}

function adjustLightness(hex: string, delta: number): Rgb {
  const hsl = rgbToHsl(hexToRgb(hex))
  return hslToRgb({ ...hsl, l: Math.max(0.05, Math.min(0.95, hsl.l + delta)) })
}

function rgbString({ r, g, b }: Rgb): string {
  return `${r}, ${g}, ${b}`
}

/**
 * Apply theme to document root.
 */
export function applyTheme(
  accentColor: string,
  bgAccentColor: string,
  intensity: ThemeIntensity,
  fontSize: FontSize
) {
  const root = document.documentElement

  const primary = hexToRgb(accentColor)
  const primaryLight = adjustLightness(accentColor, 0.12)
  const primaryDark = adjustLightness(accentColor, -0.18)
  const bgAccent = hexToRgb(bgAccentColor)

  root.style.setProperty('--brand-primary-rgb', rgbString(primary))
  root.style.setProperty('--color-accent-rgb', rgbString(primary))
  root.style.setProperty('--color-accent-light-rgb', rgbString(primaryLight))
  root.style.setProperty('--color-accent-dark-rgb', rgbString(primaryDark))
  root.style.setProperty('--color-info-rgb', rgbString(primary))
  root.style.setProperty('--color-success-rgb', rgbString(primary))
  root.style.setProperty('--color-warning-rgb', rgbString(primary))
  root.style.setProperty('--bg-accent-rgb', rgbString(bgAccent))

  const { opacity, saturation } = intensityFactors[intensity]
  const { base, scale } = fontSizeScales[fontSize]

  root.style.setProperty('--theme-opacity', opacity.toString())
  root.style.setProperty('--base-font-size', base)
  root.style.setProperty('--font-scale', scale.toString())
  root.style.fontSize = base

  if (saturation !== 1) {
    root.style.filter = `saturate(${saturation})`
  } else {
    root.style.filter = ''
  }
}
