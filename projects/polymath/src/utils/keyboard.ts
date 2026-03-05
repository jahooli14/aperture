/**
 * Keyboard utilities for mobile input handling
 * Prevents keyboard from hiding input fields on mobile devices
 */

/**
 * Scrolls an input element into view when focused on mobile.
 * Uses scrollIntoView on the nearest scrolling ancestor, which works correctly
 * both inside modals/bottom sheets and on the main page.
 */
export function handleInputFocus(event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  // Small delay to let the keyboard begin animating before we scroll
  setTimeout(() => {
    event.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, 300)
}

/** Alias for backwards compatibility */
export const scrollInputIntoView = handleInputFocus
