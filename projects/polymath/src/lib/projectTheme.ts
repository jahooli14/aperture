/**
 * Project Theme Helpers
 * Shared color/theme utilities for project cards and components
 */

import {
  PenLine, Cpu, Palette, Music, Briefcase, Sparkles, Wand2, BookOpen, Box,
  type LucideIcon,
} from 'lucide-react'

const TYPE_ICONS: Record<string, LucideIcon> = {
  writing: PenLine,
  tech: Cpu,
  art: Palette,
  music: Music,
  business: Briefcase,
  life: Sparkles,
  creative: Wand2,
  learning: BookOpen,
}

export function iconForType(type?: string | null): LucideIcon {
  const t = (type || '').toLowerCase().trim()
  return TYPE_ICONS[t] || Box
}

export const PROJECT_COLORS: Record<string, string> = {
  tech: 'var(--project-tech-rgb)',
  art: 'var(--project-art-rgb)',
  writing: 'var(--project-writing-rgb)',
  music: 'var(--project-music-rgb)',
  business: 'var(--project-business-rgb)',
  life: 'var(--project-life-rgb)',
  creative: 'var(--project-creative-rgb)',
  learning: 'var(--project-learning-rgb)',
  default: 'var(--project-default-rgb)'
}

/**
 * All valid project type categories used across Create/Edit dialogs.
 */
export const PROJECT_TYPES = ['Writing', 'Tech', 'Art', 'Music', 'Business', 'Creative', 'Learning'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

/** Deterministic colour pick for a string with no entry in PROJECT_COLORS. */
function hashPick(seed: string): string {
  const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
}

/**
 * Returns a theme object with border, bg, text, and raw rgb values.
 *
 * Colour resolves in order: label → legacy `type` → hashed title.
 *
 * Labels win because they're the only one of the three that says what the
 * project actually IS — `type` defaults to "creative", which describes every
 * project here and so colours nothing. A label with its own palette entry
 * (music, art, writing…) uses it; any other label is hashed on the LABEL, not
 * the title, so every woodwork project comes out the same colour and the home
 * stack reads as grouped by craft rather than as confetti.
 */
export function getTheme(type: string, title: string, tags?: string[]) {
  const labels = (tags || []).map(t => t?.toLowerCase().trim()).filter(Boolean)
  const t = type?.toLowerCase().trim() || ''

  let rgb =
    labels.map(l => PROJECT_COLORS[l]).find(Boolean) ||
    (labels[0] ? hashPick(labels[0]) : undefined) ||
    PROJECT_COLORS[t]

  if (!rgb) rgb = hashPick(title)

  return {
    border: `rgba(${rgb}, 0.25)`,
    borderColor: `rgba(${rgb}, 0.25)`,
    bg: `rgba(${rgb}, 0.1)`,
    backgroundColor: `rgba(${rgb}, 0.08)`,
    text: `rgb(${rgb})`,
    textColor: `rgb(${rgb})`,
    rgb: rgb
  }
}
