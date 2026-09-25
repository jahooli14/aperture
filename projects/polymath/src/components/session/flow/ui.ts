/**
 * Shared look for the session flow. Theme tokens only (theme.css), so it
 * follows the app rather than inventing a palette of its own.
 */

export const text2 = { color: 'var(--brand-text-secondary)' }
export const faint = (opacity: number) => ({ color: 'var(--brand-text-secondary)', opacity })

export const accent = 'rgb(var(--brand-primary-rgb))'
export const accentA = (a: number) => `rgba(var(--brand-primary-rgb),${a})`

export const serif = { fontFamily: 'var(--brand-font-serif)' }

/** The one filled button on any screen. */
export const primaryButton = {
  background: accentA(0.9),
  color: '#0b1220',
  boxShadow: `0 8px 28px -8px ${accentA(0.55)}`,
}

/** Quiet, outlined: everything that isn't the one thing to press. */
export const quietButton = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--brand-text-secondary)',
}

export const label = 'text-[10px] font-bold uppercase tracking-[0.24em]'

export function formatClock(seconds: number): string {
  const abs = Math.abs(seconds)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const body = h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`
  return `${seconds < 0 ? '+' : ''}${body}`
}

export function windowLabel(minutes: number | null): string {
  if (minutes == null) return 'open-ended'
  return minutes < 60 ? `${minutes} minutes` : minutes === 60 ? '1 hour' : `${minutes / 60} hours`
}
