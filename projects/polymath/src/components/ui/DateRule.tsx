/**
 * DateRule — editorial date treatment for content surfaces.
 *
 * Used on memories, projects, articles, bedtime, replay — anywhere a piece
 * of content needs a beautiful, consistent date stamp. Inspired by Day
 * One's date headers and magazine masthead conventions.
 *
 * Three variants:
 *   <DateRule date={iso} />            — full: "Tuesday · 12 May 2026"
 *   <DateRule date={iso} variant="stamp" /> — compact: "12 May"
 *   <DateRule date={iso} variant="age" />   — relative: "3 days ago"
 *
 * All variants share the same hairline rule + uppercase tracked metadata.
 */

import { useMemo } from 'react'

interface DateRuleProps {
  date: string | Date
  variant?: 'full' | 'stamp' | 'age'
  /** Optional eyebrow text shown before the date (e.g. "On This Day", "Captured") */
  label?: string
  /** Where the rule sits relative to the text */
  ruleSide?: 'left' | 'right' | 'both' | 'none'
  className?: string
}

function relativeAge(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 28) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return 'last month'
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} year${days > 730 ? 's' : ''} ago`
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function DateRule({
  date,
  variant = 'stamp',
  label,
  ruleSide = 'left',
  className = '',
}: DateRuleProps) {
  const text = useMemo(() => {
    const d = typeof date === 'string' ? new Date(date) : date
    if (variant === 'age') return relativeAge(d)
    if (variant === 'stamp') return `${d.getDate()} ${MONTHS[d.getMonth()]}`
    // full
    return `${WEEKDAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  }, [date, variant])

  const Rule = (
    <span
      aria-hidden
      className="h-px w-8 flex-shrink-0"
      style={{ background: 'linear-gradient(to right, transparent, rgba(var(--brand-primary-rgb), 0.45), transparent)' }}
    />
  )

  return (
    <div
      className={`flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] font-semibold ${className}`}
      style={{ color: 'rgba(var(--brand-primary-rgb), 0.7)' }}
    >
      {(ruleSide === 'left' || ruleSide === 'both') && Rule}
      {label && <span className="opacity-65">{label}</span>}
      <time dateTime={typeof date === 'string' ? date : date.toISOString()}>{text}</time>
      {(ruleSide === 'right' || ruleSide === 'both') && Rule}
    </div>
  )
}
