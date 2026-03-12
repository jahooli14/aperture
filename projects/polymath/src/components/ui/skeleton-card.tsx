import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonCardProps {
  variant?: 'default' | 'list' | 'grid'
  count?: number
  className?: string
}

export function SkeletonCard({ variant = 'default', count = 1, className }: SkeletonCardProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'list':
        return (
          <div className="premium-glass-subtle p-6 rounded-xl animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-[rgba(255,255,255,0.1)] rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-[rgba(255,255,255,0.1)] rounded-lg w-3/4" />
                <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded w-full" />
                <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded w-5/6" />
              </div>
            </div>
          </div>
        )

      case 'grid':
        return (
          <div className="premium-glass-subtle p-6 rounded-xl animate-pulse">
            <div className="space-y-4">
              <div className="w-full h-32 bg-[rgba(255,255,255,0.1)] rounded-lg" />
              <div className="h-6 bg-[rgba(255,255,255,0.1)] rounded-lg w-3/4" />
              <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded w-full" />
              <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded w-4/5" />
            </div>
          </div>
        )

      default:
        return (
          <div className="premium-glass-subtle p-6 rounded-xl animate-pulse">
            <div className="space-y-3">
              <div className="h-6 bg-[rgba(255,255,255,0.1)] rounded-lg w-3/4" />
              <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded w-full" />
              <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded w-5/6" />
            </div>
          </div>
        )
    }
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(className)}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  )
}
