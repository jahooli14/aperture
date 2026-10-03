import { describe, it, expect, vi } from 'vitest'
import { plainlyDone, parseVerdict, readSaid, logMoveDone } from './move-said'

describe('plainlyDone', () => {
  it.each(['I did that', 'done', 'Done.', "I've finished it", 'finished that', 'ok, did it'])(
    'reads %j as done',
    said => expect(plainlyDone(said)).toBe(true),
  )

  it.each([
    "I'm not done yet",
    'I did the first half',
    'did that but the left side is 2cm low',
    'should I do that today?',
    'not done',
  ])('does not read %j as done', said => expect(plainlyDone(said)).toBe(false))
})

describe('parseVerdict', () => {
  it('reads both flags', () => {
    expect(parseVerdict('{"move_done":true,"project_done":false}')).toEqual({ moveDone: true, projectDone: false })
  })

  it('a finished project means the move is finished too', () => {
    expect(parseVerdict('{"move_done":false,"project_done":true}')).toEqual({ moveDone: true, projectDone: true })
  })

  it('treats anything unreadable as nothing done', () => {
    expect(parseVerdict('nope')).toEqual({ moveDone: false, projectDone: false })
  })
})

describe('readSaid', () => {
  it('does not call the model for a plain "I did that"', async () => {
    const generate = vi.fn()
    expect(await readSaid('Sand it', 'I did that', generate)).toEqual({ moveDone: true, projectDone: false })
    expect(generate).not.toHaveBeenCalled()
  })

  it('asks the model otherwise', async () => {
    const generate = vi.fn().mockResolvedValue('{"move_done":false,"project_done":true}')
    expect(await readSaid('Sand it', 'The whole table is done', generate)).toEqual({ moveDone: true, projectDone: true })
  })

  it('logs nothing when the model fails', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('timeout'))
    expect(await readSaid('Sand it', 'it went well', generate)).toEqual({ moveDone: false, projectDone: false })
  })
})

function fakeSupabase(metadata: Record<string, unknown>) {
  const updates: unknown[] = []
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { metadata }, error: null }) }) }) }),
      update: (payload: unknown) => {
        updates.push(payload)
        return { eq: () => ({ eq: async () => ({ error: null }) }) }
      },
    }),
  }
  return { client: client as never, updates }
}

describe('logMoveDone', () => {
  it('adds the move to the log as done work, without its done-when', async () => {
    const { client, updates } = fakeSupabase({ tasks: [] })
    const text = await logMoveDone(client, 'u', 'p', 'Sand the top. Done when the top looks level.', new Date('2026-10-03T10:00:00Z'))
    expect(text).toBe('Sand the top.')
    const saved = (updates[0] as { metadata: { tasks: Array<{ text: string; done: boolean; completed_at: string }> } }).metadata.tasks
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ text: 'Sand the top.', done: true, completed_at: '2026-10-03T10:00:00.000Z' })
  })

  it('does not log the same move twice', async () => {
    const { client, updates } = fakeSupabase({ tasks: [{ id: 't1', text: 'Sand the top.', done: true }] })
    await logMoveDone(client, 'u', 'p', 'Sand the top.')
    expect(updates).toHaveLength(0)
  })
})
