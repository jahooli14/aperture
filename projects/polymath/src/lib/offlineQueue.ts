/**
 * Offline Queue Manager
 * Manages pending operations when offline and syncs when back online
 *
 * Operations are stored in the main RosetteDB to avoid multiple IndexedDB connections.
 */

export interface QueuedOperation {
  id?: number
  type: 'create_memory' | 'update_memory' | 'delete_memory' | 'update_project' | 'delete_project' | 'create_list' | 'delete_list' | 'add_list_item' | 'delete_list_item' | 'update_list_item' | 'reorder_list_items' | 'reorder_lists' | 'capture_media' | 'update_article' | 'delete_article'
  data: any
  timestamp: number
  retryCount: number
  lastError?: string
}

// Lazy import to avoid circular dependency (db.ts imports QueuedOperation type from here)
let _db: typeof import('./db').db | null = null
async function getDb() {
  if (!_db) {
    const mod = await import('./db')
    _db = mod.db
  }
  return _db
}

/**
 * Add operation to offline queue
 */
export async function queueOperation(
  type: QueuedOperation['type'],
  data: any
): Promise<void> {
  const db = await getDb()
  const operation: QueuedOperation = {
    type,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  }

  await db.operations.add(operation)
  console.log('[OfflineQueue] Queued operation:', type)
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = await getDb()
  return await db.operations.orderBy('timestamp').toArray()
}

/**
 * Remove operation from queue
 */
export async function removeOperation(id: number): Promise<void> {
  const db = await getDb()
  await db.operations.delete(id)
}

/**
 * Update operation retry count and error
 */
export async function updateOperationRetry(
  id: number,
  error: string
): Promise<void> {
  const db = await getDb()
  const operation = await db.operations.get(id)
  if (operation) {
    await db.operations.update(id, {
      retryCount: operation.retryCount + 1,
      lastError: error,
    })
  }
}

/**
 * Clear all operations from queue
 */
export async function clearQueue(): Promise<void> {
  const db = await getDb()
  await db.operations.clear()
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  const db = await getDb()
  return await db.operations.count()
}

/**
 * Migrate any existing operations from the old OfflineQueue DB.
 * Run once on startup, then the old DB can be deleted.
 */
export async function migrateFromLegacyQueue(): Promise<void> {
  try {
    // Check if old database exists by trying to open it
    const oldDbRequest = indexedDB.open('OfflineQueue', 1)

    await new Promise<void>((resolve, reject) => {
      oldDbRequest.onerror = () => resolve() // DB doesn't exist, nothing to migrate

      oldDbRequest.onsuccess = async () => {
        const oldDb = oldDbRequest.result
        try {
          if (!oldDb.objectStoreNames.contains('operations')) {
            oldDb.close()
            resolve()
            return
          }

          const tx = oldDb.transaction('operations', 'readonly')
          const store = tx.objectStore('operations')
          const getAllReq = store.getAll()

          getAllReq.onsuccess = async () => {
            const oldOps = getAllReq.result
            if (oldOps.length > 0) {
              const db = await getDb()
              // Copy operations to new DB (strip old IDs, let Dexie auto-increment)
              for (const op of oldOps) {
                const { id: _id, ...rest } = op
                await db.operations.add(rest as QueuedOperation)
              }
              console.log(`[OfflineQueue] Migrated ${oldOps.length} operations from legacy DB`)
            }
            oldDb.close()

            // Delete old database
            indexedDB.deleteDatabase('OfflineQueue')
            console.log('[OfflineQueue] Deleted legacy OfflineQueue database')
            resolve()
          }
          getAllReq.onerror = () => {
            oldDb.close()
            resolve()
          }
        } catch {
          oldDb.close()
          resolve()
        }
      }

      oldDbRequest.onupgradeneeded = () => {
        // Old DB didn't exist, close and clean up
        oldDbRequest.result.close()
        indexedDB.deleteDatabase('OfflineQueue')
        resolve()
      }
    })

    // Also clean up the old SW-only aperture-offline database
    indexedDB.deleteDatabase('aperture-offline')
  } catch {
    // Migration is best-effort, don't block startup
  }
}
