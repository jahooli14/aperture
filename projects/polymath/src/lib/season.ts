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

/** "10 weeks to Christmas", "5 days to Christmas", "Christmas is today",
 *  or null: no season, no date, or it's over. */
export function seasonLine(metadata: Project['metadata'], now = new Date()): string | null {
  const tag = readSeasonTag(metadata)
  if (!tag || tag.role !== 'main' || !tag.until) return null
  const end = Date.UTC(+tag.until.slice(0, 4), +tag.until.slice(5, 7) - 1, +tag.until.slice(8, 10))
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((end - today) / 86_400_000)
  if (days < 0) return null
  const name = tag.label ?? 'the end'
  if (days === 0) return `${name} is today`
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} to ${name}`
  return `${Math.round(days / 7)} weeks to ${name}`
}
