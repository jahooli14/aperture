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
  console.log('='.repeat(80))
  console.log('[ShareHandler] INIT START')

  // Only run on client side
  if (typeof window === 'undefined') {
    console.log('[ShareHandler] Running on server side, skipping')
    return
  }

  console.log('[ShareHandler] window.location.href:', window.location.href)
  console.log('[ShareHandler] window.location.search:', window.location.search)
  console.log('[ShareHandler] window.location.pathname:', window.location.pathname)

  const params = new URLSearchParams(window.location.search)
  const textParam = params.get('text')
  const urlParam = params.get('url')
  const titleParam = params.get('title')

  console.log('[ShareHandler] All URL params:', Array.from(params.entries()))

  // Android behavior: URL is in 'text' parameter, not 'url'
  // Spec-compliant behavior: URL is in 'url' parameter
  // Solution: Check both, prioritize 'text'
  let sharedUrl: string | null = null

  console.log('[ShareHandler] Validating text param:', textParam, '-> valid?', isValidUrl(textParam))
  console.log('[ShareHandler] Validating url param:', urlParam, '-> valid?', isValidUrl(urlParam))

  if (isValidUrl(textParam)) {
    sharedUrl = textParam
    console.log('[ShareHandler] ✓ Found URL in text parameter (Android behavior):', sharedUrl)
  } else if (isValidUrl(urlParam)) {
    sharedUrl = urlParam
    console.log('[ShareHandler] ✓ Found URL in url parameter (spec-compliant):', sharedUrl)
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
    try {
      sessionStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))
      console.log('[ShareHandler] ✓ Share data stored in sessionStorage:', shareData)

      // Verify storage worked
      const stored = sessionStorage.getItem(SHARE_DATA_KEY)
      console.log('[ShareHandler] Verification - stored data:', stored)
    } catch (error) {
      console.error('[ShareHandler] ❌ Failed to store in sessionStorage:', error)
    }
  } else if (textParam || urlParam) {
    // Log for debugging if we got params but couldn't find a valid URL
    console.warn('[ShareHandler] ⚠️ Received share params but no valid URL found:', { textParam, urlParam, titleParam })
  } else {
    console.log('[ShareHandler] No share params found in URL')
  }

  console.log('[ShareHandler] INIT END')
  console.log('='.repeat(80))
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
