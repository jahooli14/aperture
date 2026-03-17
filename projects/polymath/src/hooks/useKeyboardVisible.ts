import { useState, useEffect } from 'react'

/**
 * Detects whether a software keyboard is currently visible on mobile.
 * Uses the visualViewport API to compare viewport height to window height —
 * a significant shrink indicates the keyboard has opened.
 */
export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const KEYBOARD_THRESHOLD = 0.75 // keyboard is open if visual viewport < 75% of window height

    const handleResize = () => {
      const ratio = vv.height / window.innerHeight
      setIsKeyboardVisible(ratio < KEYBOARD_THRESHOLD)
    }

    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  return isKeyboardVisible
}
