import type { Memory } from '../types'

function toLocalDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateKeyDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Consecutive days (ending today or yesterday) with at least one memory
 * captured. Counting from yesterday too means the streak doesn't drop to
 * zero the moment the clock rolls over — it stays "alive" until a full day
 * is missed, same as most habit trackers.
 */
export function computeVoiceStreak(memories: Memory[]): number {
  if (memories.length === 0) return 0

  const capturedDays = new Set(memories.map((m) => toLocalDateKey(m.created_at)))

  let cursor = 0
  if (!capturedDays.has(dateKeyDaysAgo(0))) {
    if (!capturedDays.has(dateKeyDaysAgo(1))) return 0
    cursor = 1
  }

  let streak = 0
  while (capturedDays.has(dateKeyDaysAgo(cursor))) {
    streak++
    cursor++
  }
  return streak
}
