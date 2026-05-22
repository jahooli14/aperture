/**
 * Offline Indicator Component
 * Shows offline/online status and pending sync count
 */

import { WifiOff, CloudOff, Upload, CheckCircle, X, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useOfflineStore } from '../stores/useOfflineStore'
import { syncPendingOperations } from '../lib/syncManager'
import { clearQueue } from '../lib/offlineQueue'
import { useConfirmDialog } from './ui/confirm-dialog'

export function OfflineIndicator() {
  const { isOnline, isSyncing, isPulling, queueSize, lastSyncTime, setSyncing, updateQueueSize, setSyncResult } = useOfflineStore()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const [isExpanded, setIsExpanded] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  // Track when we come back online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline && queueSize === 0) {
      // Show "Back online" briefly then hide
      const timer = setTimeout(() => setWasOffline(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, queueSize, wasOffline])

  // Don't show anything if online and no pending items and not pulling
  if (isOnline && queueSize === 0 && !wasOffline && !isPulling) {
    return null
  }

  // Pulling status — a single quiet pulsing dot tucked into the top-right
  // corner. No chip, no label: it shouldn't compete with the masthead.
  if (isPulling && isOnline) {
    return (
      <div
        className="fixed z-40 pointer-events-none"
        style={{
          top: 'calc(env(safe-area-inset-top) + 14px)',
          right: '14px',
        }}
        role="status"
        aria-label="Syncing"
      >
        <div
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{
            background: 'rgba(var(--brand-primary-rgb), 0.55)',
            boxShadow: '0 0 6px rgba(var(--brand-primary-rgb), 0.4)',
          }}
        />
      </div>
    )
  }

  // Show "Back online" message briefly
  if (wasOffline && isOnline && queueSize === 0) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
        <div className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-[var(--brand-text-primary)] rounded-lg shadow-lg">
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
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-[var(--brand-text-primary)]">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            You're offline - changes will sync when reconnected
          </span>
          {queueSize > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-brand-primary rounded-full text-xs font-bold">
              {queueSize} pending
            </span>
          )}
        </div>
      </div>
    )
  }

  // Show syncing status
  if (isSyncing && queueSize > 0) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
        <div className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-[var(--brand-text-primary)] rounded-lg shadow-lg">
          <Upload className="h-5 w-5 animate-pulse" />
          <span className="font-medium">
            Saving {queueSize} {queueSize === 1 ? 'note' : 'notes'}...
          </span>
        </div>
      </div>
    )
  }

  // Show pending count when online but not syncing
  if (queueSize > 0) {
    const handleSyncNow = async () => {
      setIsExpanded(false)
      setSyncing(true)
      try {
        const result = await syncPendingOperations()
        setSyncResult(result)
        await updateQueueSize()
      } catch (error) {
        console.error('[OfflineIndicator] Sync failed:', error)
      }
    }

    const handleClear = async () => {
      const confirmed = await confirm({
        title: 'Clear pending notes?',
        description: `Clear all ${queueSize} pending notes? This cannot be undone.`,
        confirmText: 'Clear',
        variant: 'destructive',
      })
      if (confirmed) {
        setIsExpanded(false)
        await clearQueue()
        await updateQueueSize()
      }
    }

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="glass-card text-[var(--brand-text-primary)] rounded-lg shadow-lg overflow-hidden">
          {/* Main notification bar */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 px-4 py-3 w-full hover:bg-[var(--glass-surface-hover)] transition-colors"
          >
            <CloudOff className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">
              {queueSize} {queueSize === 1 ? 'note' : 'notes'} waiting to save
            </span>
            <X className="h-4 w-4 ml-auto flex-shrink-0 opacity-60" />
          </button>

          {/* Expanded actions */}
          {isExpanded && (
            <div className="border-t border-[var(--glass-border)] p-2 space-y-1">
              <button
                onClick={handleSyncNow}
                disabled={!isOnline}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--glass-surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm font-medium">Sync now</span>
              </button>
              <button
                onClick={handleClear}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--glass-surface-hover)] transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="text-sm font-medium">Clear queue</span>
              </button>
            </div>
          )}
        </div>
        {confirmDialog}
      </div>
    )
  }

  return null
}
