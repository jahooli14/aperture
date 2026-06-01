import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { QueuedOperation } from './offlineQueue'

// ── In-memory offline queue backing the mocked module ─────────────────────────
let queue: QueuedOperation[] = []
const deadLettered: QueuedOperation[] = []
const removed: number[] = []
const retried: number[] = []

vi.mock('./offlineQueue', () => ({
  getPendingOperations: vi.fn(async () => [...queue].sort((a, b) => a.timestamp - b.timestamp)),
  removeOperation: vi.fn(async (id: number) => {
    removed.push(id)
    queue = queue.filter((o) => o.id !== id)
  }),
  updateOperationRetry: vi.fn(async (id: number) => {
    retried.push(id)
    const op = queue.find((o) => o.id === id)
    if (op) op.retryCount += 1
  }),
  moveToDeadLetter: vi.fn(async (op: QueuedOperation) => {
    deadLettered.push(op)
    queue = queue.filter((o) => o.id !== op.id)
  }),
}))

vi.mock('./aiEnrichmentManager', () => ({
  triggerImmediateEnrichment: vi.fn(),
}))

// ── Controllable supabase chainable stub ──────────────────────────────────────
// Records terminal .eq() filters so we can assert which id an update targeted.
type Result = { data?: any; error?: any }
let nextResult: Result = { data: { id: 'server-id' }, error: null }
const eqCalls: Array<{ table: string; column: string; value: any }> = []
let failTables = new Set<string>() // tables whose write should error

function makeBuilder(table: string) {
  const builder: any = {
    upsert: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    select: () => builder,
    eq: (column: string, value: any) => {
      eqCalls.push({ table, column, value })
      // terminal for update/delete — resolve as a thenable
      return Promise.resolve(failTables.has(table) ? { error: new Error('boom') } : { error: null })
    },
    single: () =>
      Promise.resolve(failTables.has(table) ? { data: null, error: new Error('boom') } : nextResult),
  }
  return builder
}

vi.mock('./supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}))

import { syncPendingOperations } from './syncManager'

beforeEach(() => {
  queue = []
  deadLettered.length = 0
  removed.length = 0
  retried.length = 0
  eqCalls.length = 0
  failTables = new Set()
  nextResult = { data: { id: 'server-id' }, error: null }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as any))
})

describe('syncPendingOperations — offline hardening', () => {
  it('removes a create on success (idempotent upsert path)', async () => {
    queue = [{ id: 1, type: 'create_memory', data: { id: 'uuid-1', body: 'hi', tempId: 'offline_1' }, timestamp: 1, retryCount: 0 }]
    const res = await syncPendingOperations()
    expect(res.success).toBe(1)
    expect(removed).toContain(1)
    expect(deadLettered).toHaveLength(0)
  })

  it('remaps a dependent edit from the temp id to the real id', async () => {
    queue = [
      { id: 1, type: 'create_project', data: { id: 'real-uuid', tempId: 'temp-99', title: 'X' }, timestamp: 1, retryCount: 0 },
      { id: 2, type: 'update_project', data: { id: 'temp-99', title: 'Y' }, timestamp: 2, retryCount: 0 },
    ]
    await syncPendingOperations()
    // The update must have targeted the real id, never the temp id.
    const projectEqs = eqCalls.filter((c) => c.table === 'projects')
    expect(projectEqs.some((c) => c.value === 'real-uuid')).toBe(true)
    expect(projectEqs.some((c) => c.value === 'temp-99')).toBe(false)
    expect(removed).toEqual(expect.arrayContaining([1, 2]))
  })

  it('defers a dependent edit when its create fails this pass', async () => {
    failTables = new Set(['projects']) // create_project upsert errors
    queue = [
      { id: 1, type: 'create_project', data: { id: 'real-uuid', tempId: 'temp-99', title: 'X' }, timestamp: 1, retryCount: 0 },
      { id: 2, type: 'update_project', data: { id: 'temp-99', title: 'Y' }, timestamp: 2, retryCount: 0 },
    ]
    await syncPendingOperations()
    // create failed → retried; update deferred → neither processed nor retried, still queued.
    expect(retried).toContain(1)
    expect(retried).not.toContain(2)
    expect(removed).not.toContain(2)
    expect(eqCalls.some((c) => c.value === 'temp-99')).toBe(false)
  })

  it('dead-letters an op past max retries instead of silently dropping it, and dead-letters its dependents', async () => {
    queue = [
      { id: 1, type: 'create_project', data: { id: 'real-uuid', tempId: 'temp-99', title: 'X' }, timestamp: 1, retryCount: 3 },
      { id: 2, type: 'update_project', data: { id: 'temp-99', title: 'Y' }, timestamp: 2, retryCount: 0 },
    ]
    await syncPendingOperations()
    const dlIds = deadLettered.map((o) => o.id)
    expect(dlIds).toContain(1) // the give-up create
    expect(dlIds).toContain(2) // its now-orphaned dependent
    expect(removed).not.toContain(1) // not silently deleted
  })
})
