/**
 * Hook to manage offline sync
 * Syncs pending captures when back online
 */

import { useState, useEffect } from 'react'
import { db } from '../lib/db'
import { useOnlineStatus } from './useOnlineStatus'

export function useOfflineSync() {
  const { isOnline, wasOffline } = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)

  // Update pending count on mount and when online status changes
  useEffect(() => {
    updatePendingCount()
  }, [isOnline])

  // Sync when coming back online
  useEffect(() => {
    if (wasOffline && isOnline) {
      syncPendingCaptures()
    }
  }, [wasOffline, isOnline])

  async function updatePendingCount() {
    try {
      const count = await db.getPendingCaptureCount()
      setPendingCount(count)
    } catch (error) {
      console.error('Failed to get pending count:', error)
    }
  }

  async function syncPendingCaptures() {
    if (!isOnline || isSyncing) return

    setIsSyncing(true)
    setLastSyncError(null)

    try {
      const pending = await db.getPendingCaptures()
      console.log(`Syncing ${pending.length} pending captures...`)

      let successCount = 0
      let failCount = 0

      for (const capture of pending) {
        try {
          const response = await fetch('/api/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              transcript: capture.transcript,
              created_at: new Date(capture.timestamp).toISOString()
            })
          })

          if (response.ok) {
            await db.deletePendingCapture(capture.id!)
            successCount++
            console.log(`✓ Synced capture ${capture.id}`)
          } else {
            failCount++
            console.error(`✗ Failed to sync capture ${capture.id}:`, response.status)
          }
        } catch (error) {
          failCount++
          console.error(`✗ Failed to sync capture ${capture.id}:`, error)
        }
      }

      console.log(`Sync complete: ${successCount} success, ${failCount} failed`)

      if (failCount > 0) {
        setLastSyncError(`${failCount} captures failed to sync`)
      }

      await updatePendingCount()

      // Register background sync for remaining items
      if (failCount > 0 && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready
          // @ts-ignore - Background Sync API not in TypeScript types yet
          if ('sync' in registration) {
            // @ts-ignore
            await registration.sync.register('sync-captures')
          }
        } catch (error) {
          console.warn('Background sync not supported:', error)
        }
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setLastSyncError(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  async function addOfflineCapture(transcript: string) {
    try {
      await db.addPendingCapture(transcript)
      await updatePendingCount()
      console.log('✓ Capture queued for offline sync')

      // If online, try to sync immediately
      if (isOnline) {
        syncPendingCaptures()
      }
    } catch (error) {
      console.error('Failed to queue capture:', error)
      throw error
    }
  }

  return {
    pendingCount,
    isSyncing,
    lastSyncError,
    addOfflineCapture,
    syncPendingCaptures
  }
}
