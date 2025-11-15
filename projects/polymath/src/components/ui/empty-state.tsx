import React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div
        className="mb-4 rounded-full p-4"
        style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Icon
          className="w-8 h-8"
          style={{ color: 'var(--premium-blue)' }}
        />
      </div>
      <h3
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--premium-text-primary)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mb-6 max-w-md"
          style={{ color: 'var(--premium-text-secondary)' }}
        >
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
