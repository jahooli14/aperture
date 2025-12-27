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
import { triggerImmediateEnrichment } from './aiEnrichmentManager'

const MAX_RETRIES = 3
let isSyncing = false
let syncScheduled = false
let autoSyncSetup = false

// Track projects that need AI enrichment after sync
const projectsNeedingEnrichment = new Set<string>()

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
          await fetch('/api/memories?action=process', {
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

        // Track for AI enrichment if tasks were updated
        if (updateData.metadata?.tasks) {
          projectsNeedingEnrichment.add(id)
        }
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

      // List operations
      case 'create_list': {
        const { error } = await supabase
          .from('lists')
          .insert(operation.data)

        if (error) throw error
        return true
      }

      case 'delete_list': {
        const { error } = await supabase
          .from('lists')
          .delete()
          .eq('id', operation.data.id)

        if (error) throw error
        return true
      }

      case 'add_list_item': {
        const { data, error } = await supabase
          .from('list_items')
          .insert(operation.data)
          .select()
          .single()

        if (error) throw error

        // Trigger enrichment for items added offline
        // This ensures AI enrichment happens when back online
        if (data) {
          try {
            await fetch(`/api/list-items?listId=${data.list_id}&action=enrich`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: data.id, content: data.content })
            })
            console.log('[SyncManager] Triggered enrichment for offline list item:', data.id)
          } catch (enrichError) {
            console.warn('[SyncManager] Enrichment trigger failed, item will remain pending:', enrichError)
          }
        }
        return true
      }

      case 'delete_list_item': {
        const { error } = await supabase
          .from('list_items')
          .delete()
          .eq('id', operation.data.id)

        if (error) throw error
        return true
      }

      case 'update_list_item': {
        const { id, ...updateData } = operation.data
        const { error } = await supabase
          .from('list_items')
          .update(updateData)
          .eq('id', id)

        if (error) throw error
        return true
      }

      case 'reorder_list_items': {
        const { listId, itemIds } = operation.data
        // Update each item's sort_order
        for (let i = 0; i < itemIds.length; i++) {
          const { error } = await supabase
            .from('list_items')
            .update({ sort_order: i })
            .eq('id', itemIds[i])
          if (error) throw error
        }
        return true
      }

      // Article/Reading operations
      case 'update_article': {
        const { id, ...updateData } = operation.data
        const { error } = await supabase
          .from('reading_queue')
          .update(updateData)
          .eq('id', id)

        if (error) throw error
        return true
      }

      case 'delete_article': {
        const { error } = await supabase
          .from('reading_queue')
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
  // Prevent concurrent syncs
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress, scheduling next sync')
    syncScheduled = true
    return { success: 0, failed: 0, total: 0 }
  }

  isSyncing = true
  syncScheduled = false

  try {
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

    // Trigger AI enrichment for projects that had task updates (immediate, no debounce)
    if (projectsNeedingEnrichment.size > 0) {
      console.log(`[SyncManager] Triggering immediate AI enrichment for ${projectsNeedingEnrichment.size} projects`)
      for (const projectId of projectsNeedingEnrichment) {
        triggerImmediateEnrichment(projectId)
      }
      projectsNeedingEnrichment.clear()
    }

    return { success, failed, total: operations.length }
  } finally {
    isSyncing = false

    // If another sync was requested while we were syncing, start it now
    if (syncScheduled) {
      console.log('[SyncManager] Starting scheduled sync')
      setTimeout(() => syncPendingOperations(), 100) // Small delay to avoid stack overflow
    }
  }
}

/**
 * Setup automatic sync when connection is restored
 */
export function setupAutoSync(onSyncComplete?: (result: {
  success: number
  failed: number
  total: number
}) => void) {
  // Prevent duplicate setup
  if (autoSyncSetup) {
    console.log('[SyncManager] Auto-sync already set up, skipping')
    return
  }

  autoSyncSetup = true

  // Listen for online event
  const handleOnline = async () => {
    console.log('[SyncManager] Connection restored, starting sync...')
    const result = await syncPendingOperations()
    onSyncComplete?.(result)
  }

  window.addEventListener('online', handleOnline)

  // Initial sync if already online
  if (navigator.onLine) {
    syncPendingOperations().then((result) => {
      if (result.total > 0) {
        onSyncComplete?.(result)
      }
    })
  }
}
