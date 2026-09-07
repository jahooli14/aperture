/**
 * How the reader looks, remembered between articles.
 *
 * Reading preferences are personal and they don't change often — picking
 * your size again on every article is the kind of small tax that makes an
 * app feel borrowed. These live in localStorage, not the server: they're
 * about this screen in this hand.
 *
 * Pure module. No React, no DOM beyond localStorage, so it unit-tests.
 */

export type ReaderTypeface = 'reading-serif' | 'sans'
export type ReaderSize = 'small' | 'medium' | 'large' | 'xlarge'
export type ReaderWidth = 'narrow' | 'wide'

export interface ReaderPrefs {
  typeface: ReaderTypeface
  size: ReaderSize
  width: ReaderWidth
  /** Extra air between lines, for tired eyes. */
  looseLines: boolean
}

export const DEFAULT_PREFS: ReaderPrefs = {
  typeface: 'reading-serif',
  size: 'medium',
  width: 'narrow',
  looseLines: false,
}

const STORAGE_KEY = 'aperture.reader.prefs.v1'

const TYPEFACES: ReaderTypeface[] = ['reading-serif', 'sans']
const SIZES: ReaderSize[] = ['small', 'medium', 'large', 'xlarge']
const WIDTHS: ReaderWidth[] = ['narrow', 'wide']

/** Never trust what came out of storage — an old build may have written anything. */
export function coercePrefs(raw: unknown): ReaderPrefs {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReaderPrefs>
  return {
    typeface: TYPEFACES.includes(input.typeface as ReaderTypeface) ? input.typeface as ReaderTypeface : DEFAULT_PREFS.typeface,
    size: SIZES.includes(input.size as ReaderSize) ? input.size as ReaderSize : DEFAULT_PREFS.size,
    width: WIDTHS.includes(input.width as ReaderWidth) ? input.width as ReaderWidth : DEFAULT_PREFS.width,
    looseLines: typeof input.looseLines === 'boolean' ? input.looseLines : DEFAULT_PREFS.looseLines,
  }
}

export function loadPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    return coercePrefs(JSON.parse(raw))
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode / quota. Losing a font size is not worth an error.
  }
}

/**
 * Body sizes. The jump between steps is deliberately small — the useful
 * range on a phone is narrow, and the old three-step scale skipped past
 * whatever the right answer was.
 */
const SIZE_PX: Record<ReaderSize, number> = {
  small: 17,
  medium: 19,
  large: 21,
  xlarge: 24,
}

/** Bigger text needs proportionally less leading, not more. */
const SIZE_LEADING: Record<ReaderSize, number> = {
  small: 1.72,
  medium: 1.68,
  large: 1.62,
  xlarge: 1.56,
}

export interface ReaderTypeStyle {
  fontFamily: string
  fontSize: string
  lineHeight: number
  letterSpacing: string
  /** Measure cap, in ch, so the line length stays readable at any size. */
  maxWidth: string
  titleSize: string
}

export function typeStyle(prefs: ReaderPrefs): ReaderTypeStyle {
  const px = SIZE_PX[prefs.size]
  const lineHeight = SIZE_LEADING[prefs.size] + (prefs.looseLines ? 0.18 : 0)
  const serif = prefs.typeface === 'reading-serif'
  return {
    fontFamily: serif ? 'var(--brand-font-reading)' : 'var(--brand-font-body)',
    fontSize: `${px}px`,
    lineHeight,
    // Inter is drawn a touch wide for long-form; Literata needs none.
    letterSpacing: serif ? '0' : '-0.006em',
    // 66ch is the classic comfortable measure. "Wide" is for tables and
    // code-heavy posts, not for prose.
    maxWidth: prefs.width === 'narrow' ? '34rem' : '44rem',
    titleSize: `${Math.round(px * 1.85)}px`,
  }
}

/** What the settings sheet shows next to each option. */
export const SIZE_LABELS: Record<ReaderSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'Largest',
}

export const TYPEFACE_LABELS: Record<ReaderTypeface, string> = {
  'reading-serif': 'Serif',
  sans: 'Sans',
}
