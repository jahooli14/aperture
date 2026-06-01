/**
 * Sync Manager
 * Processes offline queue when connection is restored
 */

import { supabase } from './supabase'
import {
  getPendingOperations,
  removeOperation,
  updateOperationRetry,
  moveToDeadLetter,
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
        // Strip any client-only fallback title — the offline path may have
        // stuffed in a "first 8 words" placeholder so the optimistic memory
        // wasn't blank. We want Gemini to write the real title server-side.
        // tempId is the optimistic-row id used for temp→real remapping; it's
        // not a memories column, so drop it before the upsert.
        const { tempId: _tempId, ...insertPayload } = operation.data
        if (typeof insertPayload.title === 'string' && insertPayload.title.trim() === '') {
          insertPayload.title = null
        }

        // Upsert (not insert) keyed on the client-supplied id so a retry after
        // a lost response doesn't create a duplicate memory.
        const { data, error } = await supabase
          .from('memories')
          .upsert(insertPayload, { onConflict: 'id' })
          .select()
          .single()

        if (error) throw error

        // Trigger Gemini title + entity processing. This is the offline →
        // online "re-title" path. Retry a couple of times on transient
        // failures so users don't end up with an unprocessed memory.
        let processed = false
        for (let attempt = 0; attempt < 3 && !processed; attempt++) {
          try {
            const res = await fetch('/api/memories?action=process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ memory_id: data.id }),
            })
            if (res.ok) {
              processed = true
            } else {
              console.warn(`[SyncManager] Process attempt ${attempt + 1} returned ${res.status}`)
              await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
            }
          } catch (processError) {
            console.warn(`[SyncManager] Process attempt ${attempt + 1} failed:`, processError)
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
          }
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

      case 'create_project': {
        // tempId was the optimistic-row id; strip it before insert. The real
        // id is the client-supplied UUID (operation.data.id), which the sync
        // loop maps temp→real so any offline edits queued against tempId land.
        const { tempId: _tempId, ...insertData } = operation.data
        // Upsert keyed on id so a retry after a lost response is idempotent.
        const { data, error } = await supabase
          .from('projects')
          .upsert(insertData, { onConflict: 'id' })
          .select()
          .single()

        if (error) throw error

        // Schedule AI enrichment on the real project id so the server can
        // backfill anything the offline create skipped (summary, embeddings).
        if (data?.id) {
          projectsNeedingEnrichment.add(data.id)
        }
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
        // Lists already carry a client UUID id; upsert on it so a retry is idempotent.
        const { error } = await supabase
          .from('lists')
          .upsert(operation.data, { onConflict: 'id' })

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
        // List items already carry a client UUID id; upsert for idempotent retries.
        const { data, error } = await supabase
          .from('list_items')
          .upsert(operation.data, { onConflict: 'id' })
          .select()
          .single()

        if (error) throw error

        // Trigger enrichment for items added offline
        // This ensures AI enrichment happens when back online
        if (data) {
          try {
            await fetch(`/api/lists?scope=items&resource=enrich&listId=${data.list_id}`, {
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

      case 'reorder_lists': {
        const { listIds } = operation.data
        for (let i = 0; i < listIds.length; i++) {
          const { error } = await supabase
            .from('lists')
            .update({ sort_order: i })
            .eq('id', listIds[i])
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

      case 'capture_media': {
        const { captureId } = operation.data
        const { db } = await import('./db')

        // 1. Get blob from IndexedDB
        const pending = await db.pendingCaptures.get(captureId)
        if (!pending || !pending.audio_blob) {
          console.warn('[SyncManager] Media capture not found or missing blob:', captureId)
          return true // Nothing to do, remove from queue
        }

        console.log(`[SyncManager] Syncing media capture ${captureId} (${pending.audio_blob.size} bytes)`)

        // 2. Transcribe
        const formData = new FormData()
        formData.append('audio', pending.audio_blob, 'recording.webm')

        const transcribeRes = await fetch('/api/memories?action=transcribe', {
          method: 'POST',
          body: formData
        })

        if (!transcribeRes.ok) throw new Error(`Transcription failed during sync: ${transcribeRes.status}`)
        const { text } = await transcribeRes.json()

        if (!text) throw new Error('No transcript returned during sync')

        // 3. Create Memory - this is now rapid as we fixed the API to be non-blocking
        const captureRes = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: text,
            // Preserve source project if available
            source_reference: pending.transcript?.startsWith('project:') ? pending.transcript : null
          })
        })

        if (!captureRes.ok) throw new Error(`Capture failed during sync: ${captureRes.status}`)

        // 4. Cleanup
        await db.deletePendingCapture(captureId)
        console.log('[SyncManager] Successfully synced media capture')

        // Trigger a generic memory refresh event for the UI
        window.dispatchEvent(new CustomEvent('memories-synced'))

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

// Offline-created projects/memories use a client temp id for the optimistic
// row. Their create op carries the real (client UUID) id plus that tempId; any
// edit/delete queued before the create syncs targets the tempId and must be
// rewritten to the real id at sync time, or it would update zero rows.
function isTempId(id: unknown): id is string {
  return typeof id === 'string' &&
    (id.startsWith('temp-') || id.startsWith('temp_') || id.startsWith('offline_'))
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
    // Operations are timestamp-ordered, so a create always precedes the edits
    // queued against it. As each create succeeds we learn its temp→real id and
    // rewrite later ops; ops whose create hasn't synced yet are deferred (left
    // queued) rather than run against a non-existent row.
    const operations = await getPendingOperations()
    let success = 0
    let failed = 0
    const idRemap = new Map<string, string>()
    const preDeadLettered = new Set<number>()

    console.log(`[SyncManager] Starting sync of ${operations.length} operations`)

    for (const operation of operations) {
      if (!operation.id) continue
      if (preDeadLettered.has(operation.id)) continue

      // Resolve a temp-id reference to the real id now that its create ran.
      if (isTempId(operation.data?.id) && idRemap.has(operation.data.id)) {
        operation.data.id = idRemap.get(operation.data.id)
      }

      // Give up after too many retries — but preserve the payload in the
      // dead-letter table instead of silently discarding the user's work.
      if (operation.retryCount >= MAX_RETRIES) {
        console.warn(`[SyncManager] Max retries reached for operation ${operation.id}, dead-lettering`)
        await moveToDeadLetter(operation)
        failed++
        // A create giving up means its dependent edits can never apply — dead-letter them too.
        const tempId = operation.data?.tempId
        if (tempId) {
          for (const dep of operations) {
            if (dep.id && dep.id !== operation.id && dep.data?.id === tempId) {
              await moveToDeadLetter(dep)
              preDeadLettered.add(dep.id)
            }
          }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-operation-dead-lettered', { detail: { type: operation.type } }))
        }
        continue
      }

      // Defer an edit/delete whose target row hasn't been created server-side
      // yet (its create failed earlier this pass). Keep it queued, no retry
      // bump — it'll resolve once the create succeeds.
      if (isTempId(operation.data?.id)) {
        console.warn(`[SyncManager] Deferring ${operation.type} until its create syncs:`, operation.data.id)
        continue
      }

      const succeeded = await processOperation(operation)

      if (succeeded) {
        // Record temp→real so later ops this pass hit the real row.
        if (operation.data?.tempId && operation.data?.id) {
          idRemap.set(operation.data.tempId, operation.data.id)
        }
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

    // Tell the UI to swap optimistic offline memories for the freshly-titled
    // server rows. The MemoriesPage listens for this and re-fetches.
    if (success > 0) {
      window.dispatchEvent(new CustomEvent('memories-synced', {
        detail: { success, failed, total: operations.length },
      }))
    }

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
