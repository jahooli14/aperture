// YYYY Mask Mode - replaces protagonist's real name throughout the editor

const MASK_PLACEHOLDER = 'YYYY'

export function applyMask(text: string, realName: string, enabled: boolean): string {
  if (!enabled || !realName) {
    return text
  }

  // Create regex for case-insensitive replacement
  const namePattern = new RegExp(escapeRegExp(realName), 'gi')
  return text.replace(namePattern, MASK_PLACEHOLDER)
}

export function removeMask(text: string, realName: string): string {
  if (!realName) {
    return text
  }

  // Replace YYYY back with the real name, preserving case of first occurrence
  return text.replace(/YYYY/g, realName)
}

// Get display text based on mask mode
export function getDisplayText(text: string, realName: string, maskEnabled: boolean): string {
  return applyMask(text, realName, maskEnabled)
}

// Get storage text (always unmask for storage)
export function getStorageText(text: string, realName: string, maskEnabled: boolean): string {
  if (!maskEnabled) {
    return text
  }
  return removeMask(text, realName)
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Check if text contains the protagonist's name
export function containsProtagonistName(text: string, realName: string): boolean {
  if (!realName) return false
  const pattern = new RegExp(escapeRegExp(realName), 'i')
  return pattern.test(text)
}
