import type { Project } from '../types'

/** Which project, if any, becomes live: the first one they named, unless they
 *  already have a live project. Pure so the rule can be tested. */
export function chooseLiveStarter(createdIds: string[], existing: Pick<Project, 'state' | 'is_priority'>[]): string | null {
  if (createdIds.length === 0) return null
  const alreadyLive = existing.some(p => p.state === 'live' || p.is_priority)
  return alreadyLive ? null : createdIds[0]
}
