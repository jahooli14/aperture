/**
 * Offline Store
 * Manages offline state and sync status
 */

import { create } from 'zustand'
import { getQueueSize } from '../lib/offlineQueue'

interface OfflineState {
  isOnline: boolean
  isSyncing: boolean
  queueSize: number
  lastSyncTime: number | null
  lastSyncResult: {
    success: number
    failed: number
    total: number
  } | null

  // Actions
  setOnlineStatus: (isOnline: boolean) => void
  setSyncing: (isSyncing: boolean) => void
  updateQueueSize: () => Promise<void>
  setSyncResult: (result: { success: number; failed: number; total: number }) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  queueSize: 0,
  lastSyncTime: null,
  lastSyncResult: null,

  setOnlineStatus: (isOnline) => set({ isOnline }),

  setSyncing: (isSyncing) => set({ isSyncing }),

  updateQueueSize: async () => {
    const size = await getQueueSize()
    set({ queueSize: size })
  },

  setSyncResult: (result) =>
    set({
      lastSyncResult: result,
      lastSyncTime: Date.now(),
      isSyncing: false,
    }),
}))
