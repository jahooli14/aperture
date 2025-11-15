/**
 * Hook to detect online/offline status
 */

import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    function handleOnline() {
      console.log('🟢 Back online')
      setIsOnline(true)
      setWasOffline(true)
      // Reset wasOffline after 3 seconds
      setTimeout(() => setWasOffline(false), 3000)
    }

    function handleOffline() {
      console.log('🔴 Offline')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}
