/**
 * useShareTarget Hook
 * Handles Web Share Target API integration for PWA
 * Detects when a link is shared to the app and processes it
 */

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

interface UseShareTargetOptions {
  onShareReceived: (url: string, title?: string, text?: string) => void | Promise<void>
}

export function useShareTarget({ onShareReceived }: UseShareTargetOptions) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Use ref to avoid re-running effect when callback changes
  const callbackRef = useRef(onShareReceived)

  // Track the last processed URL to prevent duplicate processing
  const lastProcessedUrlRef = useRef<string | null>(null)

  // Keep ref up to date
  useEffect(() => {
    callbackRef.current = onShareReceived
  }, [onShareReceived])

  useEffect(() => {
    // Check if we have shared content via URL params
    const sharedUrl = searchParams.get('url')
    const sharedTitle = searchParams.get('title')
    const sharedText = searchParams.get('text')

    // Only process if we have a URL and haven't processed this exact URL yet
    if (sharedUrl && lastProcessedUrlRef.current !== sharedUrl) {
      console.log('[useShareTarget] Received shared URL:', sharedUrl)
      lastProcessedUrlRef.current = sharedUrl

      // Call the handler
      const result = callbackRef.current(sharedUrl, sharedTitle || undefined, sharedText || undefined)

      // Handle async callbacks and clean up after completion
      if (result instanceof Promise) {
        result
          .then(() => {
            console.log('[useShareTarget] Successfully processed shared URL')
          })
          .catch(error => {
            console.error('[useShareTarget] Error processing shared URL:', error)
          })
          .finally(() => {
            // Clean up URL params after processing completes
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('url')
            newParams.delete('title')
            newParams.delete('text')
            setSearchParams(newParams, { replace: true })
          })
      } else {
        // Synchronous callback - clean up immediately
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('url')
        newParams.delete('title')
        newParams.delete('text')
        setSearchParams(newParams, { replace: true })
      }
    }
  }, [searchParams, setSearchParams])
}
