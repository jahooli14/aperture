/**
 * Pure date arithmetic for ProjectArc.tsx — no projected pace, just plain
 * counting. See ProjectArc.tsx's header for why a rate is never computed.
 */

export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso + 'T00:00:00')
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function targetDateLine(days: number): string {
  if (days === 0) return 'Target date is today.'
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} until the target date.`
  const overdue = Math.abs(days)
  return `${overdue} day${overdue === 1 ? '' : 's'} past the target date.`
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
