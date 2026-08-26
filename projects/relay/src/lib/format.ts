/** Author colours, initials and the small bits of date wording. */

/**
 * One colour per writer, resolved through CSS variables so each theme gets a
 * value that stays legible on its own ground — a teal that reads on paper is
 * too dark on a black screen.
 */
const AUTHOR_SLOTS = 10

export function authorColour(turnOrder: number): string {
  const slot = ((turnOrder % AUTHOR_SLOTS) + AUTHOR_SLOTS) % AUTHOR_SLOTS
  return `var(--author-${slot})`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function timeAgo(iso: string | null): string {
  if (!iso) return 'not yet'
  const elapsed = Date.now() - Date.parse(iso)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "4 months", "11 days" — for how long a story has been running. */
export function duration(days: number): string {
  if (days < 1) return 'today'
  if (days === 1) return '1 day'
  if (days < 60) return `${days} days`
  const months = Math.round(days / 30.4)
  if (months < 24) return `${months} months`
  return `${Math.round(days / 365)} years`
}

const GAP_THRESHOLD_DAYS = 3

/**
 * How long the story sat still between two lines, when that gap is long
 * enough to be part of it. Silence is a real feature of a story written over
 * months, so the thread says so — plainly, and only from the timestamps.
 * Returns null for anything under a few days.
 */
export function gapLabel(previousIso: string, iso: string): string | null {
  const elapsed = Date.parse(iso) - Date.parse(previousIso)
  if (!Number.isFinite(elapsed) || elapsed <= 0) return null

  const days = Math.floor(elapsed / 86_400_000)
  if (days < GAP_THRESHOLD_DAYS) return null

  if (days < 14) return `${days} days later`
  if (days < 60) {
    const weeks = Math.round(days / 7)
    return `${weeks} weeks later`
  }
  if (days < 365) {
    const months = Math.round(days / 30.4)
    return `${months} month${months === 1 ? '' : 's'} later`
  }
  const years = Math.round(days / 365)
  return `${years} year${years === 1 ? '' : 's'} later`
}
