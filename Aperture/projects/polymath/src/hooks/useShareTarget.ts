/**
 * Share Target Hook
 * Handles incoming shared URLs from Android Share Sheet
 */

import { useEffect } from 'react'
import { App as CapacitorApp, URLOpenListenerEvent } from '@capacitor/app'
import { isNative } from '../lib/platform'

interface UseShareTargetOptions {
  onShareReceived: (url: string) => void
}

export function useShareTarget({ onShareReceived }: UseShareTargetOptions) {
  useEffect(() => {
    if (!isNative()) return

    let listenerHandle: any

    const setupListener = async () => {
      // Listen for app URL opens (including share intents)
      listenerHandle = await CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        try {
          const url = new URL(event.url)

          // Check if this is a share intent
          // Format: app-scheme://share?url=https://...
          if (url.pathname.includes('/share') || url.searchParams.has('url')) {
            const sharedUrl = url.searchParams.get('url')
            if (sharedUrl) {
              console.log('Received shared URL:', sharedUrl)
              onShareReceived(decodeURIComponent(sharedUrl))
            }
          }
        } catch (error) {
          console.error('Error handling share intent:', error)
        }
      })
    }

    setupListener()

    return () => {
      if (listenerHandle) {
        listenerHandle.remove()
      }
    }
  }, [onShareReceived])
}
