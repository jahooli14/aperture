/**
 * Sync Manager
 * Processes offline queue when connection is restored
 */

import { supabase } from './supabase'
import {
  getPendingOperations,
  removeOperation,
  updateOperationRetry,
  type QueuedOperation,
} from './offlineQueue'

const MAX_RETRIES = 3

/**
 * Process a single queued operation
 */
async function processOperation(operation: QueuedOperation): Promise<boolean> {
  try {
    switch (operation.type) {
      case 'create_memory': {
        const { data, error } = await supabase
          .from('memories')
          .insert(operation.data)
          .select()
          .single()

        if (error) throw error

        // Trigger background processing
        try {
          await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memory_id: data.id }),
          })
        } catch (processError) {
          console.warn('[SyncManager] Processing trigger failed:', processError)
        }

        return true
      }

      case 'update_memory': {
        const { id, ...updateData } = operation.data
        const { error } = await supabase
          .from('memories')
          .update(updateData)
          .eq('id', id)

        if (error) throw error
        return true
      }

      case 'delete_memory': {
        const { error } = await supabase
          .from('memories')
          .delete()
          .eq('id', operation.data.id)

        if (error) throw error
        return true
      }

      case 'update_project': {
        const { id, ...updateData } = operation.data
        const { error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', id)

        if (error) throw error
        return true
      }

      case 'delete_project': {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', operation.data.id)

        if (error) throw error
        return true
      }

      default:
        console.error('[SyncManager] Unknown operation type:', operation.type)
        return false
    }
  } catch (error) {
    console.error('[SyncManager] Operation failed:', operation.type, error)
    return false
  }
}

/**
 * Sync all pending operations
 */
export async function syncPendingOperations(): Promise<{
  success: number
  failed: number
  total: number
}> {
  const operations = await getPendingOperations()
  let success = 0
  let failed = 0

  console.log(`[SyncManager] Starting sync of ${operations.length} operations`)

  for (const operation of operations) {
    if (!operation.id) continue

    // Skip if already retried too many times
    if (operation.retryCount >= MAX_RETRIES) {
      console.warn(
        `[SyncManager] Max retries reached for operation ${operation.id}, removing from queue`
      )
      await removeOperation(operation.id)
      failed++
      continue
    }

    const succeeded = await processOperation(operation)

    if (succeeded) {
      await removeOperation(operation.id)
      success++
      console.log(`[SyncManager] Successfully processed operation ${operation.id}`)
    } else {
      await updateOperationRetry(
        operation.id,
        'Failed to process operation'
      )
      failed++
    }
  }

  console.log(
    `[SyncManager] Sync complete: ${success} succeeded, ${failed} failed, ${operations.length} total`
  )

  return { success, failed, total: operations.length }
}

/**
 * Setup automatic sync when connection is restored
 */
export function setupAutoSync(onSyncComplete?: (result: {
  success: number
  failed: number
  total: number
}) => void) {
  // Listen for online event
  window.addEventListener('online', async () => {
    console.log('[SyncManager] Connection restored, starting sync...')
    const result = await syncPendingOperations()
    onSyncComplete?.(result)
  })

  // Initial sync if already online
  if (navigator.onLine) {
    syncPendingOperations().then((result) => {
      if (result.total > 0) {
        onSyncComplete?.(result)
      }
    })
  }
}
