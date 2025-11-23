/**
 * useSwipeGesture - Detects swipe gestures for opening context sidebar
 */

import { useEffect, useRef } from 'react'

interface UseSwipeGestureOptions {
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void
  /** Minimum distance to trigger swipe (px) */
  threshold?: number
  /** Maximum vertical movement allowed (px) */
  maxVertical?: number
  /** Whether gesture is enabled */
  enabled?: boolean
}

export function useSwipeGesture(options: UseSwipeGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    maxVertical = 100,
    enabled = true
  } = options

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y

      // Check if it's a horizontal swipe (not vertical scroll)
      if (Math.abs(deltaY) > maxVertical) {
        touchStartRef.current = null
        return
      }

      if (deltaX < -threshold && onSwipeLeft) {
        onSwipeLeft()
      } else if (deltaX > threshold && onSwipeRight) {
        onSwipeRight()
      }

      touchStartRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, onSwipeLeft, onSwipeRight, threshold, maxVertical])
}
