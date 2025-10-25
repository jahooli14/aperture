/**
 * Offline Indicator Component
 * Shows offline/online status and pending sync count
 */

import { WifiOff, CloudOff, Upload, CheckCircle } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus()
  const { pendingCount, isSyncing } = useOfflineSync()

  // Don't show anything if online and no pending items
  if (isOnline && pendingCount === 0 && !wasOffline) {
    return null
  }

  // Show "Back online" message briefly
  if (wasOffline && isOnline && pendingCount === 0) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Back online</span>
        </div>
      </div>
    )
  }

  // Show offline warning
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            You're offline - captures will sync when reconnected
          </span>
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-600 rounded-full text-xs font-bold">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>
    )
  }

  // Show syncing status
  if (isSyncing && pendingCount > 0) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-lg">
          <Upload className="h-5 w-5 animate-pulse" />
          <span className="font-medium">
            Syncing {pendingCount} {pendingCount === 1 ? 'capture' : 'captures'}...
          </span>
        </div>
      </div>
    )
  }

  // Show pending count when online but not syncing
  if (pendingCount > 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-lg shadow-lg">
          <CloudOff className="h-5 w-5" />
          <span className="font-medium">
            {pendingCount} {pendingCount === 1 ? 'capture' : 'captures'} waiting to sync
          </span>
        </div>
      </div>
    )
  }

  return null
}
