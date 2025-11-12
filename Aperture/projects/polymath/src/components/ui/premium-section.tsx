import React from 'react'
import { cn } from '@/lib/utils'

interface PremiumSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  spacing?: 'sm' | 'md' | 'lg'
}

export function PremiumSection({
  title,
  description,
  children,
  className,
  spacing = 'md',
}: PremiumSectionProps) {
  const spacingClasses = {
    sm: 'mb-6',
    md: 'mb-8',
    lg: 'mb-12',
  }

  return (
    <section className={cn(spacingClasses[spacing], className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: 'rgba(100, 180, 255, 1)' }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              className="text-sm"
              style={{ color: 'var(--premium-text-secondary)' }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
