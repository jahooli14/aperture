/**
 * Client side of themes and the catch-up (api/_lib/project-themes.ts,
 * api/_lib/up-to-speed.ts). The thresholds are repeated rather than
 * imported, since shipped src/ never reaches into api/_lib — keep them in
 * step with ACTIVE_WITHIN_DAYS and UP_TO_SPEED_AFTER_DAYS there.
 */

import type { Project } from '../types'

export const ACTIVE_WITHIN_DAYS = 14
export const UP_TO_SPEED_AFTER_DAYS = 14
export const MAX_THEMES = 3

export interface ProjectTheme { text: string; at: string }

export interface CitedLine { text: string; from: string }
export interface UpToSpeed {
  what: string | null
  where: CitedLine | null
  open: CitedLine[]
  basis_at: string | null
  built_at: string
}

export function readThemes(metadata: Project['metadata']): ProjectTheme[] {
  const raw = (metadata as { themes?: unknown } | undefined)?.themes
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is ProjectTheme => !!t && typeof t.text === 'string' && !!t.text.trim())
    .slice(0, MAX_THEMES)
}

/** Whole days since the newest sign of work on it; null if never touched. */
export function daysQuiet(project: Pick<Project, 'last_active' | 'last_session_ended_at'>, now = Date.now()): number | null {
  const times = [project.last_session_ended_at, project.last_active]
    .map(d => (d ? new Date(d).getTime() : 0))
    .filter(n => Number.isFinite(n) && n > 0)
  if (times.length === 0) return null
  return Math.floor((now - Math.max(...times)) / 86_400_000)
}

export function isActivelyWorked(project: Pick<Project, 'last_active' | 'last_session_ended_at'>, now = Date.now()): boolean {
  const d = daysQuiet(project, now)
  return d != null && d < ACTIVE_WITHIN_DAYS
}

export function isLiveStatus(status: Project['status']): boolean {
  return !['completed', 'graveyard', 'archived', 'abandoned'].includes(status)
}

export function themeDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
