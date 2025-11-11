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

  // Keep ref up to date
  useEffect(() => {
    callbackRef.current = onShareReceived
  }, [onShareReceived])

  useEffect(() => {
    // Check if we have shared content via URL params
    const sharedUrl = searchParams.get('url')
    const sharedTitle = searchParams.get('title')
    const sharedText = searchParams.get('text')

    if (sharedUrl) {
      console.log('[useShareTarget] Received shared URL:', sharedUrl)

      // Clean up the URL params FIRST to prevent re-processing
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('url')
      newParams.delete('title')
      newParams.delete('text')
      setSearchParams(newParams, { replace: true })

      // Then call the handler with the stored values
      const result = callbackRef.current(sharedUrl, sharedTitle || undefined, sharedText || undefined)

      // Handle async callbacks
      if (result instanceof Promise) {
        result.catch(error => {
          console.error('[useShareTarget] Error processing shared URL:', error)
        })
      }
    }
  }, [searchParams, setSearchParams])
}
