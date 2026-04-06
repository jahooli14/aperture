/**
 * Unified Empty State
 * Consistent visual pattern for pages with no data.
 * Uses page accent color system + serif subtitle for warmth.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Optional serif-styled prompt that encourages action */
  prompt?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  prompt,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {/* Glowing icon container */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        className="mb-6 rounded-2xl p-5 relative"
        style={{
          backgroundColor: 'rgba(var(--page-accent-rgb, var(--brand-primary-rgb)), 0.08)',
          border: '1px solid rgba(var(--page-accent-rgb, var(--brand-primary-rgb)), 0.15)',
          boxShadow: '0 0 30px rgba(var(--page-accent-rgb, var(--brand-primary-rgb)), 0.1)',
        }}
      >
        <Icon
          className="w-8 h-8"
          style={{ color: 'rgb(var(--page-accent-rgb, var(--brand-primary-rgb)))' }}
        />
      </motion.div>

      {/* Title */}
      <h3
        className="text-lg font-black uppercase tracking-tight mb-2"
        style={{ color: 'var(--brand-text-primary)' }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className="text-sm mb-2 max-w-sm leading-relaxed"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          {description}
        </p>
      )}

      {/* Serif prompt — warm, encouraging nudge */}
      {prompt && (
        <p
          className="section-subtitle mb-6 max-w-xs"
        >
          {prompt}
        </p>
      )}

      {/* CTA */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}
