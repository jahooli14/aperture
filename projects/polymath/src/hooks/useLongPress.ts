/**
 * useLongPress Hook
 * Detects long-press gestures for context menus on mobile/touch devices
 */

import { useCallback, useRef, useState } from 'react'
import { haptic } from '../utils/haptics'

interface LongPressOptions {
  threshold?: number // milliseconds to hold before triggering
  onStart?: () => void
  onFinish?: () => void
  onCancel?: () => void
}

export function useLongPress(
  callback: () => void,
  options: LongPressOptions = {}
) {
  const { threshold = 500, onStart, onFinish, onCancel } = options
  const [longPressTriggered, setLongPressTriggered] = useState(false)
  const timeout = useRef<NodeJS.Timeout>()
  const target = useRef<EventTarget>()

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      // Prevent triggering on buttons/inputs
      const targetElement = event.target as HTMLElement
      if (targetElement.closest('button, input, textarea, a')) {
        return
      }

      onStart?.()
      target.current = event.target

      timeout.current = setTimeout(() => {
        haptic.medium()
        callback()
        setLongPressTriggered(true)
        onFinish?.()
      }, threshold)
    },
    [callback, threshold, onStart, onFinish]
  )

  const clear = useCallback(
    (event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current)
      if (longPressTriggered && !shouldTriggerClick) {
        event.preventDefault()
        event.stopPropagation()
      }
      if (!longPressTriggered) {
        onCancel?.()
      }
      setLongPressTriggered(false)
      target.current = undefined
    },
    [longPressTriggered, onCancel]
  )

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  }
}
