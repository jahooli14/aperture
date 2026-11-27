import { describe, it, expect, vi } from 'vitest'

const insert = vi.fn(async () => ({ error: null }))
vi.mock('./supabase.js', () => ({ getSupabaseClient: () => ({ from: () => ({ insert, delete: () => ({ lt: async () => ({}) }) }) }) }))

import { withErrorLog } from './error-log.js'

function fakeRes() {
  const res: Record<string, unknown> = {}
  res.status = (c: number) => { res.code = c; return res }
  res.json = (b: unknown) => { res.body = b; return res }
  return res as never
}
const req = { method: 'POST', query: { resource: 'project-update' } } as never

describe('withErrorLog', () => {
  it('records a 5xx and still answers the caller', async () => {
    insert.mockClear()
    const res = fakeRes()
    await withErrorLog('utilities', (_q, r) => { r.status(500).json({ error: 'boom' }) })(req, res)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ route: 'utilities', resource: 'project-update', status: 500, message: 'boom' }))
    expect((res as { body: unknown }).body).toEqual({ error: 'boom' })
  })
  it('stays quiet on success and on 4xx', async () => {
    insert.mockClear()
    await withErrorLog('utilities', (_q, r) => { r.status(200).json({ ok: true }) })(req, fakeRes())
    await withErrorLog('utilities', (_q, r) => { r.status(404).json({ error: 'nope' }) })(req, fakeRes())
    expect(insert).not.toHaveBeenCalled()
  })
  it('records a throw and rethrows it', async () => {
    insert.mockClear()
    await expect(withErrorLog('reading', () => { throw new Error('crash') })(req, fakeRes())).rejects.toThrow('crash')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: 500, message: 'crash' }))
  })
})
