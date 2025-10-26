/**
 * Pull-to-Refresh Hook
 * Android-style pull-down gesture to refresh content
 */

import { useEffect, useRef, useState } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  resistance?: number
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5
}: PullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)

  const touchStartY = useRef(0)
  const scrollableRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = scrollableRef.current
    if (!element) return

    let rafId: number | null = null

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if scrolled to top
      if (element.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || element.scrollTop > 0) return

      const touchY = e.touches[0].clientY
      const distance = touchY - touchStartY.current

      // Only allow pulling down
      if (distance > 0) {
        // Apply resistance to make it feel natural
        const resistedDistance = distance / resistance
        setPullDistance(resistedDistance)
        setIsPulling(resistedDistance > 10)

        // Only prevent default scrolling if we've pulled enough to engage PTR
        // This allows normal scrolling to work when just touching the top
        if (resistedDistance > 10) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)
        setIsPulling(false)

        try {
          await onRefresh()
        } catch (error) {
          console.error('Refresh failed:', error)
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [onRefresh, threshold, resistance, isRefreshing, pullDistance])

  return {
    scrollableRef,
    isPulling,
    isRefreshing,
    pullDistance,
    isTriggered: pullDistance >= threshold
  }
}
