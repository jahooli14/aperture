import type { ProjectStatus } from '../types'

/**
 * The graveyard is stored as 'abandoned'.
 *
 * The app's own word for it is "graveyard", and that's what the UI says, but
 * the projects.status CHECK constraint only permits
 * upcoming / active / dormant / on-hold / maintaining / completed / archived /
 * abandoned. Writing 'graveyard' fails the constraint outright — which is
 * exactly what "Failed to update project" was: Postgres refusing a value the
 * app invented. 'abandoned' means the same thing and nothing else writes it.
 *
 * Readers accept both so rows written before this still show up.
 */
export const GRAVEYARD_STATUS: ProjectStatus = 'abandoned'

export function isGraveyard(status?: ProjectStatus | string | null): boolean {
  return status === 'abandoned' || status === 'graveyard'
}

/** Buried or finished — either way it stops surfacing as live work. */
export function isRetired(status?: ProjectStatus | string | null): boolean {
  return isGraveyard(status) || status === 'completed'
}
