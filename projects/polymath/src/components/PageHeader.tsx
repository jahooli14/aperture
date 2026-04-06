/**
 * PageHeader - Shared page header component
 * Matches the Projects page design language: bold italic "your X" with accent span.
 * Supports page color identity system via data-page attribute.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  /** The possessive prefix, e.g. "your" — rendered in white before the accent word */
  prefix?: string
  /** The accent word rendered in the page accent color, e.g. "projects" */
  title: string
  subtitle?: string
  /** Optional count badge shown next to title */
  count?: number
  /** Optional CTA button / action element */
  action?: React.ReactNode
  /** Show a back button that navigates back in history */
  backable?: boolean
  /** Optional accent color override (defaults to page accent or brand-primary) */
  accentColor?: string
}

/**
 * Reusable page header that mirrors the Projects page "your X" design:
 * - Bold italic uppercase title
 * - Accent-colored keyword
 * - Optional serif subtitle for content descriptions
 * - Count badge with pop animation
 * - Consistent spacing and animation
 */
export function PageHeader({
  prefix = 'your',
  title,
  subtitle,
  count,
  action,
  backable,
  accentColor,
}: PageHeaderProps) {
  const navigate = useNavigate()
  const accent = accentColor || 'rgb(var(--page-accent-rgb, var(--brand-primary-rgb)))'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex items-start justify-between gap-4 mb-6"
    >
      <div className="flex items-center gap-3 min-w-0">
        {backable && (
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors press-spring"
            style={{
              background: 'var(--glass-surface)',
              border: '1px solid var(--glass-surface-hover)',
            }}
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: accent }} />
          </button>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-none">
              {prefix}{' '}
              <span style={{ color: accent }}>{title}</span>
            </h1>

            {count !== undefined && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{
                  background: `rgba(var(--page-accent-rgb, var(--brand-primary-rgb)), 0.15)`,
                  color: accent,
                  border: `1px solid rgba(var(--page-accent-rgb, var(--brand-primary-rgb)), 0.25)`,
                }}
              >
                {count}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="section-subtitle mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex-shrink-0 flex items-center gap-2">
          {action}
        </div>
      )}
    </motion.div>
  )
}
