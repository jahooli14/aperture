/**
 * Pull-to-Refresh Component
 * Visual wrapper for pull-to-refresh functionality
 */

import { ReactNode } from 'react'
import { Loader2, ArrowDown } from 'lucide-react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { cn } from '../lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  threshold?: number
  className?: string
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  className
}: PullToRefreshProps) {
  const { scrollableRef, isPulling, isRefreshing, pullDistance, isTriggered } =
    usePullToRefresh({ onRefresh, threshold })

  const rotation = Math.min((pullDistance / threshold) * 180, 180)
  const opacity = Math.min(pullDistance / threshold, 1)

  return (
    <div
      ref={scrollableRef as any}
      className={cn('relative overflow-y-auto', className)}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10 transition-all duration-200"
        style={{
          height: isRefreshing ? '60px' : `${Math.min(pullDistance, 60)}px`,
          opacity: isRefreshing ? 1 : opacity
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-white shadow-lg transition-all duration-200',
            isRefreshing ? 'h-10 w-10' : 'h-8 w-8'
          )}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-blue-900 animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                'h-5 w-5 transition-all duration-200',
                isTriggered ? 'text-blue-900' : 'text-neutral-400'
              )}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isRefreshing
            ? 'translateY(60px)'
            : isPulling
            ? `translateY(${Math.min(pullDistance, 60)}px)`
            : 'translateY(0)'
        }}
      >
        {children}
      </div>
    </div>
  )
}
