/**
 * Drift and stall classification (SPEC.md).
 *
 * Drift: distance between the project as written and the last 90 days of
 * capture. High drift + adjacent chatter -> reshape. High drift + silence
 * -> let it go. Low drift means the project still describes itself
 * accurately, whatever else is going on.
 *
 * Stalled: the gate composites require on BOTH parents. Time alone isn't
 * stall -- a finished-shaped project sitting quietly is fine. Stall is
 * "no session recently AND still has an open question" (an empty slot).
 */

const DRIFT_HIGH_THRESHOLD = 0.45 // 1 - cosineSimilarity; tune against real embeddings once live
const STALL_WEEKS = 6

export type DriftVerdict = 'stable' | 'reshape' | 'let-go'

export function classifyDrift(driftScore: number, hasRecentChatter: boolean): DriftVerdict {
  if (driftScore < DRIFT_HIGH_THRESHOLD) return 'stable'
  return hasRecentChatter ? 'reshape' : 'let-go'
}

export interface ProjectForStall {
  last_session_ended_at: string | null
  slots: Array<{ filled: boolean }>
}

export function isStalled(project: ProjectForStall, now: Date = new Date()): boolean {
  const hasEmptySlot = project.slots.some(s => !s.filled)
  if (!hasEmptySlot) return false

  if (!project.last_session_ended_at) return true // never worked on -- trivially "no recent session"

  const lastSession = new Date(project.last_session_ended_at)
  const weeksSince = (now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24 * 7)
  return weeksSince >= STALL_WEEKS
}
