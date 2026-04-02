/**
 * useShareTarget Hook
 * Robust Share Target handling for Rosette PWA
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

  const logShareAttempt = (source: string, shareData: {
    url?: string | null,
    title?: string | null,
    text?: string | null
  }) => {
    console.log('[useShareTarget] Share attempt:', source, shareData)
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
