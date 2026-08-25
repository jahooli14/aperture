/** Author colours, initials and the small bits of date wording. */

// One per possible writer, so ten people still read as ten distinct voices.
const AUTHOR_COLOURS = [
  '#B5762A', '#3E7C74', '#8A5A7A', '#5F7A3E', '#4A6072',
  '#A85438', '#5A5F97', '#7A7038', '#A65464', '#2F6E8F',
]

export function authorColour(turnOrder: number): string {
  return AUTHOR_COLOURS[((turnOrder % AUTHOR_COLOURS.length) + AUTHOR_COLOURS.length) % AUTHOR_COLOURS.length]
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
