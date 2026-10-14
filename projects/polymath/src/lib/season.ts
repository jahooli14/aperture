/**
 * The season on the home card: one muted line, plain arithmetic. Never a
 * pace, never a warning — "10 weeks to Christmas" and nothing more. The
 * tag is written by the server (api/_lib/season.ts); this only reads it.
 */

import type { Project } from '../types'

export interface SeasonTag {
  role: 'main' | 'also'; until: string | null; label: string | null
  size?: 'hours' | 'weekend' | null; from?: string | null; waiting?: string | null
}

export function readSeasonTag(metadata: Project['metadata']): SeasonTag | null {
  const raw = (metadata as { season?: Partial<SeasonTag> } | undefined)?.season
  if (!raw || (raw.role !== 'main' && raw.role !== 'also')) return null
  return {
    role: raw.role,
    until: typeof raw.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.until) ? raw.until : null,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : null,
    size: raw.size === 'hours' || raw.size === 'weekend' ? raw.size : null,
    from: typeof raw.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.from) ? raw.from : null,
    waiting: typeof raw.waiting === 'string' && raw.waiting.trim() ? raw.waiting.trim() : null,
  }
}

/** A small finish that can't be started yet: what it waits on, or a start
 *  day still ahead. Same rule as the server (api/_lib/season.ts). */
export function blockedReason(
  project: Pick<Project, 'metadata'>, now = new Date(),
): { waiting: string | null; from: string | null } | null {
  const tag = readSeasonTag(project.metadata)
  if (!tag || tag.role !== 'also') return null
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  if (tag.waiting) return { waiting: tag.waiting, from: tag.from ?? null }
  if (tag.from && tag.from > today) return { waiting: null, from: tag.from }
  return null
}

/** A small thing to finish this season, still running and not yet done. The
 *  page offers it a quiet one-tap "Finished it", no ceremony. */
export function isSmallFinish(
  project: Pick<Project, 'metadata' | 'status' | 'state' | 'is_priority'>, now = new Date(),
): boolean {
  if (project.status === 'completed' || project.status === 'graveyard' || project.state === 'live' || project.is_priority) return false
  const tag = readSeasonTag(project.metadata)
  if (!tag || tag.role !== 'also') return false
  if (!tag.until) return true
  const end = Date.UTC(+tag.until.slice(0, 4), +tag.until.slice(5, 7) - 1, +tag.until.slice(8, 10))
  return end >= Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

/** "10 weeks to Christmas", "5 days to Christmas", "Christmas is today", or
 *  without a name "10 weeks left" / "Last day"; or null: no season, no date,
 *  it's over, or this isn't the live project (a stale tag on a project that
 *  has since stopped being the main one). */
export function seasonLine(
  project: Pick<Project, 'metadata' | 'state' | 'is_priority'>, now = new Date(),
): string | null {
  if (project.state !== 'live' && !project.is_priority) return null
  const tag = readSeasonTag(project.metadata)
  if (!tag || tag.role !== 'main' || !tag.until) return null
  const end = Date.UTC(+tag.until.slice(0, 4), +tag.until.slice(5, 7) - 1, +tag.until.slice(8, 10))
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((end - today) / 86_400_000)
  if (days < 0) return null
  if (days === 0) return tag.label ? `${tag.label} is today` : 'Last day'
  const span = days < 14 ? `${days} ${days === 1 ? 'day' : 'days'}` : `${Math.round(days / 7)} weeks`
  return tag.label ? `${span} to ${tag.label}` : `${span} left`
}
