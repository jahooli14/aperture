/**
 * useShareTarget Hook
 * Handles Web Share Target API integration for PWA
 * Detects when a link is shared to the app and processes it
 */

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

interface UseShareTargetOptions {
  onShareReceived: (url: string, title?: string, text?: string) => void | Promise<void>
}

export function useShareTarget({ onShareReceived }: UseShareTargetOptions) {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    // Check if we have shared content via URL params
    const sharedUrl = searchParams.get('url')
    const sharedTitle = searchParams.get('title')
    const sharedText = searchParams.get('text')

    if (sharedUrl) {
      console.log('[useShareTarget] Received shared URL:', sharedUrl)

      // Call the handler
      const result = onShareReceived(sharedUrl, sharedTitle || undefined, sharedText || undefined)

      // Handle async callbacks
      if (result instanceof Promise) {
        result.catch(error => {
          console.error('[useShareTarget] Error processing shared URL:', error)
        })
      }

      // Clean up the URL params after processing
      // This prevents re-processing on subsequent renders
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('url')
      newParams.delete('title')
      newParams.delete('text')

      // Update URL without reloading the page
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, setSearchParams, onShareReceived])
}
