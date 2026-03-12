/**
 * PageHeader - Shared page header component
 * Consistent header styling matching the HomePage design language.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optional count badge shown next to title */
  count?: number
  /** Optional CTA button / action element */
  action?: React.ReactNode
  /** Show a back button that navigates back in history */
  backable?: boolean
}

/**
 * Reusable page header that mirrors the premium design language used in
 * HomePage: gradient text, subtle metadata line, optional count chip.
 */
export function PageHeader({ title, subtitle, count, action, backable }: PageHeaderProps) {
  const navigate = useNavigate()

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
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{
              background: 'var(--glass-surface)',
              border: '1px solid var(--glass-surface-hover)',
            }}
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: 'var(--premium-platinum)' }} />
          </button>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1
              className="text-2xl font-bold tracking-tight truncate"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              {title}
            </h1>

            {count !== undefined && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,0.25)',
                }}
              >
                {count}
              </span>
            )}
          </div>

          {subtitle && (
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--brand-text-muted)' }}
            >
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
