/**
 * Offline Queue Manager
 * Manages pending operations when offline and syncs when back online
 */

import Dexie, { Table } from 'dexie'

export interface QueuedOperation {
  id?: number
  type: 'create_memory' | 'update_memory' | 'delete_memory' | 'create_project' | 'update_project' | 'delete_project' | 'create_list' | 'delete_list' | 'add_list_item' | 'delete_list_item' | 'update_list_item' | 'reorder_list_items' | 'reorder_lists' | 'capture_media' | 'update_article' | 'delete_article'
  data: any
  timestamp: number
  retryCount: number
  lastError?: string
}

// Operations that exhausted their retries land here instead of being silently
// deleted, so a user's offline work is never thrown away without a trace.
export interface DeadLetterOperation extends QueuedOperation {
  deadLetteredAt: number
}

class OfflineQueueDB extends Dexie {
  operations!: Table<QueuedOperation, number>
  deadLetter!: Table<DeadLetterOperation, number>

  constructor() {
    super('OfflineQueue')
    this.version(1).stores({
      operations: '++id, type, timestamp',
    })
    // v2 adds a dead-letter table. Additive only — existing operations
    // survive the upgrade untouched.
    this.version(2).stores({
      operations: '++id, type, timestamp',
      deadLetter: '++id, type, timestamp, deadLetteredAt',
    })
  }
}

export const offlineQueue = new OfflineQueueDB()

/**
 * Add operation to offline queue
 */
export async function queueOperation(
  type: QueuedOperation['type'],
  data: any
): Promise<void> {
  const operation: QueuedOperation = {
    type,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  }

  await offlineQueue.operations.add(operation)
  console.log('[OfflineQueue] Queued operation:', type)
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  return await offlineQueue.operations.orderBy('timestamp').toArray()
}

/**
 * Remove operation from queue
 */
export async function removeOperation(id: number): Promise<void> {
  await offlineQueue.operations.delete(id)
}

/**
 * Update operation retry count and error
 */
export async function updateOperationRetry(
  id: number,
  error: string
): Promise<void> {
  const operation = await offlineQueue.operations.get(id)
  if (operation) {
    await offlineQueue.operations.update(id, {
      retryCount: operation.retryCount + 1,
      lastError: error,
    })
  }
}

/**
 * Move an operation that exhausted its retries to the dead-letter table.
 * Preserves the payload so it can be inspected or replayed, rather than
 * silently discarding the user's work.
 */
export async function moveToDeadLetter(operation: QueuedOperation): Promise<void> {
  const { id: _id, ...rest } = operation
  await offlineQueue.deadLetter.add({ ...rest, deadLetteredAt: Date.now() } as DeadLetterOperation)
  if (operation.id != null) {
    await offlineQueue.operations.delete(operation.id)
  }
  console.error('[OfflineQueue] Operation moved to dead-letter:', operation.type, operation.lastError)
}

/**
 * Read dead-lettered operations (for surfacing / manual replay).
 */
export async function getDeadLetterOperations(): Promise<DeadLetterOperation[]> {
  return await offlineQueue.deadLetter.orderBy('deadLetteredAt').toArray()
}

/**
 * Clear the dead-letter table.
 */
export async function clearDeadLetter(): Promise<void> {
  await offlineQueue.deadLetter.clear()
}

/**
 * Clear all operations from queue
 */
export async function clearQueue(): Promise<void> {
  await offlineQueue.operations.clear()
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  return await offlineQueue.operations.count()
}
