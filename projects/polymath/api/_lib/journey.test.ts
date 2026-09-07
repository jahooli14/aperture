/**
 * Five walks of the main journey: plan → run → close → what happens next.
 *
 * These are not unit tests. Each walk drives ONE project through the real
 * modules in the real order — shapeSession, then the close-out
 * reconciliation, then shapeSession again on whatever the close-out left
 * behind — the way a person actually uses the app across an evening.
 *
 * The gaps this session found all lived exactly here: in what one step
 * hands the next, not inside any single step. A unit test for
 * `reconcileCloseout` and a unit test for `shapeSession` both pass while
 * the plan the second one produces silently contradicts the first.
 *
 * The database is an in-memory project; the model calls are stubbed to
 * fail closed, which is what they genuinely do without a key and which
 * keeps every walk deterministic. Everything between them is production
 * code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fail closed, exactly as the real calls do with no GEMINI_API_KEY. Any
// walk that needs a specific verdict overrides its own call.
vi.mock('./gemini-chat.js', () => ({
  generateText: vi.fn(async () => { throw new Error('GEMINI_API_KEY environment variable is not configured') }),
}))
vi.mock('./session-ready.js', () => ({
  checkReady: vi.fn(async () => ({ kind: 'ready' as const, sizeMinutes: null, compound: false })),
}))
vi.mock('./session-split.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-split.js')>()),
  splitStep: vi.fn(async () => null),
}))
vi.mock('./session-topup.js', () => ({ topUpSession: vi.fn(async () => []) }))
vi.mock('./session-briefing.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-briefing.js')>()),
  briefSession: vi.fn(async () => null),
}))
vi.mock('./session-spark.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-spark.js')>()),
  sparkForSession: vi.fn(async () => null),
}))

import { shapeSession } from './session-shaper.js'
import { reconcileCloseout, parseTicked } from './session-closeout.js'
import { readCycleState, cycleLabel, rollToNextCycle, lastCycleSteps } from './project-cycles.js'
import { normalizeTaskOrder } from './task-order.js'
import type { DebriefResult } from './debrief-matcher.js'

// ── The in-memory project ────────────────────────────────────────────

interface Row {
  id: string
  user_id: string
  title: string
  description: string | null
  type: string | null
  status: string
  metadata: any
  slots: any[]
  last_closeout_text: string | null
  last_session_ended_at: string | null
  mvs_minutes: number | null
  state: string | null
  last_active: string
  created_at: string
  embedding: null
  heat_reason: null
}

function makeProject(over: Partial<Row> & { metadata: any }): Row {
  return {
    id: 'p1', user_id: 'u1', title: 'The Album', description: 'A record.',
    type: null, status: 'active', slots: [], last_closeout_text: null,
    last_session_ended_at: null, mvs_minutes: null, state: null,
    last_active: '2026-09-01T10:00:00.000Z', created_at: '2026-08-01T10:00:00.000Z',
    embedding: null, heat_reason: null,
    ...over,
  }
}

/** Reads the project row; every other table is empty, which the shaper
 *  already treats as "nothing to add". Writes land back on the row, so a
 *  later walk step sees what an earlier one persisted. */
function db(row: Row) {
  return {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        update(payload: Record<string, unknown>) {
          if (table === 'projects') Object.assign(row, payload)
          const u: any = { eq: () => u, then: (r: any) => r({ error: null }) }
          return u
        },
        eq: () => chain,
        not: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: table === 'projects' ? row : null, error: null }),
      }
      return chain
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  } as any
}

const step = (id: string, text: string, order: number, over: any = {}) =>
  ({ id, text, done: false, order, created_at: '2026-08-01T10:00:00.000Z', ...over })

/** What `resource=start` stores as sessions.items: the agreed plan. */
const itemsFromPlan = (items: { text: string; taskId: string | null; partial?: boolean }[]) =>
  items.map(i => ({ text: i.text, taskId: i.taskId, partial: i.partial ?? false }))

const EMPTY_DEBRIEF: DebriefResult = { doneTaskIds: [], newDone: [], next: [], progress: [] }

const openTexts = (tasks: any[]) =>
  normalizeTaskOrder(tasks).filter(t => !t.done).map(t => t.text)

beforeEach(() => vi.clearAllMocks())

// ── Walk 1 ───────────────────────────────────────────────────────────

describe('Walk 1 — a first session, and the next one picks up where it left off', () => {
  it('plans in stored order, ticks two, and reopens on step three', async () => {
    const row = makeProject({
      metadata: {
        tasks: [
          step('t1', 'Set the drum kit up in the spare room.', 0),
          step('t2', 'Record eight bars of the verse groove.', 1),
          step('t3', 'Track the bass over the verse.', 2),
          step('t4', 'Rough mix the verse.', 3),
        ],
      },
    })

    // ── plan ──
    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    expect(plan.source).toBe('tasks')
    expect(plan.items.length).toBeGreaterThan(0)
    // The plan is the project's own list, in the project's own order.
    expect(plan.items[0].text).toBe('Set the drum kit up in the spare room.')
    expect(plan.items[0].taskId).toBe('t1')
    // Nothing invented: every item points at a real open step.
    const openIds = new Set(row.metadata.tasks.filter((t: any) => !t.done).map((t: any) => t.id))
    for (const it of plan.items) expect(openIds.has(it.taskId!)).toBe(true)

    // ── run: agree the plan, tick the first two ──
    const sessionItems = itemsFromPlan(plan.items)
    const ticked = parseTicked(sessionItems.slice(0, 2))

    // ── close ──
    const out = reconcileCloseout({
      tasks: row.metadata.tasks,
      sessionItems,
      ticked,
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 58,
      debrief: null,
    })
    expect(out.changed).toBe(true)
    expect(out.markedDone).toEqual([
      'Set the drum kit up in the spare room.',
      'Record eight bars of the verse groove.',
    ])
    expect(out.openLeft).toBe(2)
    // Order stays contiguous, which is what makes "the order is the plan"
    // hold across a close-out.
    expect(out.tasks.map(t => t.order)).toEqual([0, 1, 2, 3])
    row.metadata = { ...row.metadata, tasks: out.tasks }

    // ── the next session ──
    const next = await shapeSession(db(row), 'u1', 'p1', 60)
    expect(next.items[0].text).toBe('Track the bass over the verse.')
    expect(next.items[0].taskId).toBe('t3')
    // What's already finished never comes back as something to do.
    expect(next.items.map(i => i.text)).not.toContain('Record eight bars of the verse groove.')
  })
})

// ── Walk 2 ───────────────────────────────────────────────────────────

describe('Walk 2 — what you say at the end changes what you open with', () => {
  it('puts a spoken next step at the front, ahead of the eight already there', async () => {
    const row = makeProject({
      metadata: {
        tasks: [
          step('t1', 'Track the bass over the verse.', 0),
          step('t2', 'Rough mix the verse.', 1),
          step('t3', 'Write the second verse lyric.', 2),
        ],
      },
    })

    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    const sessionItems = itemsFromPlan(plan.items)

    // Ticked the bass. Then said something that names a different finished
    // step AND a new next thing — the unplanned work a session actually
    // produces.
    const debrief: DebriefResult = {
      doneTaskIds: [],
      newDone: ['Re-amped the guitar through the small combo'],
      next: ['Re-record the verse vocal — the take is flat'],
      progress: [],
    }

    const out = reconcileCloseout({
      tasks: row.metadata.tasks,
      sessionItems,
      ticked: parseTicked([sessionItems[0]]),
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 55,
      debrief,
    })

    // Unplanned work still counts as progress.
    expect(out.markedDone).toContain('Track the bass over the verse.')
    expect(out.markedDone).toContain('Re-amped the guitar through the small combo')
    expect(out.nextAdded).toEqual(['Re-record the verse vocal — the take is flat'])
    // The new step is FIRST among the open ones, not appended behind the
    // list that was already there.
    expect(openTexts(out.tasks)[0]).toBe('Re-record the verse vocal — the take is flat')

    row.metadata = { ...row.metadata, tasks: out.tasks }
    row.last_closeout_text = 'Did the bass. Re-amped the guitar. Next: re-record the verse vocal, the take is flat.'

    // ── and the next session opens on it ──
    const next = await shapeSession(db(row), 'u1', 'p1', 60)
    expect(next.items[0].text).toBe('Re-record the verse vocal — the take is flat')
  })
})

// ── Walk 3 ───────────────────────────────────────────────────────────

describe('Walk 3 — a step too big for the hour is progress, never a false done', () => {
  it('records where you got to and reads it back next time', async () => {
    const bigStep = step('t1', 'Mix the whole record.', 0)
    const row = makeProject({
      metadata: { tasks: [bigStep, step('t2', 'Master it.', 1)] },
    })

    // The session showed three pieces of ONE step — what session-split
    // produces. Two of the three got ticked.
    const sessionItems = [
      { text: 'Balance the drums against the bass.', taskId: 't1', partial: true },
      { text: 'Get the vocal sitting on top.', taskId: 't1', partial: true },
      { text: 'Ride the guitars through the chorus.', taskId: 't1', partial: true },
    ]

    const out = reconcileCloseout({
      tasks: row.metadata.tasks,
      sessionItems,
      ticked: parseTicked(sessionItems.slice(0, 2)),
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 60,
      debrief: null,
    })

    // Two of three pieces is not the step.
    expect(out.markedDone).toEqual([])
    expect(out.tasks.find(t => t.id === 't1').done).toBe(false)
    expect(out.tasks.find(t => t.id === 't1').progress_note)
      .toBe('did: Balance the drums against the bass; Get the vocal sitting on top')
    expect(out.progressNoted[0]).toContain('Mix the whole record.')
    expect(out.openLeft).toBe(2)

    row.metadata = { ...row.metadata, tasks: out.tasks }

    // ── next time, the step comes back carrying where you got to ──
    const next = await shapeSession(db(row), 'u1', 'p1', 60)
    const resumed = next.items.find(i => i.taskId === 't1')
    expect(resumed).toBeTruthy()
    expect(resumed!.text).toBe('Mix the whole record.')

    // Ticking the last piece finishes it for real.
    const finish = reconcileCloseout({
      tasks: out.tasks,
      sessionItems,
      ticked: parseTicked(sessionItems),
      endedAt: new Date('2026-09-07T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 60,
      debrief: null,
    })
    expect(finish.markedDone).toEqual(['Mix the whole record.'])
    // A finished step carries no stale "where I got to".
    expect(finish.tasks.find(t => t.id === 't1').progress_note).toBeUndefined()
  })
})

// ── Walk 4 ───────────────────────────────────────────────────────────

describe('Walk 4 — the last step, the finish line, and leaving home', () => {
  it('empties the plan, offers the ending, and drops off the shelf when taken', async () => {
    const row = makeProject({
      metadata: {
        end_goal: 'A finished record, mastered.',
        tasks: [
          step('t1', 'Master it.', 0, { done: true, completed_at: '2026-09-05T20:00:00.000Z' }),
          step('t2', 'Send it to the pressing plant.', 1),
        ],
      },
    })

    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    expect(plan.items.map(i => i.taskId)).toEqual(['t2'])

    const sessionItems = itemsFromPlan(plan.items)
    const out = reconcileCloseout({
      tasks: row.metadata.tasks,
      sessionItems,
      ticked: parseTicked(sessionItems),
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 45,
      debrief: null,
    })

    // The condition the receipt uses to offer an ending at all.
    expect(out.openLeft).toBe(0)
    expect(out.changed).toBe(true)
    expect(out.markedDone.length).toBeGreaterThan(0)

    row.metadata = { ...row.metadata, tasks: out.tasks }
    // The user agrees it's done.
    row.status = 'completed'

    // A completed project leaves the home shelf entirely — it can't be
    // the focus, and it can't sit in the row.
    const { resolveFocusProjectId, warmRow, queueRow } =
      await import('../../src/stores/focusProjectOps.js')
    const projects = [
      { ...row, metadata: row.metadata } as any,
      { id: 'p2', status: 'active', last_active: '2026-09-04T10:00:00.000Z', metadata: {} } as any,
    ]
    expect(resolveFocusProjectId(projects, null)).toBe('p2')
    expect(warmRow(projects, 'p2', null, 2).map(p => p.id)).not.toContain('p1')
    expect(queueRow(projects, 'p2', null, 2).map(p => p.id)).not.toContain('p1')
  })
})

// ── Walk 4b: the same walk, replayed ─────────────────────────────────

describe('Walk 4b — a close-out that gets replayed does not double up', () => {
  it('is idempotent, because the offline queue retries', async () => {
    const row = makeProject({
      metadata: { tasks: [step('t1', 'Send it to the pressing plant.', 0)] },
    })

    // An offline session: nothing was grounded, so every line carries a
    // provisional "pending-" id. Ticking one is what promotes it to a real
    // task -- and a retry after a timeout must not promote it twice.
    const sessionItems = [
      { text: 'Send it to the pressing plant.', taskId: 'pending-1-0', partial: false },
      { text: 'Email the artwork over.', taskId: 'pending-1-1', partial: false },
    ]
    const args = {
      sessionItems,
      ticked: parseTicked(sessionItems),
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 45,
      debrief: null,
    }

    const first = reconcileCloseout({ ...args, tasks: row.metadata.tasks })
    // The line that matched an existing step marked it done rather than
    // adding a second copy of it; the genuinely new one was created.
    expect(first.tasks).toHaveLength(2)
    expect(first.tasks.find(t => t.id === 't1').done).toBe(true)
    expect(first.tasks.filter(t => t.text === 'Email the artwork over.')).toHaveLength(1)

    const replay = reconcileCloseout({ ...args, tasks: first.tasks })
    expect(replay.tasks).toHaveLength(2)
    expect(replay.tasks.map(t => t.text).sort()).toEqual(first.tasks.map(t => t.text).sort())
    expect(replay.tasks.map(t => t.order)).toEqual([0, 1])
  })

  it('leaves the plan readable when the only change is an estimate nudge', () => {
    // The window ran out with the step unticked, so its estimate goes up.
    // That was the one path that set `changed` after the normalise had
    // already happened, writing gapped orders back to the field the whole
    // plan is read from.
    const tasks = [
      step('t1', 'Master it.', 0, { done: true }),
      step('t2', 'Send it off.', 7, { estimate_set: true, estimated_minutes: 20 }),
    ]
    const out = reconcileCloseout({
      tasks,
      sessionItems: [{ text: 'Send it off.', taskId: 't2', partial: false }],
      ticked: [],
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 60,
      debrief: null,
    })
    expect(out.changed).toBe(true)
    expect(out.tasks.find(t => t.id === 't2').estimated_minutes).toBe(30)
    expect(out.tasks.map(t => t.order)).toEqual([0, 1])
  })

  it('does not claim a write when the estimate is already at the ceiling', () => {
    const out = reconcileCloseout({
      tasks: [step('t1', 'Send it off.', 0, { estimate_set: true, estimated_minutes: 60 })],
      sessionItems: [{ text: 'Send it off.', taskId: 't1', partial: false }],
      ticked: [],
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 60,
      debrief: null,
    })
    expect(out.changed).toBe(false)
  })
})

// ── Walk 4c: the shaping edges ───────────────────────────────────────

describe('Walk 4c — what the plan does at its edges', () => {
  it('reads the progress note back as the re-entry line for that step', async () => {
    const row = makeProject({
      metadata: {
        tasks: [step('t1', 'Mix the record.', 0, { progress_note: 'did: balanced the drums' })],
      },
    })
    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    // Not a generic "already on the project" -- your own words about where
    // you got to, on the step they belong to.
    expect(plan.items[0].source).toBe('last time: did: balanced the drums')
    expect(plan.items[0].taskId).toBe('t1')
  })

  it('asks rather than invents when there is nothing left on the list', async () => {
    const row = makeProject({
      metadata: { tasks: [step('t1', 'Master it.', 0, { done: true })] },
    })
    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    expect(plan.source).toBe('derived')
    expect(plan.needsInput).toBeTruthy()
    // Whatever it shows is a placeholder, never a made-up step carrying a
    // task id it doesn't have.
    expect(plan.items.every(i => i.taskId === null)).toBe(true)
  })

  it('says how much of the list it left out rather than silently truncating', async () => {
    const many = Array.from({ length: 12 }, (_, i) => step(`t${i}`, `Step number ${i}.`, i))
    const row = makeProject({ metadata: { tasks: many } })
    const plan = await shapeSession(db(row), 'u1', 'p1', 20)
    expect(plan.items.length).toBeLessThanOrEqual(3)
    expect(plan.truncatedCount).toBeGreaterThan(0)
    expect(plan.items.length + plan.truncatedCount).toBeLessThanOrEqual(12)
  })

  it('plans against the working time, not the whole window', async () => {
    // Painting: ten minutes getting the paints out, ten cleaning brushes.
    // An hour that is really forty minutes has to plan like forty.
    const tasks = Array.from({ length: 6 }, (_, i) =>
      step(`t${i}`, `Step number ${i}.`, i, { estimate_set: true, estimated_minutes: 20 }))
    const plain = makeProject({ metadata: { tasks } })
    const withFriction = makeProject({
      metadata: {
        tasks,
        setup: { text: 'Get the paints out.', minutes: 10 },
        packdown: { text: 'Clean the brushes.', minutes: 10 },
      },
    })
    const full = await shapeSession(db(plain), 'u1', 'p1', 60)
    const trimmed = await shapeSession(db(withFriction), 'u1', 'p1', 60)
    expect(trimmed.items.length).toBeLessThan(full.items.length)
    expect(trimmed.friction?.minutes).toBe(10)
    expect(trimmed.packdown?.minutes).toBe(10)
  })

  it('never offers a step it has already been told is finished', async () => {
    const row = makeProject({
      metadata: {
        tasks: [
          step('t1', 'Done thing.', 0, { done: true }),
          step('t2', 'Open thing.', 1),
          step('t3', 'Another done thing.', 2, { done: true }),
          step('t4', 'Another open thing.', 3),
        ],
      },
    })
    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    expect(plan.items.map(i => i.taskId)).toEqual(['t2', 't4'])
  })
})

// ── Walk 5 ───────────────────────────────────────────────────────────

describe('Walk 5 — a finish line that repeats lands one and lines up the next', () => {
  it('counts the mix, keeps the project alive, and plans from what it took', async () => {
    const row = makeProject({
      title: 'DJ mixes',
      metadata: {
        end_goal: 'a recorded mix',
        cycle: { unit: 'mix', done: 4, history: [] },
        tasks: [
          step('t1', 'Pick the twelve tracks.', 0, { done: true }),
          step('t2', 'Record the mix in one take.', 1),
          step('t3', 'Write the tracklist up.', 2),
        ],
      },
    })

    const plan = await shapeSession(db(row), 'u1', 'p1', 60)
    const sessionItems = itemsFromPlan(plan.items)
    const out = reconcileCloseout({
      tasks: row.metadata.tasks,
      sessionItems,
      ticked: parseTicked(sessionItems),
      endedAt: new Date('2026-09-06T21:00:00.000Z'),
      windowMinutes: 60,
      durationMinutes: 62,
      debrief: null,
    })
    expect(out.openLeft).toBe(0)

    // Reaching a repeating finish line lands THIS one — never "is the
    // project finished?", which would be the wrong question forever.
    const state = readCycleState(row.metadata)!
    expect(state.done).toBe(4)
    const n = state.done + 1
    expect(cycleLabel(state.unit, n)).toBe('Mix 5')

    // "Line up the next one."
    const rolled = rollToNextCycle(
      { ...row.metadata, tasks: out.tasks },
      { closeout: 'Recorded it in one take. Tracklist written up.', now: new Date('2026-09-06T21:05:00.000Z') },
    )

    const after = readCycleState(rolled)!
    expect(after.done).toBe(5)
    // The count is a number of real things made — no cadence, nothing to
    // fall behind on.
    expect(after.history).toHaveLength(1)
    expect(after.history[0].n).toBe(5)
    // What the finished one took is filed, so the next spine plans from a
    // real shape rather than from nothing.
    expect(lastCycleSteps(after)).toEqual([
      'Pick the twelve tracks.',
      'Record the mix in one take.',
      'Write the tracklist up.',
    ])
    // The plan is cleared for the next one, and the project is still alive.
    expect(rolled.tasks.filter((t: any) => !t.done)).toHaveLength(0)
    expect(row.status).toBe('active')

    const { isActiveShaped } = await import('../../src/stores/focusProjectOps.js')
    expect(isActiveShaped({ status: row.status, metadata: rolled })).toBe(true)
  })
})
