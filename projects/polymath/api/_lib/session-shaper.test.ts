import { describe, it, expect } from 'vitest'
import {
  itemCountForWindow,
  isAdminItem,
  sanitizeItems,
  splitBench,
  buildShapePrompt,
  buildEvidence,
  sanitizeFriction,
  BENCH_SIZE,
} from './session-shaper.js'
import type { BudgetTask } from './session-budget.js'

describe('itemCountForWindow', () => {
  it('gives a short window a short list', () => {
    expect(itemCountForWindow(20)).toBe(3)
  })

  it('scales up with the window, capped at 6', () => {
    expect(itemCountForWindow(60)).toBe(5)
    expect(itemCountForWindow(120)).toBe(6)
    expect(itemCountForWindow(600)).toBe(6)
  })

  it('assumes a middling session when the window is unknown', () => {
    expect(itemCountForWindow(null)).toBe(4)
  })

  it('stays in the 3-6 band for every window', () => {
    for (const m of [1, 5, 20, 21, 45, 46, 75, 76, 180]) {
      const n = itemCountForWindow(m)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
    }
  })
})

describe('isAdminItem', () => {
  it('catches admin disguised as build', () => {
    expect(isAdminItem('Research venues for the launch')).toBe(true)
    expect(isAdminItem('Decide on the running order')).toBe(true)
    expect(isAdminItem('Think about the ending')).toBe(true)
  })

  it('sees through bullet and number prefixes', () => {
    expect(isAdminItem('3. Plan the second half')).toBe(true)
    expect(isAdminItem('- review the mix notes')).toBe(true)
  })

  it('leaves real moves alone', () => {
    expect(isAdminItem('Bounce the vocal at -3dB')).toBe(false)
    expect(isAdminItem('Phone the venue and ask for a date')).toBe(false)
  })

  it('does not flag a real verb that merely contains an admin word', () => {
    expect(isAdminItem('Listen back on the phone speaker')).toBe(false)
    expect(isAdminItem('Replant the seedlings')).toBe(false)
  })
})

describe('sanitizeFriction', () => {
  const evidence = [{ id: 'e1', label: 'what this project is', text: 'Producing a DJ mix with two decks' }]

  it('keeps a friction line grounded in real evidence', () => {
    const result = sanitizeFriction({ text: 'Get the decks connected and cued up', minutes: 5 }, evidence, 'DJ mix')
    expect(result).toEqual({ text: 'Get the decks connected and cued up', minutes: 5 })
  })

  it('drops a friction line that invents gear not in the evidence', () => {
    const result = sanitizeFriction({ text: 'Set up the Pioneer CDJ-3000s', minutes: 5 }, evidence, 'DJ mix')
    expect(result).toBeNull()
  })

  it('is null when the model correctly says there is nothing to set up', () => {
    expect(sanitizeFriction(null, evidence, 'DJ mix')).toBeNull()
  })

  it('snaps the minutes onto the shared ladder', () => {
    const result = sanitizeFriction({ text: 'Get the decks connected', minutes: 7 }, evidence, 'DJ mix')
    expect(result?.minutes).toBe(5)
  })

  it('rejects a friction line with no minutes or an over-long text', () => {
    expect(sanitizeFriction({ text: 'Get the decks connected' }, evidence, 'DJ mix')).toBeNull()
    expect(sanitizeFriction({ text: 'x'.repeat(150), minutes: 5 }, evidence, 'DJ mix')).toBeNull()
  })
})

describe('sanitizeItems', () => {
  it('strips bullets and numbering', () => {
    expect(sanitizeItems(['1. Open the file', '- Cut the intro'], 4))
      .toEqual(['Open the file', 'Cut the intro'])
  })

  it('drops admin items, blanks and over-long lines', () => {
    expect(sanitizeItems(
      ['Open the file', '', 'Plan the release', 'x'.repeat(200), 'Cut the intro'],
      6,
    )).toEqual(['Open the file', 'Cut the intro'])
  })

  it('drops near-duplicates that differ only in punctuation or case', () => {
    expect(sanitizeItems(['Cut the intro', 'cut the intro.'], 4)).toEqual(['Cut the intro'])
  })

  it('caps at the window count', () => {
    expect(sanitizeItems(['a move', 'b move', 'c move', 'd move'], 2))
      .toEqual(['a move', 'b move'])
  })

  it('survives anything that is not an array of strings', () => {
    expect(sanitizeItems(null, 4)).toEqual([])
    expect(sanitizeItems('nope', 4)).toEqual([])
    expect(sanitizeItems([1, {}, null], 4)).toEqual([])
  })
})

describe('splitBench', () => {
  it('puts the first N on screen and holds the rest back', () => {
    expect(splitBench(['a', 'b', 'c', 'd', 'e'], 3))
      .toEqual({ items: ['a', 'b', 'c'], bench: ['d', 'e'] })
  })

  it('never benches something already in the list', () => {
    const { items, bench } = splitBench(['a', 'b', 'c', 'd'], 2)
    expect(bench.some(x => items.includes(x))).toBe(false)
  })

  it('gives an empty bench rather than a short list when the pool is thin', () => {
    expect(splitBench(['a', 'b'], 4)).toEqual({ items: ['a', 'b'], bench: [] })
  })
})

describe('buildShapePrompt', () => {
  const base = {
    title: 'Graham song',
    goal: null,
    windowMinutes: 60,
    lastCloseout: null as string | null,
    openTasks: [] as BudgetTask[],
    doneTasks: [] as { text: string; date: string | null }[],
    pastCloseouts: [] as { text: string; date: string | null }[],
    shapingTurns: [] as string[],
    fragments: [] as { text: string; date: string | null }[],
    slots: [] as { name: string; filled: boolean }[],
  }
  const prompt = (ctx: typeof base) => buildShapePrompt(ctx, buildEvidence(ctx).evidence)

  it('asks for the window count plus a bench of spares', () => {
    expect(prompt(base)).toContain(`Give ${5 + BENCH_SIZE} things`)
    expect(prompt(base)).toContain('FIRST 5 are the session')
    expect(prompt({ ...base, windowMinutes: 20 })).toContain(`Give ${3 + BENCH_SIZE} things`)
  })

  it('tells the model the spares are ready to swap in', () => {
    expect(prompt(base)).toContain('ready to swap in')
  })

  it('names the window in minutes so the list is sized to it', () => {
    expect(prompt({ ...base, windowMinutes: 120 })).toContain('120 minutes')
  })

  it('says plainly when it knows nothing about the project', () => {
    expect(prompt(base)).toContain('nothing yet')
  })

  it('hands the model a closed evidence list and says it is closed', () => {
    const p = prompt({ ...base, lastCloseout: 'Next: fix the transition' })
    expect(p).toContain('EVERYTHING KNOWN ABOUT THIS PROJECT')
    expect(p).toContain('[e1] Next: fix the transition')
    expect(p).toContain('Anything not in it, you do not know')
  })

  it('bans invented gear, and shows the exact failure that shipped', () => {
    const p = prompt(base)
    expect(p).toContain('never invent a detail')
    expect(p).toContain('SM57')
    expect(p).toContain('this project has no guitar')
  })

  it('tells the model fewer honest items is the right answer', () => {
    expect(prompt(base)).toContain('Fewer honest items')
  })

  it('asks for citations in the response shape', () => {
    expect(prompt(base)).toContain('"evidence"')
  })

  it('quotes the last close-out back when there is one', () => {
    const p = prompt({ ...base, lastCloseout: 'Next: fix the transition' })
    expect(p).toContain('fix the transition')
  })

  it('carries the reshape instruction and the list it applies to', () => {
    const p = prompt({
      ...base,
      instruction: 'too much admin',
      currentItems: ['Plan the mix', 'Cut the intro'],
    } as any)
    expect(p).toContain('too much admin')
    expect(p).toContain('1. Plan the mix')
    expect(p).toContain("don't\nthrow out items they didn't complain about")
  })

  it('leaves the reshape block out entirely on a first pass', () => {
    expect(prompt(base)).not.toContain('The user says:')
  })

  it('only asks for the shortfall when open tasks already fill part of the window', () => {
    // 2 open tasks against a 60-minute window (needs 5): the model should
    // only be asked for the 3 it's short, not the full 5, and told not to
    // repeat the 2 that are already queued.
    const withTasks = { ...base, openTasks: [{ id: 't1', text: 'a', minutes: 20 as const }, { id: 't2', text: 'b', minutes: 20 as const }] }
    const p = buildShapePrompt(withTasks, buildEvidence(withTasks).evidence)
    expect(p).toContain(`Give ${3 + BENCH_SIZE} NEW things`)
    expect(p).toContain('Do not repeat them')
    expect(p).not.toContain('FIRST 5 are the session')
  })

  it('asks for the full count when open tasks already cover the reshape', () => {
    // A reshape starts over regardless of what's already on the list --
    // it's the user asking for a different take, not more of the same one.
    const withTasks = { ...base, openTasks: [{ id: 't1', text: 'a', minutes: 20 as const }], instruction: 'too admin-y', currentItems: ['x'] }
    const p = buildShapePrompt(withTasks as any, buildEvidence(withTasks).evidence)
    expect(p).toContain(`Give ${5 + BENCH_SIZE} things`)
  })

  it('bans the admin verbs in the prompt, not just in the checker', () => {
    const p = prompt(base)
    for (const v of ['research', 'decide', 'think about', 'brainstorm']) {
      expect(p).toContain(v)
    }
  })

  it('carries the plain-English rules and a concrete anti-example', () => {
    const p = prompt(base)
    expect(p).toContain('BAD:')
    expect(p).toContain('GOOD:')
    expect(p.toLowerCase()).toContain('plain english')
  })

  it('no longer teaches invented specificity as the good example', () => {
    // The old "Good" example was "Bounce the vocal at -3dB and listen back
    // on the phone speaker" -- invented gear settings, presented as the
    // target. The model did exactly as it was shown.
    expect(prompt(base)).not.toContain('-3dB')
  })
})

// A thin stand-in for the bits of the Supabase client shapeSession uses.
// The point of these is the IO wrapper's decisions — which column list it
// asks for, and what it does when a step fails — not the model call.
function stubClient(opts: {
  project?: Record<string, unknown> | null
  projectError?: { message: string } | null
  fragments?: { text: string }[]
  onSelect?: (table: string, columns: string) => void
}) {
  return {
    from(table: string) {
      const chain: any = {
        select(columns: string) {
          opts.onSelect?.(table, columns)
          return chain
        },
        eq: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: opts.fragments ?? [], error: null }),
        single: () =>
          Promise.resolve({
            data: opts.projectError ? null : opts.project ?? null,
            error: opts.projectError ?? null,
          }),
      }
      return chain
    },
  } as any
}

describe('buildEvidence', () => {
  const base = {
    title: 'Graham song', goal: null as string | null, windowMinutes: 60,
    lastCloseout: null as string | null, openTasks: [] as BudgetTask[],
    doneTasks: [] as { text: string; date: string | null }[],
    pastCloseouts: [] as { text: string; date: string | null }[],
    shapingTurns: [] as string[],
    fragments: [] as { text: string; date: string | null }[],
    slots: [] as { name: string; filled: boolean }[],
  }

  it('does not count a machine-seeded slot as something the user said', () => {
    // slot-seed.ts invents these. Counting them made a project the user
    // has never described look like one the app knows — the exact
    // condition under which it starts filling gaps with invention.
    const { evidence } = buildEvidence({ ...base, slots: [{ name: 'first track', filled: false }] })
    expect(evidence).toHaveLength(0)
  })

  it('includes finished work, which used to be filtered out entirely', () => {
    const { evidence } = buildEvidence({ ...base, doneTasks: [{ text: 'record the intro', date: '3 Aug' }] })
    expect(evidence[0].text).toBe('record the intro')
    expect(evidence[0].label).toContain('finished this on 3 Aug')
  })

  it('includes older close-outs, not just the one that overwrote the rest', () => {
    const { evidence } = buildEvidence({
      ...base,
      lastCloseout: 'Got the intro sorted.',
      pastCloseouts: [{ text: 'Laid down a rough vocal.', date: '1 Aug' }],
    })
    expect(evidence.map(e => e.text)).toContain('Laid down a rough vocal.')
  })

  it('includes what the user said when shaping the project', () => {
    const { evidence } = buildEvidence({ ...base, shapingTurns: ['It should sound like the demo but tighter'] })
    expect(evidence[0].text).toContain('sound like the demo')
  })

  it('carries the id of the open task each piece of evidence came from', () => {
    // This is what lets a session item grounded in an open task be traced
    // back to it at close time by id, surviving whatever the model
    // paraphrases the item's wording into.
    const { evidence, taskIdByEvidenceId } = buildEvidence({
      ...base,
      openTasks: [{ id: 'task-7', text: 'Fix the transition out of track two', minutes: 20 as const }],
    })
    const match = evidence.find(e => e.text === 'Fix the transition out of track two')
    expect(match).toBeDefined()
    expect(taskIdByEvidenceId[match!.id]).toBe('task-7')
  })

  it('does not attach a task id to evidence that is not an open task', () => {
    const { evidence, taskIdByEvidenceId } = buildEvidence({ ...base, goal: 'A finished mix' })
    expect(Object.keys(taskIdByEvidenceId)).toHaveLength(0)
    expect(evidence[0].text).toBe('A finished mix')
  })
})

describe('shapeSession', () => {
  const project = {
    title: 'Graham song',
    description: 'a remix',
    metadata: { end_goal: 'released', tasks: [{ id: 't1', text: 'mix it', done: false }] },
    slots: [],
    last_closeout_text: 'Next: fix the transition out of track two.',
  }

  it('only asks for columns that exist on projects', async () => {
    // `goal` is not a column — asking for it failed the whole select and
    // surfaced as "Project not found" for projects that plainly existed.
    const seen: string[] = []
    const { shapeSession } = await import('./session-shaper.js')
    await shapeSession(
      stubClient({ project, onSelect: (t, c) => { if (t === 'projects') seen.push(c) } }),
      'u1', 'p1', 60,
    )
    const known = new Set([
      'id', 'user_id', 'title', 'description', 'type', 'status', 'metadata',
      'slots', 'last_closeout_text', 'last_session_ended_at', 'mvs_minutes',
      'state', 'last_active',
    ])
    expect(seen).toHaveLength(1)
    for (const col of seen[0].split(',').map(c => c.trim())) {
      expect(known.has(col), `unknown projects column: ${col}`).toBe(true)
    }
  })

  it('falls back to the derived list when the model is unavailable', async () => {
    // No GEMINI_API_KEY in the test env, so generateText throws — which is
    // exactly the path that must still hand back a usable session.
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project }), 'u1', 'p1', 60)
    expect(result.source).toBe('derived')
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.map(i => i.text).join(' ')).toContain('fix the transition out of track two.')
  })

  it('surfaces a database error instead of claiming the project is missing', async () => {
    const { shapeSession } = await import('./session-shaper.js')
    await expect(
      shapeSession(stubClient({ projectError: { message: 'column does not exist' } }), 'u1', 'p1', 60),
    ).rejects.toThrow('column does not exist')
  })

  it('shapes the session straight from the task list when it already has enough, with no model call', async () => {
    // 5 tasks estimated at 20 minutes each (the default) is exactly
    // itemCountForWindow(60)'s target -- but at 20 minutes a task, a
    // 60-minute window only actually fits 3, and the budget is what
    // decides, not the raw count.
    const withFullBacklog = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, text: `step ${i}`, done: false, order: i })),
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: withFullBacklog }), 'u1', 'p1', 60)
    expect(result.source).toBe('tasks')
    expect(result.items.map(i => i.text)).toEqual(['step 0', 'step 1', 'step 2'])
    expect(result.items.every(i => i.taskId)).toBe(true)
    expect(result.bench.map(i => i.text)).toEqual(['step 3', 'step 4', 'step 5', 'step 6'])
    expect(result.needsInput).toBeNull()
    expect(result.friction).toBeNull()
    expect(result.truncatedCount).toBe(0)
  })

  it('takes the full count when real estimates say they all fit the window', async () => {
    const withEstimates = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: Array.from({ length: 7 }, (_, i) => ({
          id: `t${i}`, text: `step ${i}`, done: false, order: i,
          estimated_minutes: 10, estimate_set: true,
        })),
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: withEstimates }), 'u1', 'p1', 60)
    // itemCountForWindow(60) === 5; 5 * 10min = 50min, fits inside 60.
    expect(result.items).toHaveLength(5)
    expect(result.items.map(i => i.text)).toEqual(['step 0', 'step 1', 'step 2', 'step 3', 'step 4'])
  })

  it('lets two big real tasks fill the window without padding to the count ceiling', async () => {
    const withBigTasks = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: [
          { id: 't0', text: 'big one', done: false, order: 0, estimated_minutes: 30, estimate_set: true },
          { id: 't1', text: 'big two', done: false, order: 1, estimated_minutes: 30, estimate_set: true },
          { id: 't2', text: 'small extra', done: false, order: 2, estimated_minutes: 15, estimate_set: true },
        ],
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: withBigTasks }), 'u1', 'p1', 60)
    expect(result.source).toBe('tasks')
    expect(result.items.map(i => i.text)).toEqual(['big one', 'big two'])
    expect(result.bench.map(i => i.text)).toEqual(['small extra'])
  })

  it('offers every leftover open task as a swap-in, not a re-cycled reject capped at 3', async () => {
    // The old bench was capped at BENCH_SIZE because generating spares cost
    // a model call. Real tasks already on the list cost nothing to offer,
    // so the whole remaining backlog is fair game for a swap.
    const withFullBacklog = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: Array.from({ length: 8 }, (_, i) => ({
          id: `t${i}`, text: `step ${i}`, done: false, order: i,
          estimated_minutes: 5, estimate_set: true,
        })),
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: withFullBacklog }), 'u1', 'p1', 20)
    // itemCountForWindow(20) === 3, and 3 * 5min easily fits 20.
    expect(result.items.map(i => i.text)).toEqual(['step 0', 'step 1', 'step 2'])
    expect(result.bench.map(i => i.text)).toEqual(['step 3', 'step 4', 'step 5', 'step 6', 'step 7'])
  })

  it('respects manual drag-reorder over array position', async () => {
    const reordered = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: [
          { id: 't0', text: 'stored first', done: false, order: 1, estimated_minutes: 30, estimate_set: true },
          { id: 't1', text: 'stored second', done: false, order: 0, estimated_minutes: 30, estimate_set: true },
        ],
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: reordered }), 'u1', 'p1', 60)
    expect(result.items.map(i => i.text)).toEqual(['stored second', 'stored first'])
  })

  it('reports how much of the backlog was truncated rather than silently dropping it', async () => {
    const bigBacklog = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: Array.from({ length: 30 }, (_, i) => ({
          id: `t${i}`, text: `step ${i}`, done: false, order: i,
          estimated_minutes: 5, estimate_set: true,
        })),
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: bigBacklog }), 'u1', 'p1', 20)
    expect(result.truncatedCount).toBe(6) // 30 open tasks, 24-task ceiling
  })
})
