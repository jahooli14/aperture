/**
 * Share Handler
 * Robust, cross-platform share link handling for Polymath PWA
 *
 * Key Improvements:
 * - Uses localStorage for persistent storage
 * - Supports multiple share sources (web, native)
 * - Improved error handling and logging
 * - Extended data retention
 */

export interface ShareData {
  url: string
  title?: string
  text?: string
  timestamp: number
  source: 'web' | 'native'
  processed: boolean
}

const SHARE_DATA_KEY = 'polymath_share_data'
const MAX_SHARE_AGE = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Utility to validate if a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(str: string | null): boolean {
  if (!str) return false
  try {
    const url = new URL(str)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Sanitize and validate shared URL with enhanced security
 */
function sanitizeUrl(url: string): string {
  try {
    // Decode URL to handle encoded characters
    const decodedUrl = decodeURIComponent(url.trim())

    // Create URL object
    const cleanUrl = new URL(decodedUrl)

    // Whitelist allowed protocols
    const allowedProtocols = ['http:', 'https:']
    if (!allowedProtocols.includes(cleanUrl.protocol)) {
      throw new Error('Unsupported protocol')
    }

    // Remove tracking and potentially malicious parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'wickedSource', 'wickedid', 'wtrid'
    ]

    const filteredSearchParams = new URLSearchParams()
    for (const [key, value] of cleanUrl.searchParams) {
      if (!trackingParams.includes(key)) {
        filteredSearchParams.append(key, value)
      }
    }

    // Reconstruct URL with filtered parameters
    cleanUrl.search = filteredSearchParams.toString()
    cleanUrl.hash = ''  // Remove hash fragments

    // Additional security: limit URL length
    const maxUrlLength = 2048
    const sanitizedUrl = cleanUrl.toString()
    return sanitizedUrl.length > maxUrlLength
      ? sanitizedUrl.substring(0, maxUrlLength)
      : sanitizedUrl
  } catch (error) {
    console.warn('[ShareHandler] URL sanitization error:', error)
    return '' // Return empty string for invalid URLs
  }
}

/**
 * Advanced URL validation with additional checks
 */
function isValidUrl(str: string | null): boolean {
  if (!str) return false

  try {
    const url = new URL(str)

    // Strict protocol check
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    // Optional: Additional domain validation
    const validDomainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!validDomainRegex.test(url.hostname)) {
      return false
    }

    // Optional length checks
    return url.toString().length <= 2048
  } catch {
    return false
  }
}

/**
 * Initialize share handler - captures share target params
 */
export function initShareHandler() {
  // Performance and environment tracking
  const startTime = performance.now()

  // Only run on client side
  if (typeof window === 'undefined') {
    console.warn('[ShareHandler] Not running on client side')
    return
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const textParam = params.get('text')
    const urlParam = params.get('url')
    const titleParam = params.get('title')

    // Detailed logging of input parameters
    console.group('[ShareHandler] Input Parameters')
    console.log('Text Param:', textParam)
    console.log('URL Param:', urlParam)
    console.log('Title Param:', titleParam)
    console.groupEnd()

    // Prioritize URL detection: text param (Android) → url param
    let sharedUrl: string | null = null

    if (isValidUrl(textParam)) {
      sharedUrl = sanitizeUrl(textParam)
      console.log('[ShareHandler] URL sourced from text parameter')
    } else if (isValidUrl(urlParam)) {
      sharedUrl = sanitizeUrl(urlParam)
      console.log('[ShareHandler] URL sourced from URL parameter')
    }

    if (sharedUrl) {
      const shareData: ShareData = {
        url: sharedUrl,
        title: titleParam || undefined,
        text: textParam || undefined,
        timestamp: Date.now(),
        source: 'web',
        processed: false
      }

      try {
        // Store in localStorage for persistent, cross-session storage
        localStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))

        // Enhanced logging with performance metrics
        const endTime = performance.now()
        console.group('[ShareHandler] Share Link Stored')
        console.log('URL:', shareData.url)
        console.log('Processing Time:', (endTime - startTime).toFixed(2), 'ms')
        console.log('Storage Mechanism: localStorage')
        console.groupEnd()
      } catch (error) {
        // Comprehensive error logging
        console.group('[ShareHandler] Storage Error')
        console.error('Failed to store share data:', error)
        console.log('Available localStorage space:',
          typeof navigator !== 'undefined' ?
          navigator.storage?.estimate() :
          'Unable to estimate'
        )
        console.groupEnd()

        // Optional: Fallback mechanism or error reporting
        if (typeof window !== 'undefined' && window.navigator && window.navigator.sendBeacon) {
          const errorData = new FormData()
          errorData.append('error', 'Share Link Storage Failed')
          errorData.append('url', sharedUrl)
          window.navigator.sendBeacon('/api/log-error', errorData)
        }
      }
    } else {
      console.warn('[ShareHandler] No valid URL found in share parameters')
    }
  } catch (unexpectedError) {
    console.error('[ShareHandler] Unexpected error during initialization:', unexpectedError)
  }
}

/**
 * Get and consume share data
 * @param markAsProcessed Whether to mark the share data as processed
 */
export function consumeShareData(markAsProcessed = true): ShareData | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem(SHARE_DATA_KEY)
  if (!stored) return null

  try {
    const shareData = JSON.parse(stored) as ShareData

    // Check data age (24-hour retention)
    const age = Date.now() - shareData.timestamp
    if (age > MAX_SHARE_AGE) {
      localStorage.removeItem(SHARE_DATA_KEY)
      return null
    }

    // Optionally mark as processed to prevent duplicate handling
    if (markAsProcessed && !shareData.processed) {
      shareData.processed = true
      localStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))
    }

    return shareData
  } catch (error) {
    console.error('[ShareHandler] Failed to parse share data:', error)
    localStorage.removeItem(SHARE_DATA_KEY)
    return null
  }
}

/**
 * Clear stored share data
 */
export function clearShareData() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SHARE_DATA_KEY)
}

/**
 * Check if we have pending, unprocessed share data
 */
export function hasPendingShareData(): boolean {
  if (typeof window === 'undefined') return false

  const stored = localStorage.getItem(SHARE_DATA_KEY)
  if (!stored) return false

  try {
    const shareData = JSON.parse(stored) as ShareData
    const age = Date.now() - shareData.timestamp
    return age <= MAX_SHARE_AGE && !shareData.processed
  } catch {
    return false
  }
}

/**
 * Add a new share link programmatically
 */
export function addShareLink(url: string, title?: string, text?: string) {
  if (typeof window === 'undefined') return

  const shareData: ShareData = {
    url: sanitizeUrl(url),
    title,
    text,
    timestamp: Date.now(),
    source: 'native', // For links added programmatically
    processed: false
  }

  try {
    localStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))
  } catch (error) {
    console.error('[ShareHandler] Failed to add share link:', error)
  }
}
