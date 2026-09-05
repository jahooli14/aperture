import { describe, it, expect } from 'vitest'
import { buildReadyPrompt, sanitizeReadiness, checkReady, type ReadyInput } from './session-ready.js'
import type { Evidence } from './session-grounding.js'

const evidence: Evidence[] = [
  { id: 'e1', label: 'what this project is', text: 'A paint-poured print with a stencil, for the hallway' },
  { id: 'e2', label: 'from your note on 1 Sep', text: 'The stencil kept sliding, need to tape it to the board' },
]

const INPUT: ReadyInput = {
  title: 'Paint pouring stencil',
  step: { id: 't2', text: 'Pour the paint over the stencil', minutes: 20 },
  laterSteps: [{ id: 't3', text: 'Let it dry and peel the stencil off', minutes: 10 }],
  evidence,
}

describe('buildReadyPrompt', () => {
  const p = buildReadyPrompt(INPUT)

  it('asks the one question about the one step', () => {
    expect(p).toContain('"Pour the paint over the stencil"')
    expect(p).toContain('does something else have to be\nfinished first')
  })

  it('biases hard toward ready, and says why', () => {
    expect(p).toContain('READY IS THE NORMAL ANSWER')
    expect(p).toContain('wastes the hour')
  })

  it('rules out getting-ready as a blocker', () => {
    expect(p).toContain('NOT blockers, ever')
    expect(p).toContain('gathering things, setting up')
    expect(p).toContain("That's just starting")
  })

  it('offers the rest of the list so an existing step can be pointed at, not duplicated', () => {
    expect(p).toContain('[t3] Let it dry and peel the stencil off')
    expect(p).toContain("don't write it out again")
  })

  it('says plainly when there is nothing else on the list', () => {
    expect(buildReadyPrompt({ ...INPUT, laterSteps: [] })).toContain('(nothing else on the list)')
  })

  it('carries the no-invention rule and a worked both-ways example', () => {
    expect(p).toContain("doesn't appear word for word above")
    expect(p).toContain('you invented it, and the answer is ready')
  })

  it('asks for a size and a compound judgment on the step itself, with a worked both-ways example', () => {
    expect(p).toContain('size_minutes')
    expect(p).toContain('compound')
    expect(p).toContain('"Design and cut the stencil"')
    expect(p).toContain('Remix the track with a cleaner vocal, a new riff, and write')
    expect(p).toContain('a distribution plan')
  })
})

describe('sanitizeReadiness', () => {
  it('is ready when the model says ready', () => {
    expect(sanitizeReadiness({ verdict: 'ready', blocker: null }, INPUT))
      .toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('keeps a real, grounded blocker and marks it as needed before the step', () => {
    const out = sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'Tape the stencil down to the board', evidence: ['e2'], estimated_minutes: 10 } },
      INPUT,
    )
    expect(out).toEqual({
      kind: 'add',
      item: {
        text: 'Tape the stencil down to the board',
        source: 'needed before: Pour the paint over the stencil',
        taskId: null,
      },
      minutes: 10,
      sizeMinutes: null,
      compound: false,
    })
  })

  it('moves an existing step up instead of duplicating it, when the model cites its id', () => {
    const out = sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'anything', existing_task_id: 't3' } },
      INPUT,
    )
    expect(out).toEqual({ kind: 'move', taskId: 't3', text: 'Let it dry and peel the stencil off', sizeMinutes: null, compound: false })
  })

  it('moves an existing step up even when the model forgot to cite its id', () => {
    const out = sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'Let the piece dry and peel the stencil off', evidence: ['e1'] } },
      INPUT,
    )
    expect(out).toMatchObject({ kind: 'move', taskId: 't3' })
  })

  it('refuses admin dressed as a prerequisite — the failure this check invites', () => {
    for (const text of ['Set up your workspace', 'Gather the materials', 'Decide on the colours', 'Plan the pour']) {
      expect(sanitizeReadiness(
        { verdict: 'blocked', blocker: { text, evidence: ['e1'] } },
        INPUT,
      ), text).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
    }
  })

  it('refuses a blocker that just restates the step', () => {
    expect(sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'Pour paint over the stencil', evidence: ['e1'] } },
      INPUT,
    )).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('refuses a blocker that invents gear nobody mentioned', () => {
    expect(sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'Lay down the Olfa cutting mat', evidence: ['e1'] } },
      INPUT,
    )).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('refuses an uncited blocker that asserts something specific', () => {
    expect(sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'Prime the plywood board with gesso', evidence: [] } },
      INPUT,
    )).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('refuses junk, an essay, or a missing blocker', () => {
    expect(sanitizeReadiness(null, INPUT)).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
    expect(sanitizeReadiness({ verdict: 'blocked' }, INPUT)).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
    expect(sanitizeReadiness({ verdict: 'blocked', blocker: { text: '' } }, INPUT)).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
    expect(sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'x'.repeat(200), evidence: ['e1'] } },
      INPUT,
    )).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('falls back to the neutral estimate when the model gives none', () => {
    const out = sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'Tape the stencil down to the board', evidence: ['e2'] } },
      INPUT,
    )
    expect(out).toMatchObject({ kind: 'add', minutes: 20 })
  })

  it('carries a size and compound judgment even on a ready verdict -- sizing is independent of the blocker check', () => {
    const out = sanitizeReadiness({ verdict: 'ready', blocker: null, size_minutes: 90, compound: true }, INPUT)
    expect(out).toEqual({ kind: 'ready', sizeMinutes: 60, compound: true })
  })

  it('snaps size_minutes to the nearest rung on the shared estimate ladder', () => {
    expect(sanitizeReadiness({ verdict: 'ready', blocker: null, size_minutes: 22 }, INPUT).sizeMinutes).toBe(20)
  })

  it('defaults sizeMinutes to null and compound to false when absent or malformed', () => {
    expect(sanitizeReadiness({ verdict: 'ready', blocker: null }, INPUT)).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
    expect(sanitizeReadiness({ verdict: 'ready', blocker: null, size_minutes: 'a lot', compound: 'yes' }, INPUT))
      .toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('carries the size and compound judgment alongside a move or add verdict too', () => {
    const moved = sanitizeReadiness(
      { verdict: 'blocked', blocker: { text: 'anything', existing_task_id: 't3' }, size_minutes: 45, compound: true },
      INPUT,
    )
    expect(moved).toMatchObject({ kind: 'move', sizeMinutes: 45, compound: true })

    const added = sanitizeReadiness(
      {
        verdict: 'blocked',
        blocker: { text: 'Tape the stencil down to the board', evidence: ['e2'], estimated_minutes: 10 },
        size_minutes: 30,
        compound: true,
      },
      INPUT,
    )
    expect(added).toMatchObject({ kind: 'add', sizeMinutes: 30, compound: true })
  })
})

describe('checkReady', () => {
  it('is ready when there is no evidence to check against — never a guess', async () => {
    expect(await checkReady({ ...INPUT, evidence: [] })).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })

  it('is ready when the model is unreachable', async () => {
    // No GEMINI_API_KEY in the test env. A missed prerequisite costs one
    // awkward session; an invented one rewrites the plan.
    expect(await checkReady(INPUT)).toEqual({ kind: 'ready', sizeMinutes: null, compound: false })
  })
})
