/**
 * Offline Queue Manager
 * Manages pending operations when offline and syncs when back online
 */

import Dexie, { Table } from 'dexie'

export interface QueuedOperation {
  id?: number
  type: 'create_memory' | 'update_memory' | 'delete_memory' | 'update_project' | 'delete_project' | 'create_list' | 'delete_list' | 'add_list_item' | 'delete_list_item' | 'update_list_item' | 'reorder_list_items' | 'capture_media' | 'update_article' | 'delete_article'
  data: any
  timestamp: number
  retryCount: number
  lastError?: string
}

class OfflineQueueDB extends Dexie {
  operations!: Table<QueuedOperation, number>

  constructor() {
    super('OfflineQueue')
    this.version(1).stores({
      operations: '++id, type, timestamp',
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
