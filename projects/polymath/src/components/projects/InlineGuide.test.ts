/**
 * Battle-test the chat's task-op application.
 *
 * The original bug: rapid Apply clicks read tasks from a stale React closure
 * and clobbered each other. The fix routes everything through a single
 * serialized queue that reads the freshest tasks at apply time. These tests
 * cover both the pure reducer (applyOpToTasks) and the queueing behavior
 * that prevents the race.
 */

import { describe, it, expect, vi } from 'vitest'
import { applyOpToTasks } from './inlineGuideOps'
import type { Task } from './TaskList'

function makeTask(partial: Partial<Task> & { id: string; text: string }): Task {
  return {
    done: false,
    created_at: '2026-01-01T00:00:00Z',
    order: 0,
    ...partial,
  }
}

describe('applyOpToTasks', () => {
  const base: Task[] = [
    makeTask({ id: 'a', text: 'alpha' }),
    makeTask({ id: 'b', text: 'beta' }),
    makeTask({ id: 'c', text: 'gamma' }),
  ]

  it('appends a new task for add', () => {
    const out = applyOpToTasks(base, {
      action: 'add',
      newText: 'delta',
      task_type: 'core',
      estimated_minutes: 15,
      reasoning: 'because',
    })
    expect(out).toHaveLength(4)
    expect(out[3]).toMatchObject({
      text: 'delta',
      task_type: 'core',
      estimated_minutes: 15,
      ai_reasoning: 'because',
      is_ai_suggested: true,
      done: false,
      order: 3,
    })
    expect(out[3].id).toBeTruthy()
  })

  it('ignores add with no newText', () => {
    expect(applyOpToTasks(base, { action: 'add' })).toBe(base)
  })

  it('marks task done with completed_at for complete', () => {
    const out = applyOpToTasks(base, { action: 'complete', taskId: 'b' })
    const target = out.find(t => t.id === 'b')!
    expect(target.done).toBe(true)
    expect(target.completed_at).toBeTruthy()
    // siblings untouched
    expect(out.find(t => t.id === 'a')!.done).toBe(false)
  })

  it('clears done and completed_at for uncomplete', () => {
    const done: Task[] = base.map(t => ({ ...t, done: true, completed_at: 'x' }))
    const out = applyOpToTasks(done, { action: 'uncomplete', taskId: 'b' })
    const target = out.find(t => t.id === 'b')!
    expect(target.done).toBe(false)
    expect(target.completed_at).toBeUndefined()
  })

  it('removes the task for delete', () => {
    const out = applyOpToTasks(base, { action: 'delete', taskId: 'b' })
    expect(out.map(t => t.id)).toEqual(['a', 'c'])
  })

  it('rewrites text for edit', () => {
    const out = applyOpToTasks(base, { action: 'edit', taskId: 'b', newText: 'BETA!' })
    expect(out.find(t => t.id === 'b')!.text).toBe('BETA!')
  })

  it('ignores edit when newText missing', () => {
    expect(applyOpToTasks(base, { action: 'edit', taskId: 'b' })).toBe(base)
  })

  it('ignores ops with no taskId for non-add actions', () => {
    expect(applyOpToTasks(base, { action: 'complete' })).toBe(base)
    expect(applyOpToTasks(base, { action: 'delete' })).toBe(base)
    expect(applyOpToTasks(base, { action: 'edit', newText: 'x' })).toBe(base)
  })

  it('ignores ops that reference an unknown taskId without throwing', () => {
    const out = applyOpToTasks(base, { action: 'complete', taskId: 'zzz' })
    // returns the array unchanged in content
    expect(out.map(t => t.id)).toEqual(['a', 'b', 'c'])
    expect(out.every(t => !t.done)).toBe(true)
  })

  it('composes correctly when reduced sequentially (Apply all)', () => {
    const ops = [
      { action: 'complete' as const, taskId: 'a' },
      { action: 'delete' as const, taskId: 'c' },
      { action: 'edit' as const, taskId: 'b', newText: 'BETA' },
      { action: 'add' as const, newText: 'epsilon', task_type: 'core' as const },
    ]
    const out = ops.reduce((acc, op) => applyOpToTasks(acc, op), base)
    expect(out.map(t => t.text)).toEqual(['alpha', 'BETA', 'epsilon'])
    expect(out.find(t => t.id === 'a')!.done).toBe(true)
    expect(out.find(t => t.text === 'epsilon')!.is_ai_suggested).toBe(true)
  })
})

/**
 * Race-condition regression: simulate the original bug by feeding two
 * concurrent applies that each read from a *stale* snapshot. The fix routes
 * all writes through a queue whose mutator reads the latest tasks at the
 * moment it runs, not at the moment the user clicked.
 *
 * The queueing pattern is small and pure enough to test directly without
 * mounting the full component.
 */
describe('serialized write queue', () => {
  it('reads the latest tasks at apply time, not at click time', async () => {
    let stored: Task[] = [makeTask({ id: 'a', text: 'A' }), makeTask({ id: 'b', text: 'B' })]
    const writes: Task[][] = []

    const getLatestTasks = () => stored
    const onUpdateTasks = vi.fn(async (next: Task[]) => {
      writes.push(next)
      stored = next
    })

    // Same queue pattern as InlineGuide.enqueueTaskUpdate
    let queue: Promise<unknown> = Promise.resolve()
    const enqueue = (mutate: (tasks: Task[]) => Task[]) => {
      const p = queue.catch(() => {}).then(() => onUpdateTasks(mutate(getLatestTasks())))
      queue = p
      return p
    }

    // Fire two clicks "simultaneously" — pre-fix, both would see [A, B]
    // and the second write would clobber the first.
    const p1 = enqueue(t => applyOpToTasks(t, { action: 'complete', taskId: 'a' }))
    const p2 = enqueue(t => applyOpToTasks(t, { action: 'complete', taskId: 'b' }))

    await Promise.all([p1, p2])

    expect(onUpdateTasks).toHaveBeenCalledTimes(2)
    // First write completes 'a' on the original list
    expect(writes[0].find(t => t.id === 'a')!.done).toBe(true)
    expect(writes[0].find(t => t.id === 'b')!.done).toBe(false)
    // Second write reads the freshly-stored list and completes 'b' on top
    expect(writes[1].find(t => t.id === 'a')!.done).toBe(true)
    expect(writes[1].find(t => t.id === 'b')!.done).toBe(true)
  })

  it('chains a goal update after a pending task write', async () => {
    const order: string[] = []
    let queue: Promise<unknown> = Promise.resolve()

    const onUpdateTasks = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10))
      order.push('tasks')
    })
    const onUpdateGoal = vi.fn(async () => { order.push('goal') })

    queue = queue.catch(() => {}).then(() => onUpdateTasks())
    queue = queue.catch(() => {}).then(() => onUpdateGoal())
    await queue

    expect(order).toEqual(['tasks', 'goal'])
  })

  it('survives a failing op without stalling the queue', async () => {
    const writes: string[] = []
    let queue: Promise<unknown> = Promise.resolve()
    const enqueue = (label: string, fn: () => Promise<void>) => {
      const p = queue.catch(() => {}).then(async () => {
        await fn()
        writes.push(label)
      })
      queue = p
      return p
    }

    const p1 = enqueue('one', async () => { throw new Error('boom') })
    const p2 = enqueue('two', async () => {})
    await Promise.allSettled([p1, p2])

    // 'one' threw, so its label never landed — but 'two' did.
    expect(writes).toEqual(['two'])
  })
})
