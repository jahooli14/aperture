/**
 * Keyboard utilities for mobile input handling
 * Prevents keyboard from hiding input fields on mobile devices
 */

/**
 * Scrolls an input element into view when focused, with extra padding for mobile keyboards
 * This prevents the keyboard from covering the input on mobile devices
 */
export function handleInputFocus(event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  // Small delay to let the keyboard animation start
  setTimeout(() => {
    const element = event.target

    // Calculate the position to scroll to
    // We want the input to be in the upper half of the screen to account for keyboard
    const elementRect = element.getBoundingClientRect()
    const absoluteElementTop = elementRect.top + window.pageYOffset

    // Scroll to position that puts the input in upper third of viewport
    const targetScrollY = absoluteElementTop - (window.innerHeight / 3)

    window.scrollTo({
      top: Math.max(0, targetScrollY),
      behavior: 'smooth'
    })

    // Also try scrollIntoView as a fallback/additional measure
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    })
  }, 300) // 300ms delay for keyboard animation
}

/**
 * Hook-like function to add to input/textarea onFocus handlers
 * Usage: onFocus={handleInputFocus}
 */
export const scrollInputIntoView = handleInputFocus
