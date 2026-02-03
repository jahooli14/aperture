/**
 * Accessibility utilities for improved screen reader support and WCAG compliance
 */

/**
 * Generate a unique ID for ARIA labels
 */
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Announce a message to screen readers
 * Uses ARIA live regions to announce dynamic content changes
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Create or get existing live region
  let liveRegion = document.getElementById(`sr-live-${priority}`)

  if (!liveRegion) {
    liveRegion = document.createElement('div')
    liveRegion.id = `sr-live-${priority}`
    liveRegion.setAttribute('role', 'status')
    liveRegion.setAttribute('aria-live', priority)
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.className = 'sr-only'
    // Add sr-only styles inline in case CSS hasn't loaded
    liveRegion.style.position = 'absolute'
    liveRegion.style.width = '1px'
    liveRegion.style.height = '1px'
    liveRegion.style.padding = '0'
    liveRegion.style.margin = '-1px'
    liveRegion.style.overflow = 'hidden'
    liveRegion.style.clip = 'rect(0, 0, 0, 0)'
    liveRegion.style.whiteSpace = 'nowrap'
    liveRegion.style.border = '0'
    document.body.appendChild(liveRegion)
  }

  // Clear and set new message
  liveRegion.textContent = ''
  setTimeout(() => {
    liveRegion!.textContent = message
  }, 100)
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(prefers-contrast: high)').matches ||
    window.matchMedia('(prefers-contrast: more)').matches
  )
}

/**
 * Check if user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Focus trap utility for modals and dialogs
 */
export class FocusTrap {
  private focusableElements: HTMLElement[] = []
  private firstFocusable: HTMLElement | null = null
  private lastFocusable: HTMLElement | null = null
  private previousActiveElement: Element | null = null

  constructor(private container: HTMLElement) {
    this.updateFocusableElements()
  }

  private updateFocusableElements(): void {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ')

    this.focusableElements = Array.from(
      this.container.querySelectorAll<HTMLElement>(selector)
    ).filter(el => {
      // Exclude hidden elements
      return el.offsetParent !== null
    })

    this.firstFocusable = this.focusableElements[0] || null
    this.lastFocusable =
      this.focusableElements[this.focusableElements.length - 1] || null
  }

  activate(): void {
    this.previousActiveElement = document.activeElement
    this.updateFocusableElements()

    if (this.firstFocusable) {
      this.firstFocusable.focus()
    }

    document.addEventListener('keydown', this.handleKeyDown)
  }

  deactivate(): void {
    document.removeEventListener('keydown', this.handleKeyDown)

    if (this.previousActiveElement instanceof HTMLElement) {
      this.previousActiveElement.focus()
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return

    this.updateFocusableElements()

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        event.preventDefault()
        this.lastFocusable?.focus()
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        event.preventDefault()
        this.firstFocusable?.focus()
      }
    }
  }
}

/**
 * Check if element is visible to screen readers
 */
export function isVisibleToScreenReader(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return (
    element.offsetParent !== null &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    element.getAttribute('aria-hidden') !== 'true'
  )
}

/**
 * Get accessible label for an element
 */
export function getAccessibleLabel(element: HTMLElement): string {
  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy)
    if (labelElement) return labelElement.textContent || ''
  }

  // Check associated label
  if (element instanceof HTMLInputElement) {
    const labels = element.labels
    if (labels && labels.length > 0) {
      return labels[0].textContent || ''
    }
  }

  // Check title
  const title = element.getAttribute('title')
  if (title) return title

  // Fallback to text content
  return element.textContent || ''
}

/**
 * Validate touch target size (minimum 44x44px for WCAG AAA)
 */
export function validateTouchTarget(
  element: HTMLElement
): { valid: boolean; width: number; height: number } {
  const MIN_SIZE = 44 // pixels
  const rect = element.getBoundingClientRect()

  return {
    valid: rect.width >= MIN_SIZE && rect.height >= MIN_SIZE,
    width: rect.width,
    height: rect.height
  }
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    // Parse RGB values
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]
    const [r, g, b] = rgb.map(val => {
      const sRGB = val / 255
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast ratio meets WCAG standards
 */
export function meetsWCAGContrast(
  contrast: number,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  if (level === 'AAA') {
    return isLargeText ? contrast >= 4.5 : contrast >= 7
  }
  return isLargeText ? contrast >= 3 : contrast >= 4.5
}
