import { describe, it, expect, vi } from 'vitest'

vi.mock('./process-memory.js', () => ({ processMemory: () => new Promise(() => {}) }))
vi.mock('./project-catchup-routes.js', () => ({ refreshThemes: () => new Promise(() => {}) }))
vi.mock('./move-say.js', () => ({ moveFromUpdate: () => new Promise(() => {}) }))
vi.mock('./project-parts.js', () => ({ tickFromSaid: async () => [], readParts: () => [] }))

import { saveProjectUpdate } from './project-update.js'

function fakeSupabase() {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'update', 'insert']) chain[m] = () => chain
  chain.single = async () => ({ data: { id: 'p1' }, error: null })
  return { from: () => chain } as never
}

describe('saveProjectUpdate', () => {
  it('still answers ok when the model steps never finish', async () => {
    vi.useFakeTimers()
    const done = saveProjectUpdate(fakeSupabase(), 'u1', 'p1', 'did chapter two')
    await vi.advanceTimersByTimeAsync(46_000)
    const out = await done
    vi.useRealTimers()
    expect(out.ok).toBe(true)
  })
})
