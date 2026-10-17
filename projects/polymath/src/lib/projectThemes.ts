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


/** When the lines were last re-read against new notes, and what they said
 *  before (api/_lib/project-themes.ts). Shown for a few days with an Undo. */
export const THEMES_UPDATE_SHOWN_DAYS = 3

export function readThemesUpdate(metadata: Project['metadata'], now = Date.now()): { at: string; previous: string[] } | null {
  const raw = (metadata as { themes_update?: { at?: unknown; previous?: unknown } } | undefined)?.themes_update
  if (!raw || typeof raw.at !== 'string' || !Array.isArray(raw.previous)) return null
  const age = now - new Date(raw.at).getTime()
  if (!Number.isFinite(age) || age > THEMES_UPDATE_SHOWN_DAYS * 86_400_000) return null
  const previous = raw.previous.filter((t): t is string => typeof t === 'string' && !!t.trim())
  return previous.length ? { at: raw.at, previous } : null
}

export type ProjectKind = 'ongoing' | 'one-off'

/** One word for how a project is worked, shown on its page. Ongoing
 *  (the book) is read off its "Keep in mind" lines; a one-off (a coaster)
 *  off its next move. Chosen when the project is made (metadata.kind). For
 *  older projects with no choice: having lines makes it ongoing. A live project
 *  with no move yet is offered lines, so it reads as ongoing too. */
export function projectKind(
  project: Pick<Project, 'metadata' | 'is_priority'>,
  hasMove: boolean,
): ProjectKind {
  const chosen = (project.metadata as { kind?: unknown } | undefined)?.kind
  if (chosen === 'ongoing' || chosen === 'one-off') return chosen
  if (readThemes(project.metadata).length > 0) return 'ongoing'
  if (project.is_priority && !hasMove) return 'ongoing'
  return 'one-off'
}
