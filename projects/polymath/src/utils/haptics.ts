/**
 * Haptic Feedback Utility
 * Provides tactile feedback for user interactions
 *
 * Usage:
 * import { haptic } from '@/utils/haptics'
 *
 * haptic.light()   // Subtle feedback (selections, hovers)
 * haptic.medium()  // Standard feedback (button presses)
 * haptic.heavy()   // Strong feedback (confirmations, completions)
 * haptic.success() // Success pattern
 * haptic.warning() // Warning pattern
 * haptic.error()   // Error pattern
 */

export const haptic = {
  /**
   * Light haptic feedback - 10ms
   * Use for: subtle selections, hover states, micro-interactions
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
  },

  /**
   * Medium haptic feedback - 20ms
   * Use for: button presses, toggles, standard interactions
   */
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20)
    }
  },

  /**
   * Heavy haptic feedback - 50ms
   * Use for: confirmations, completions, important actions
   */
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50)
    }
  },

  /**
   * Success pattern - double pulse
   * Use for: successful saves, completions, achievements
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 50, 30])
    }
  },

  /**
   * Warning pattern - triple quick pulse
   * Use for: warnings, cautions, reversible deletions
   */
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 30, 15, 30, 15])
    }
  },

  /**
   * Error pattern - strong single pulse
   * Use for: errors, failures, destructive actions
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100])
    }
  },

  /**
   * Tap pattern - ultra-light
   * Use for: card taps, navigation, browsing
   */
  tap: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(5)
    }
  },

  /**
   * Swipe pattern - quick burst
   * Use for: swipe gestures, card dismissals
   */
  swipe: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15)
    }
  },
}

/**
 * Check if haptics are supported on this device
 */
export const isHapticsSupported = (): boolean => {
  return 'vibrate' in navigator
}

/**
 * Haptic-enabled button click handler
 * Wraps a click handler with haptic feedback
 */
export const withHaptic = <T extends (...args: any[]) => any>(
  handler: T,
  intensity: 'light' | 'medium' | 'heavy' = 'medium'
): T => {
  return ((...args: any[]) => {
    haptic[intensity]()
    return handler(...args)
  }) as T
}
