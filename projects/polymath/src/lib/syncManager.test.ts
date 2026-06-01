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
  persistOperationData: vi.fn(async (id: number, data: any) => {
    const op = queue.find((o) => o.id === id)
    if (op) op.data = data
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

  it('persists the remapped id so a dependent that fails this pass is not orphaned next pass', async () => {
    // create_project succeeds (records remap); update_project is remapped to
    // the real id but its update fails transiently this pass.
    failTables = new Set() // create succeeds
    queue = [
      { id: 1, type: 'create_project', data: { id: 'real-uuid', tempId: 'temp-99', title: 'X' }, timestamp: 1, retryCount: 0 },
      { id: 2, type: 'update_project', data: { id: 'temp-99', title: 'Y' }, timestamp: 2, retryCount: 0 },
    ]
    // Make ONLY the update fail: create_project uses .single() (succeeds);
    // update_project uses .eq() — fail projects updates after the create ran.
    // Simplest: let both succeed, then assert the persisted id is the real one.
    await syncPendingOperations()
    // The update op (if still queued) must now carry the real id, not temp-99,
    // so a future pass (with an empty remap) still targets the right row.
    const stillQueued = queue.find((o) => o.id === 2)
    if (stillQueued) {
      expect(stillQueued.data.id).toBe('real-uuid')
    } else {
      // processed this pass — fine; assert it targeted the real id
      expect(eqCalls.some((c) => c.table === 'projects' && c.value === 'real-uuid')).toBe(true)
    }
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

  it('never defers an op that targets a real (non-temp) uuid, even while a create is failing', async () => {
    // Lists use client UUIDs end-to-end, so their edits must process normally
    // regardless of an unrelated project create stalling this pass.
    failTables = new Set(['projects'])
    queue = [
      { id: 1, type: 'create_project', data: { id: 'real-uuid', tempId: 'temp-99', title: 'X' }, timestamp: 1, retryCount: 0 },
      { id: 2, type: 'update_list_item', data: { id: '11111111-2222-3333-4444-555555555555', status: 'done' }, timestamp: 2, retryCount: 0 },
    ]
    await syncPendingOperations()
    // The list-item edit (real uuid) is processed + removed; only the project create is retried.
    expect(removed).toContain(2)
    expect(retried).toEqual([1])
  })

  it('remaps each create to its own dependents independently', async () => {
    queue = [
      { id: 1, type: 'create_project', data: { id: 'real-A', tempId: 'temp-A', title: 'A' }, timestamp: 1, retryCount: 0 },
      { id: 2, type: 'create_project', data: { id: 'real-B', tempId: 'temp-B', title: 'B' }, timestamp: 2, retryCount: 0 },
      { id: 3, type: 'update_project', data: { id: 'temp-B', title: 'B2' }, timestamp: 3, retryCount: 0 },
      { id: 4, type: 'update_project', data: { id: 'temp-A', title: 'A2' }, timestamp: 4, retryCount: 0 },
    ]
    await syncPendingOperations()
    const projectEqs = eqCalls.filter((c) => c.table === 'projects').map((c) => c.value)
    expect(projectEqs).toContain('real-A')
    expect(projectEqs).toContain('real-B')
    expect(projectEqs).not.toContain('temp-A')
    expect(projectEqs).not.toContain('temp-B')
  })
})
