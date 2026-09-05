/**
 * Hook to detect online/offline status
 */

import { useState, useEffect } from 'react'
import { onNetworkChange } from '../lib/network'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const unsubscribe = onNetworkChange((online) => {
      if (online) {
        console.log(' Back online')
        setIsOnline(true)
        setWasOffline(true)
        // Reset wasOffline after 3 seconds
        setTimeout(() => setWasOffline(false), 3000)
      } else {
        console.log(' Offline')
        setIsOnline(false)
      }
    })

    return unsubscribe
  }, [])

  return { isOnline, wasOffline }
}
