/**
 * Pull-to-Refresh Component
 * Visual wrapper for pull-to-refresh functionality
 */

import { ReactNode, useState, useEffect } from 'react'
import { Loader2, ArrowDown, RefreshCw } from 'lucide-react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { cn } from '../lib/utils'
import { haptic } from '../utils/haptics'

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
  const [justCompleted, setJustCompleted] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false)

  const rotation = Math.min((pullDistance / threshold) * 180, 180)
  const opacity = Math.min(pullDistance / threshold, 1)
  const scale = 0.8 + (pullDistance / threshold) * 0.2 // Grows from 0.8 to 1.0

  // Trigger haptic feedback at threshold
  useEffect(() => {
    if (isTriggered && !hasTriggeredHaptic && !isRefreshing) {
      haptic.light()
      setHasTriggeredHaptic(true)
    }
    if (!isPulling) {
      setHasTriggeredHaptic(false)
    }
  }, [isTriggered, hasTriggeredHaptic, isRefreshing, isPulling])

  // Track completion and show checkmark briefly
  useEffect(() => {
    if (!isRefreshing && pullDistance === 0 && lastRefreshTime) {
      const timeSinceRefresh = Date.now() - lastRefreshTime.getTime()
      if (timeSinceRefresh < 500) {
        setJustCompleted(true)
        haptic.success()
        setTimeout(() => setJustCompleted(false), 800)
      }
    }
    if (isRefreshing && !lastRefreshTime) {
      setLastRefreshTime(new Date())
    }
    if (!isRefreshing && pullDistance === 0) {
      // Reset after animation completes
      setTimeout(() => setLastRefreshTime(null), 1000)
    }
  }, [isRefreshing, pullDistance, lastRefreshTime])

  return (
    <div
      ref={scrollableRef as any}
      className={cn('relative overflow-y-auto', className)}
    >
      {/* Pull indicator with personality */}
      <div
        className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-10 transition-all duration-200"
        style={{
          height: isRefreshing ? '70px' : `${Math.min(pullDistance, 70)}px`,
          opacity: isRefreshing ? 1 : opacity
        }}
      >
        {/* Icon container */}
        <div
          className={cn(
            'flex items-center justify-center rounded-full transition-all duration-300',
            justCompleted
              ? 'bg-green-500 shadow-2xl scale-110'
              : isRefreshing
              ? 'bg-white shadow-xl'
              : isTriggered
              ? 'bg-white shadow-lg'
              : 'bg-white/80 shadow-md'
          )}
          style={{
            width: isRefreshing || justCompleted ? '48px' : `${Math.max(32, 32 * scale)}px`,
            height: isRefreshing || justCompleted ? '48px' : `${Math.max(32, 32 * scale)}px`,
            transform: `scale(${justCompleted ? 1.1 : 1})`
          }}
        >
          {justCompleted ? (
            <span className="text-2xl">✓</span>
          ) : isRefreshing ? (
            <RefreshCw className="h-6 w-6 animate-spin" style={{ color: 'var(--premium-blue)' }} />
          ) : (
            <ArrowDown
              className={cn(
                'transition-all duration-200',
                isTriggered ? 'text-blue-600' : 'text-gray-400'
              )}
              style={{
                transform: `rotate(${rotation}deg)`,
                width: `${Math.max(20, 20 * scale)}px`,
                height: `${Math.max(20, 20 * scale)}px`
              }}
            />
          )}
        </div>

        {/* Status text */}
        {(isRefreshing || justCompleted || (isPulling && pullDistance > 30)) && (
          <p
            className="mt-2 text-xs font-medium transition-all duration-200"
            style={{
              color: justCompleted ? 'var(--premium-emerald)' : 'var(--premium-text-secondary)',
              opacity: justCompleted ? 1 : isRefreshing ? 0.8 : 0.6
            }}
          >
            {justCompleted
              ? `✓ Updated ${formatRefreshTime(lastRefreshTime)}`
              : isRefreshing
              ? 'Refreshing...'
              : isTriggered
              ? 'Release to refresh'
              : 'Pull to refresh'}
          </p>
        )}
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isRefreshing
            ? 'translateY(70px)'
            : isPulling
            ? `translateY(${Math.min(pullDistance, 70)}px)`
            : 'translateY(0)'
        }}
      >
        {children}
      </div>
    </div>
  )
}

function formatRefreshTime(date: Date | null): string {
  if (!date) return 'just now'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return 'just now'
}
