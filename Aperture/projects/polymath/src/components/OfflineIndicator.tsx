/**
 * Offline Indicator Component
 * Shows offline/online status and pending sync count
 */

import { WifiOff, CloudOff, Upload, CheckCircle, X, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useState } from 'react'

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus()
  const { pendingCount, isSyncing, syncPendingCaptures, clearPendingCaptures } = useOfflineSync()
  const [isExpanded, setIsExpanded] = useState(false)

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
    const handleSyncNow = async () => {
      setIsExpanded(false)
      await syncPendingCaptures()
    }

    const handleClear = async () => {
      if (confirm(`Clear all ${pendingCount} pending captures? This cannot be undone.`)) {
        setIsExpanded(false)
        await clearPendingCaptures()
      }
    }

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-neutral-800 text-white rounded-lg shadow-lg overflow-hidden">
          {/* Main notification bar */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 px-4 py-3 w-full hover:bg-neutral-700 transition-colors"
          >
            <CloudOff className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">
              {pendingCount} {pendingCount === 1 ? 'capture' : 'captures'} waiting to sync
            </span>
            <X className="h-4 w-4 ml-auto flex-shrink-0 opacity-60" />
          </button>

          {/* Expanded actions */}
          {isExpanded && (
            <div className="border-t border-neutral-700 p-2 space-y-1">
              <button
                onClick={handleSyncNow}
                disabled={!isOnline}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm font-medium">Sync Now</span>
              </button>
              <button
                onClick={handleClear}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="text-sm font-medium">Clear Queue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
