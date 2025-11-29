/**
 * useShareTarget Hook
 * Robust Share Target handling for Polymath PWA
 * Supports both URL params and localStorage-based share mechanism
 */

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  initShareHandler,
  consumeShareData,
  hasPendingShareData,
  clearShareData
} from '../lib/shareHandler'

interface UseShareTargetOptions {
  onShareReceived: (url: string, title?: string, text?: string) => void | Promise<void>
  checkOnMount?: boolean
  autoCleanup?: boolean
}

export function useShareTarget({
  onShareReceived,
  checkOnMount = true,
  autoCleanup = true
}: UseShareTargetOptions) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Use ref to avoid re-running effect when callback changes
  const callbackRef = useRef(onShareReceived)

  // Track the last processed URL to prevent duplicate processing
  const lastProcessedUrlRef = useRef<string | null>(null)

  // Extensive logging function
  const logShareAttempt = (source: string, shareData: {
    url?: string | null,
    title?: string | null,
    text?: string | null
  }) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      source,
      shareData,
      searchParams: Object.fromEntries(searchParams.entries())
    }

    try {
      const logFileName = `/Users/danielcroome-horgan/Aperture/projects/polymath/logs/share_target_log_${Date.now()}.json`
      const fs = require('fs')
      fs.writeFileSync(logFileName, JSON.stringify(logEntry, null, 2))
      console.log(`[useShareTarget] Extensive log written to ${logFileName}`)
    } catch (logError) {
      console.error('[useShareTarget] Failed to write log file:', logError)
    }

    console.group('[useShareTarget] Share Attempt')
    console.log('Source:', source)
    console.log('Share Data:', shareData)
    console.log('Search Params:', Object.fromEntries(searchParams.entries()))
    console.groupEnd()
  }

  // Initialize share handler on component mount
  useEffect(() => {
    initShareHandler()
  }, [])

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = onShareReceived
  }, [onShareReceived])

  // Process share data from URL params
  const processUrlShareParams = () => {
    const sharedUrl = searchParams.get('url') || searchParams.get('shared')
    const sharedTitle = searchParams.get('title')
    const sharedText = searchParams.get('text')

    logShareAttempt('URL Params', { url: sharedUrl, title: sharedTitle, text: sharedText })

    if (sharedUrl && lastProcessedUrlRef.current !== sharedUrl) {
      console.log('[useShareTarget] Received shared URL from params:', sharedUrl)
      lastProcessedUrlRef.current = sharedUrl

      const result = callbackRef.current(sharedUrl, sharedTitle || undefined, sharedText || undefined)

      // Clean up URL params
      const cleanupParams = () => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('url')
        newParams.delete('shared')
        newParams.delete('title')
        newParams.delete('text')
        setSearchParams(newParams, { replace: true })
      }

      if (result instanceof Promise) {
        result
          .then(() => {
            console.log('[useShareTarget] Successfully processed URL params')
            cleanupParams()
          })
          .catch(error => {
            console.error('[useShareTarget] Error processing URL params:', error)
          })
      } else {
        cleanupParams()
      }
    }
  }

  // Process share data from localStorage
  const processLocalStorageShare = async () => {
    if (hasPendingShareData()) {
      const shareData = consumeShareData()

      if (shareData) {
        logShareAttempt('localStorage', {
          url: shareData.url,
          title: shareData.title,
          text: shareData.text
        })

        console.log('[useShareTarget] Processing stored share data:', shareData.url)

        try {
          const result = callbackRef.current(
            shareData.url,
            shareData.title || undefined,
            shareData.text || undefined
          )

          if (result instanceof Promise) {
            await result
          }

          // Optionally auto-cleanup
          if (autoCleanup) {
            clearShareData()
          }
        } catch (error) {
          console.error('[useShareTarget] Error processing stored share data:', error)
        }
      } else {
        console.log('[useShareTarget] No pending share data found in localStorage')
      }
    } else {
      console.log('[useShareTarget] No pending share data detected')
    }
  }

  // Check for shares on mount and when component updates
  useEffect(() => {
    if (checkOnMount) {
      console.log('[useShareTarget] Checking for shares on mount')
      // Process URL params first
      processUrlShareParams()

      // Then process localStorage share
      processLocalStorageShare()
    }
  }, [searchParams])

  // Return utility functions if needed
  return {
    processUrlShareParams,
    processLocalStorageShare
  }
}
