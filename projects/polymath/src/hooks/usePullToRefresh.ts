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

  // Use refs for values read inside handlers so the effect doesn't
  // re-register listeners on every state change (was causing listener
  // churn on every touchmove frame)
  const pullDistanceRef = useRef(0)
  const isRefreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  // Keep refs in sync
  pullDistanceRef.current = pullDistance
  isRefreshingRef.current = isRefreshing
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const element = scrollableRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (element.scrollTop === 0 && touch) {
        touchStartY.current = touch.clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current || element.scrollTop > 0) return

      const touch = e.touches[0]
      if (!touch) return
      const touchY = touch.clientY
      const distance = touchY - touchStartY.current

      if (distance > 0) {
        const resistedDistance = distance / resistance
        setPullDistance(resistedDistance)
        pullDistanceRef.current = resistedDistance
        setIsPulling(resistedDistance > 10)

        if (resistedDistance > 10) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistanceRef.current >= threshold && !isRefreshingRef.current) {
        setIsRefreshing(true)
        isRefreshingRef.current = true
        setIsPulling(false)

        try {
          await onRefreshRef.current()
        } catch (error) {
          console.error('Refresh failed:', error)
        } finally {
          setIsRefreshing(false)
          isRefreshingRef.current = false
          setPullDistance(0)
          pullDistanceRef.current = 0
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
        pullDistanceRef.current = 0
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [threshold, resistance]) // Stable deps only  no more listener churn

  return {
    scrollableRef,
    isPulling,
    isRefreshing,
    pullDistance,
    isTriggered: pullDistance >= threshold
  }
}
