/**
 * The season on the home card: one muted line, plain arithmetic. Never a
 * pace, never a warning — "10 weeks to Christmas" and nothing more. The
 * tag is written by the server (api/_lib/season.ts); this only reads it.
 */

import type { Project } from '../types'

export interface SeasonTag { role: 'main' | 'also'; until: string | null; label: string | null }

export function readSeasonTag(metadata: Project['metadata']): SeasonTag | null {
  const raw = (metadata as { season?: Partial<SeasonTag> } | undefined)?.season
  if (!raw || (raw.role !== 'main' && raw.role !== 'also')) return null
  return {
    role: raw.role,
    until: typeof raw.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.until) ? raw.until : null,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : null,
  }
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
