/**
 * Share Handler
 * Captures Web Share Target params before React Router processing
 * and stores them for the ReadingPage to consume
 *
 * CRITICAL: Android browsers put the shared URL in the 'text' parameter,
 * not the 'url' parameter. This handler checks both with correct priority.
 */

export interface ShareData {
  url: string
  title?: string
  text?: string
  timestamp: number
}

const SHARE_DATA_KEY = 'polymath_share_data'

/**
 * Utility to validate if a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(str: string | null): boolean {
  if (!str) return false
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Initialize share handler - call this BEFORE React Router initializes
 * This captures share target params from the URL and stores them
 */
export function initShareHandler() {
  // Only run on client side
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  const textParam = params.get('text')
  const urlParam = params.get('url')
  const titleParam = params.get('title')

  // Android behavior: URL is in 'text' parameter, not 'url'
  // Spec-compliant behavior: URL is in 'url' parameter
  // Solution: Check both, prioritize 'text'
  let sharedUrl: string | null = null

  if (isValidUrl(textParam)) {
    sharedUrl = textParam
    console.log('[ShareHandler] Found URL in text parameter (Android behavior):', sharedUrl)
  } else if (isValidUrl(urlParam)) {
    sharedUrl = urlParam
    console.log('[ShareHandler] Found URL in url parameter (spec-compliant):', sharedUrl)
  }

  if (sharedUrl) {
    console.log('[ShareHandler] Detected share target URL:', sharedUrl)

    const shareData: ShareData = {
      url: sharedUrl,
      title: titleParam || undefined,
      text: textParam || undefined,
      timestamp: Date.now()
    }

    // Store in sessionStorage (survives navigation but not tab close)
    sessionStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))
    console.log('[ShareHandler] Share data stored in sessionStorage')
  } else if (textParam || urlParam) {
    // Log for debugging if we got params but couldn't find a valid URL
    console.warn('[ShareHandler] Received share params but no valid URL found:', { textParam, urlParam, titleParam })
  }
}

/**
 * Get and consume share data (removes it after reading)
 */
export function consumeShareData(): ShareData | null {
  if (typeof window === 'undefined') return null

  const stored = sessionStorage.getItem(SHARE_DATA_KEY)
  if (!stored) return null

  try {
    const shareData = JSON.parse(stored) as ShareData

    // Only return if less than 10 seconds old (prevents stale data)
    const age = Date.now() - shareData.timestamp
    if (age < 10000) {
      // Remove after consuming to prevent duplicate processing
      sessionStorage.removeItem(SHARE_DATA_KEY)
      console.log('[ShareHandler] Share data consumed:', shareData.url)
      return shareData
    } else {
      // Too old, remove it
      sessionStorage.removeItem(SHARE_DATA_KEY)
      console.log('[ShareHandler] Share data expired (age:', age, 'ms)')
      return null
    }
  } catch (error) {
    console.error('[ShareHandler] Failed to parse share data:', error)
    sessionStorage.removeItem(SHARE_DATA_KEY)
    return null
  }
}

/**
 * Check if we have pending share data (without consuming it)
 */
export function hasShareData(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SHARE_DATA_KEY) !== null
}
