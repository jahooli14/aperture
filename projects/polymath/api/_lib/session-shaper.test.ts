import { describe, it, expect } from 'vitest'
import {
  itemCountForWindow,
  isAdminItem,
  sanitizeItems,
  buildReshapePrompt,
  buildEvidence,
  sanitizeFriction,
  dedupeSimilar,
  humanizeDuration,
  type ShapeContext,
} from './session-shaper.js'

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

describe('dedupeSimilar', () => {
  it('drops a later item that is really a restatement of an earlier one', () => {
    const items = [
      { text: 'Fix the transition out of track two' },
      { text: 'Fix the transition between the two tracks' },
      { text: 'Try a new riff over the chorus' },
    ]
    expect(dedupeSimilar(items).map(i => i.text)).toEqual([
      'Fix the transition out of track two',
      'Try a new riff over the chorus',
    ])
  })

  it('keeps two genuinely different tasks that merely share one topic word', () => {
    const items = [{ text: 'Record the vocal' }, { text: 'Record the guitar solo' }]
    expect(dedupeSimilar(items)).toHaveLength(2)
  })
})

describe('sanitizeFriction', () => {
  const evidence = [{ id: 'e1', label: 'what this project is', text: 'Producing a DJ mix with two decks' }]

  it('keeps a friction line grounded in real evidence', () => {
    const result = sanitizeFriction({ text: 'Get the decks connected and cued up', minutes: 5 }, evidence, 'DJ mix')
    expect(result).toEqual({ text: 'Get the decks connected and cued up', minutes: 5 })
  })

  it('drops a friction line that invents gear not in the evidence', () => {
    expect(sanitizeFriction({ text: 'Set up the Pioneer CDJ-3000s', minutes: 5 }, evidence, 'DJ mix')).toBeNull()
  })

  it('is null when the model correctly says there is nothing to set up', () => {
    expect(sanitizeFriction(null, evidence, 'DJ mix')).toBeNull()
  })
})

describe('sanitizeItems', () => {
  it('strips bullets and numbering', () => {
    expect(sanitizeItems(['1. Open the file', '- Cut the intro'], 4)).toEqual(['Open the file', 'Cut the intro'])
  })

  it('drops admin items, blanks and over-long lines', () => {
    expect(sanitizeItems(['Open the file', '', 'Plan the release', 'x'.repeat(200), 'Cut the intro'], 6))
      .toEqual(['Open the file', 'Cut the intro'])
  })

  it('survives anything that is not an array of strings', () => {
    expect(sanitizeItems(null, 4)).toEqual([])
    expect(sanitizeItems([1, {}, null], 4)).toEqual([])
  })
})

const base: ShapeContext = {
  title: 'Graham song',
  goal: null,
  windowMinutes: 60,
  lastCloseout: null,
  openTasks: [],
  doneTasks: [],
  pastCloseouts: [],
  shapingTurns: [],
  fragments: [],
  recalled: [],
  dormancyDays: 0,
  heatReason: null,
  identityLine: null,
}

describe('buildEvidence', () => {
  it('includes finished work, older close-outs and the shaping chat', () => {
    const { evidence } = buildEvidence({
      ...base,
      lastCloseout: 'Got the intro sorted.',
      pastCloseouts: [{ text: 'Laid down a rough vocal.', date: '1 Aug' }],
      doneTasks: [{ text: 'record the intro', date: '3 Aug' }],
      shapingTurns: ['It should sound like the demo but tighter'],
    })
    const texts = evidence.map(e => e.text)
    expect(texts).toContain('Laid down a rough vocal.')
    expect(texts).toContain('record the intro')
    expect(texts).toContain('It should sound like the demo but tighter')
  })

  it('carries the id of the open step each piece of evidence came from', () => {
    const { evidence, taskIdByEvidenceId } = buildEvidence({
      ...base,
      openTasks: [{ id: 'task-7', text: 'Fix the transition out of track two', minutes: 20, progressNote: null }],
    })
    const match = evidence.find(e => e.text === 'Fix the transition out of track two')
    expect(match).toBeDefined()
    expect(taskIdByEvidenceId[match!.id]).toBe('task-7')
  })

  it('lists where the user got to on a step, tied to that step', () => {
    const { evidence, taskIdByEvidenceId } = buildEvidence({
      ...base,
      openTasks: [{ id: 'task-7', text: 'Cut the stencil', minutes: 60, progressNote: 'outline drawn, nothing cut yet' }],
    })
    const note = evidence.find(e => e.text === 'outline drawn, nothing cut yet')
    expect(note).toBeDefined()
    expect(note!.label).toContain('where you got to on "Cut the stencil"')
    expect(taskIdByEvidenceId[note!.id]).toBe('task-7')
  })

  it('makes a live reshape instruction its own citable evidence entry', () => {
    const { evidence } = buildEvidence({ ...base, instruction: 'I want to listen to the song, then plan the new riff' })
    const match = evidence.find(e => e.text.includes('listen to the song'))
    expect(match).toBeDefined()
    expect(match!.label).toBe('what you just said')
  })

  it('cites a recalled capture that never got attached to this project', () => {
    const { evidence } = buildEvidence({
      ...base,
      recalled: [{ text: 'Bought a new mic for the vocal booth', date: '5 Sep' }],
    })
    const match = evidence.find(e => e.text === 'Bought a new mic for the vocal booth')
    expect(match).toBeDefined()
    expect(match!.label).toBe('a capture from 5 Sep that connects')
  })

  it('cites heat_reason as evidence when the project has a fresh signal', () => {
    const { evidence } = buildEvidence({
      ...base,
      heatReason: 'you mentioned this recently — "the new riff idea"',
    })
    const match = evidence.find(e => e.text === 'you mentioned this recently — "the new riff idea"')
    expect(match).toBeDefined()
    expect(match!.label).toBe('something new since you were last here')
  })

  it('says nothing about freshness when there is none to cite', () => {
    const { evidence } = buildEvidence(base)
    expect(evidence.find(e => e.label === 'something new since you were last here')).toBeUndefined()
    expect(evidence.find(e => e.label.includes('that connects'))).toBeUndefined()
  })
})

describe('humanizeDuration', () => {
  it('says weeks under two months', () => {
    expect(humanizeDuration(7)).toBe('a week')
    expect(humanizeDuration(21)).toBe('3 weeks')
  })

  it('says months under a year', () => {
    expect(humanizeDuration(75)).toBe('2 months')
    expect(humanizeDuration(300)).toBe('10 months')
  })

  it('says years at a year and beyond', () => {
    expect(humanizeDuration(365)).toBe('a year')
    expect(humanizeDuration(800)).toBe('2 years')
  })
})

describe('buildReshapePrompt', () => {
  const ctx: ShapeContext = {
    ...base,
    openTasks: [
      { id: 't1', text: 'Design and cut the stencil', minutes: 60, progressNote: null },
      { id: 't2', text: 'Pour the paint over it', minutes: 20, progressNote: null },
    ],
    instruction: 'too much for an hour',
    currentItems: ['Design and cut the stencil', 'Pour the paint over it'],
  }
  const prompt = (c = ctx) => buildReshapePrompt(c, buildEvidence(c).evidence)

  it('carries the instruction and the list it applies to', () => {
    const p = prompt()
    expect(p).toContain('too much for an hour')
    expect(p).toContain('1. Design and cut the stencil')
    expect(p).toContain("don't\nthrow out items they didn't complain about")
  })

  it('hands the model a closed evidence list, with the steps in order, and says it is closed', () => {
    const p = prompt()
    expect(p).toContain('EVERYTHING KNOWN ABOUT THIS PROJECT')
    expect(p).toContain('Anything not in it, you do not know')
    expect(p.indexOf('Design and cut the stencil')).toBeLessThan(p.indexOf('Pour the paint over it'))
    expect(p).toContain('in the\norder they\'re meant to be done')
  })

  it('lets the model reorder, split and drop, but never invent a step', () => {
    const p = prompt()
    expect(p).toContain('Reorder, drop, or keep')
    expect(p).toContain('Split one step')
    expect(p).toContain('Invent a step')
    expect(p).toContain("If you can't cite it, you can't say it")
  })

  it('bans putting a step before one it depends on', () => {
    expect(prompt()).toContain('cannot come before "cut the stencil"')
  })

  it('tells the model to cite the live instruction for anything that came from it', () => {
    expect(prompt()).toContain('citing "what you just said"')
  })

  it('bans invented gear, and shows the exact failure that shipped', () => {
    const p = prompt()
    expect(p).toContain('SM57')
    expect(p).toContain('BAD:')
    expect(p).toContain('GOOD:')
  })

  it('asks what done looks like and for an honest friction line', () => {
    const p = prompt()
    expect(p).toContain('done_looks_like')
    expect(p).toContain('friction')
    expect(p).toContain('A made-up setup step is worse than none')
  })

  it('names how long it has been quiet once it is a week or more', () => {
    expect(prompt()).not.toContain('since the last session')
    expect(prompt({ ...ctx, dormancyDays: 3 })).not.toContain('since the last session')
    expect(prompt({ ...ctx, dormancyDays: 21 })).toContain("it's been 3 weeks since the last session")
  })

  it('carries the identity line as tone, never inside the evidence block', () => {
    const withIdentity = { ...ctx, identityLine: 'Just for tone, not something to plan around: they’ve recently been into "Flowers for Algernon".' }
    const p = prompt(withIdentity)
    expect(p).toContain('Just for tone, not something to plan around')
    expect(p.indexOf('Just for tone')).toBeLessThan(p.indexOf('EVERYTHING KNOWN ABOUT THIS PROJECT'))
    // Never citable: buildEvidence never turns identityLine into an [eN] entry.
    expect(buildEvidence(withIdentity).evidence.some(e => e.text.includes('Flowers for Algernon'))).toBe(false)
  })

  it('says nothing extra when there is no identity signal', () => {
    expect(prompt()).not.toContain('Just for tone')
  })

  it('sizes the list to the window', () => {
    expect(prompt()).toContain('Up to 5 items')
    expect(prompt({ ...ctx, windowMinutes: 20 })).toContain('Up to 3 items')
    expect(prompt({ ...ctx, windowMinutes: 120 })).toContain('120 minutes')
  })

  it('carries the plain-English rules', () => {
    expect(prompt().toLowerCase()).toContain('plain english')
  })
})

// A thin stand-in for the bits of the Supabase client shapeSession uses.
// The point of these is the IO wrapper's decisions — which column list it
// asks for, what it does when a step fails, and which of the four paths it
// takes — not the model call (there is no API key in the test env, so
// every model path fails, which is exactly the fallback worth testing).
function stubClient(opts: {
  project?: Record<string, unknown> | null
  projectError?: { message: string } | null
  fragments?: { text: string }[]
  recalled?: { id: string; body?: string; title?: string; created_at: string }[]
  onSelect?: (table: string, columns: string) => void
  onUpdate?: (payload: Record<string, unknown>) => void
}) {
  return {
    from(table: string) {
      const chain: any = {
        select(columns: string) {
          opts.onSelect?.(table, columns)
          return chain
        },
        update(payload: Record<string, unknown>) {
          opts.onUpdate?.(payload)
          const updateChain: any = { eq: () => updateChain, then: (resolve: any) => resolve({ error: null }) }
          return updateChain
        },
        eq: () => chain,
        not: () => chain,
        in: () => chain,
        order: () => chain,
        // fragments/sessions/list_items/article_highlights all resolve through
        // here -- `opts.fragments` doubles as whichever table's rows the test
        // cares about; the others default to empty, which the shaper already
        // treats as "nothing to add" for recall/identity.
        limit: () => Promise.resolve({ data: table === 'fragments' ? (opts.fragments ?? []) : [], error: null }),
        single: () =>
          Promise.resolve({
            data: opts.projectError ? null : opts.project ?? null,
            error: opts.projectError ?? null,
          }),
      }
      return chain
    },
    rpc: (_fn: string, _params: Record<string, unknown>) =>
      Promise.resolve({ data: opts.recalled ?? [], error: null }),
  } as any
}

describe('shapeSession', () => {
  const project = {
    title: 'Graham song',
    description: 'a remix',
    metadata: { end_goal: 'released', tasks: [{ id: 't1', text: 'mix it', done: false, order: 0 }] },
    slots: [],
    last_closeout_text: 'Next: fix the transition out of track two.',
  }

  it('only asks for columns that exist on projects', async () => {
    const seen: string[] = []
    const { shapeSession } = await import('./session-shaper.js')
    await shapeSession(
      stubClient({ project, onSelect: (t, c) => { if (t === 'projects') seen.push(c) } }),
      'u1', 'p1', 60,
    )
    const known = new Set([
      'id', 'user_id', 'title', 'description', 'type', 'status', 'metadata',
      'slots', 'last_closeout_text', 'last_session_ended_at', 'mvs_minutes',
      'state', 'last_active', 'created_at', 'embedding', 'heat_reason',
    ])
    expect(seen).toHaveLength(1)
    for (const col of seen[0].split(',').map(c => c.trim())) {
      expect(known.has(col), `unknown projects column: ${col}`).toBe(true)
    }
  })

  it('surfaces a database error instead of claiming the project is missing', async () => {
    const { shapeSession } = await import('./session-shaper.js')
    await expect(
      shapeSession(stubClient({ projectError: { message: 'column does not exist' } }), 'u1', 'p1', 60),
    ).rejects.toThrow('column does not exist')
  })

  it('shapes the session from the next real steps, in order, with no model call', async () => {
    const withBacklog = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, text: `step ${i}`, done: false, order: i })),
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: withBacklog }), 'u1', 'p1', 60)
    expect(result.source).toBe('tasks')
    // 20-minute default estimates: three fit an hour.
    expect(result.items.map(i => i.text)).toEqual(['step 0', 'step 1', 'step 2'])
    expect(result.items.every(i => i.taskId && i.partial === false)).toBe(true)
    expect(result.doneLooksLike).toBe('Through to "step 2".')
    expect(result.needsInput).toBeNull()
    expect(result.planned).toBe(0)
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

  it('reads back where the user got to on a step, instead of restarting it', async () => {
    const partWay = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: [{ id: 't0', text: 'Cut the stencil', done: false, order: 0, progress_note: 'outline drawn' }],
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: partWay }), 'u1', 'p1', 60)
    expect(result.items[0].source).toBe('last time: outline drawn')
  })

  it('falls back to the whole step when a split is needed but the model is unreachable', async () => {
    // A 60-minute step in a 20-minute window wants a split; with no model
    // the honest answer is the step itself, said plainly, not nothing.
    const bigStep = {
      ...project,
      metadata: {
        end_goal: 'released',
        tasks: [{ id: 't0', text: 'Design and cut the stencil', done: false, order: 0, estimated_minutes: 60, estimate_set: true }],
      },
    }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: bigStep }), 'u1', 'p1', 20)
    expect(result.source).toBe('tasks')
    expect(result.items.map(i => i.text)).toEqual(['Design and cut the stencil'])
    expect(result.doneLooksLike).toBe('"Design and cut the stencil" ticked off.')
  })

  it('asks for the first real thing, never for a finish line, when there is nothing to plan from', async () => {
    const empty = { ...project, metadata: { tasks: [] }, last_closeout_text: null, description: null }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: empty }), 'u1', 'p1', 60)
    expect(result.source).toBe('derived')
    expect(result.needsInput).toContain('first thing that has to exist')
    expect(result.gap?.kind).toBe('first_step')
  })

  it('plans the steps first when the list is spent, with or without a finish line', async () => {
    // The generation call fails here (no model), so nothing gets saved --
    // the point is that it TRIES on a project with no end_goal too, which
    // it used to skip entirely.
    const spent = {
      ...project,
      metadata: { tasks: [{ id: 't1', text: 'mix it', done: true, order: 0 }] },
    }
    const updates: Record<string, unknown>[] = []
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(stubClient({ project: spent, onUpdate: p => updates.push(p) }), 'u1', 'p1', 60)
    expect(updates).toHaveLength(0)
    expect(result.source).toBe('derived')
    expect(result.planned).toBe(0)
  })

  it('takes the semantic-recall path without throwing when the project has an embedding', async () => {
    // Exercises the match_memories RPC branch (recallEmbeddingStr set) rather
    // than the no-embedding fallback every other test above takes.
    const withEmbedding = { ...project, embedding: [0.1, 0.2, 0.3] }
    const recentUnattached = { id: 'm1', body: 'Bought a new mic', created_at: new Date().toISOString() }
    const { shapeSession } = await import('./session-shaper.js')
    const result = await shapeSession(
      stubClient({ project: withEmbedding, recalled: [recentUnattached] }),
      'u1', 'p1', 60,
    )
    expect(result.source).toBe('tasks')
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
    expect(result.truncatedCount).toBe(6)
  })

  it('throws on a reshape the model cannot serve, so the list on screen stays put', async () => {
    const { shapeSession } = await import('./session-shaper.js')
    await expect(
      shapeSession(stubClient({ project }), 'u1', 'p1', 60, 'too much', ['mix it']),
    ).rejects.toThrow()
  })
})
