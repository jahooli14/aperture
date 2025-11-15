/**
 * Haptic feedback utilities for mobile devices
 * Provides tactile confirmation for user actions
 */

export type HapticPattern = 'success' | 'error' | 'warning' | 'selection' | 'impact';

const patterns: Record<HapticPattern, number | number[]> = {
  success: [10, 50, 10], // Short vibration pattern
  error: [50, 100, 50], // Longer pattern for errors
  warning: [30, 50, 30],
  selection: 10, // Quick tap
  impact: 20, // Medium tap
};

/**
 * Trigger haptic feedback if supported by the device
 * @param pattern - Type of haptic feedback to trigger
 */
export function triggerHaptic(pattern: HapticPattern = 'selection'): void {
  // Check if vibration API is supported
  if (!('vibrate' in navigator)) {
    return;
  }

  try {
    const vibrationPattern = patterns[pattern];
    navigator.vibrate(vibrationPattern);
  } catch (error) {
    // Silently fail - haptics are nice-to-have
    console.debug('Haptic feedback not available:', error);
  }
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}
