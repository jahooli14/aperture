/**
 * Swipeable Card Component
 * Android-style swipe-to-delete with left/right actions
 */

import { ReactNode, useRef, useState, useEffect } from 'react'
import { Trash2, Archive } from 'lucide-react'
import { cn } from '../lib/utils'

interface SwipeAction {
  icon: ReactNode
  color: string
  label: string
  threshold?: number
  onAction: () => void
}

interface SwipeableCardProps {
  children: ReactNode
  leftAction?: SwipeAction
  rightAction?: SwipeAction
  className?: string
  disabled?: boolean
}

export function SwipeableCard({
  children,
  leftAction,
  rightAction,
  className,
  disabled = false
}: SwipeableCardProps) {
  const [swipeDistance, setSwipeDistance] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isActing, setIsActing] = useState(false)

  const touchStartX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const defaultThreshold = 100 // pixels to swipe to trigger action

  useEffect(() => {
    const element = cardRef.current
    if (!element || disabled) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      setIsSwiping(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping) return

      const currentX = e.touches[0].clientX
      const distance = currentX - touchStartX.current

      // Only allow swipe if there's an action defined for that direction
      if (distance < 0 && !rightAction) return
      if (distance > 0 && !leftAction) return

      setSwipeDistance(distance)
    }

    const handleTouchEnd = async () => {
      if (!isSwiping) return
      setIsSwiping(false)

      const absDistance = Math.abs(swipeDistance)
      const isLeft = swipeDistance > 0
      const action = isLeft ? leftAction : rightAction
      const threshold = action?.threshold || defaultThreshold

      if (absDistance >= threshold && action) {
        setIsActing(true)

        // Animate to full swipe
        setSwipeDistance(isLeft ? 300 : -300)

        // Wait for animation, then execute action
        setTimeout(async () => {
          await action.onAction()
          setSwipeDistance(0)
          setIsActing(false)
        }, 200)
      } else {
        // Return to center
        setSwipeDistance(0)
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isSwiping, swipeDistance, leftAction, rightAction, disabled])

  const swipeProgress = Math.min(Math.abs(swipeDistance) / (leftAction?.threshold || rightAction?.threshold || defaultThreshold), 1)
  const isTriggered = swipeProgress >= 1

  return (
    <div className={cn('relative overflow-hidden', className)} ref={cardRef}>
      {/* Left Action Background */}
      {leftAction && swipeDistance > 0 && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start px-6 transition-colors',
            leftAction.color
          )}
          style={{ width: `${Math.min(swipeDistance, 300)}px` }}
        >
          <div className={cn(
            'flex flex-col items-center gap-1 transition-all duration-200',
            isTriggered && 'scale-125'
          )}>
            {leftAction.icon}
            <span className="text-xs font-medium">{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Right Action Background */}
      {rightAction && swipeDistance < 0 && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end px-6 transition-colors',
            rightAction.color
          )}
          style={{ width: `${Math.min(Math.abs(swipeDistance), 300)}px` }}
        >
          <div className={cn(
            'flex flex-col items-center gap-1 transition-all duration-200',
            isTriggered && 'scale-125'
          )}>
            {rightAction.icon}
            <span className="text-xs font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Card Content */}
      <div
        className={cn(
          'relative transition-transform',
          isActing ? 'duration-200' : 'duration-100',
          disabled && 'pointer-events-none opacity-50'
        )}
        style={{
          transform: `translateX(${swipeDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Common swipe actions for reuse
export const SwipeActions = {
  delete: (onDelete: () => void): SwipeAction => ({
    icon: <Trash2 className="h-5 w-5 text-white" />,
    color: 'bg-red-600',
    label: 'Delete',
    threshold: 100,
    onAction: onDelete
  }),
  archive: (onArchive: () => void): SwipeAction => ({
    icon: <Archive className="h-5 w-5 text-white" />,
    color: 'bg-amber-600',
    label: 'Archive',
    threshold: 100,
    onAction: onArchive
  })
}
