import { describe, it, expect } from 'vitest'
import {
  buildSpinePrompt,
  buildEvidenceFromSaid,
  buildFirstCutPrompt,
  buildFirstCutEvidence,
  sanitizeSteps,
  assembleSteps,
  toStoredTasks,
  MIN_SPINE_STEPS,
  MAX_SPINE_STEPS,
  FIRST_CUT_STEPS,
  type SpineInput,
  type FirstCutInput,
} from './task-spine.js'

const SAID = [
  "It's a song for Graham's 40th, I've got a rough vocal down already.",
  'Wants to be finished before the party in November.',
]
const INPUT: SpineInput = {
  title: 'Graham song',
  endGoal: 'A finished mix sent to Graham before the party',
  said: SAID,
}

describe('buildEvidenceFromSaid', () => {
  it('puts the finish line first — everything plans backwards from it', () => {
    const ev = buildEvidenceFromSaid(INPUT.title, INPUT.endGoal, SAID)
    expect(ev[0].text).toContain('finished mix sent to Graham')
    expect(ev[0].label).toContain('finish line')
  })

  it('is empty when nothing has been said and there is no goal', () => {
    expect(buildEvidenceFromSaid('Untitled', null, [])).toEqual([])
  })
})

describe('buildSpinePrompt', () => {
  const prompt = (i = INPUT) => buildSpinePrompt(i, buildEvidenceFromSaid(i.title, i.endGoal, i.said))

  it('tells the model to plan backwards, and why', () => {
    const p = prompt()
    expect(p).toContain('work backwards')
    expect(p).toContain('Start at "done" and ask what had to be true immediately before it')
    expect(p).toContain('Planning forwards from nothing')
  })

  it('states the finish line it is planning back from', () => {
    expect(prompt()).toContain('DONE MEANS: A finished mix sent to Graham')
  })

  it('says plainly when there is no finish line to plan from', () => {
    expect(prompt({ ...INPUT, endGoal: null })).toContain('has not said what done looks like')
  })

  it('hands over a closed evidence list and says it is closed', () => {
    const p = prompt()
    expect(p).toContain("[e2] It's a song for Graham's 40th")
    expect(p).toContain('Anything not in it, you do not know')
  })

  it('asks for a spine, not a backlog or a three-item stub', () => {
    expect(prompt()).toContain(`Give ${MIN_SPINE_STEPS}-${MAX_SPINE_STEPS} steps`)
    expect(prompt()).toContain('one to three sittings')
  })

  it('carries the same no-invented-specifics rule as session items', () => {
    const p = prompt()
    expect(p).toContain('this project has no guitar')
    expect(p).toContain("if you can't cite it, you can't say it")
  })

  it('bans admin dressed up as building', () => {
    const p = prompt()
    for (const v of ['research', 'decide', 'brainstorm', 'think about']) expect(p).toContain(v)
  })

  it('keeps steps the user already agreed to when re-planning', () => {
    const p = prompt({ ...INPUT, existingSteps: ['Record the second verse'] })
    expect(p).toContain('STEPS ALREADY AGREED')
    expect(p).toContain('Record the second verse')
  })

  it('leaves the re-plan block out on a first pass', () => {
    expect(prompt()).not.toContain('STEPS ALREADY AGREED')
  })

  it('asks for a one-sitting time estimate off the shared ladder', () => {
    const p = prompt()
    expect(p).toContain('estimated_minutes')
    expect(p).toContain('5, 10, 15, 20, 30, 45, 60')
  })

  it('makes the order a rule, with the stencil case as the anti-example', () => {
    const p = prompt()
    expect(p).toContain('THE ORDER IS THE PLAN')
    expect(p).toContain('nothing to peel off until the stencil exists')
    expect(p).toContain('"after"')
  })
})

describe('assembleSteps', () => {
  it('puts a step below the ones it says it comes after, even if the model wrote it first', () => {
    const cleaned = sanitizeSteps([
      { text: 'Let it dry and peel the stencil off', after: [2, 3], estimated_minutes: 10 },
      { text: 'Design and cut the stencil', after: [], estimated_minutes: 60 },
      { text: 'Pour the paint over it', after: [2], estimated_minutes: 20 },
    ])
    const kept = cleaned.map(c => ({ text: c.text, source: null }))
    expect(assembleSteps(cleaned, kept).map(s => s.text)).toEqual([
      'Design and cut the stencil',
      'Pour the paint over it',
      'Let it dry and peel the stencil off',
    ])
  })

  it('keeps each step’s estimate through the reorder', () => {
    const cleaned = sanitizeSteps([
      { text: 'b', after: [2], estimated_minutes: 10 },
      { text: 'a', after: [], estimated_minutes: 45 },
    ])
    const out = assembleSteps(cleaned, cleaned.map(c => ({ text: c.text, source: null })))
    expect(out.map(s => [s.text, s.estimatedMinutes])).toEqual([['a', 45], ['b', 10]])
  })

  it('ignores a dependency on a step grounding dropped', () => {
    const cleaned = sanitizeSteps([{ text: 'invented one' }, { text: 'real one', after: [1] }])
    const kept = [{ text: 'real one', source: null }]
    expect(assembleSteps(cleaned, kept).map(s => s.text)).toEqual(['real one'])
  })
})

describe('buildFirstCutEvidence', () => {
  it('anchors on the description, not a finish line', () => {
    const ev = buildFirstCutEvidence('Producing my first track', 'Making original tracks, not just DJing.', [])
    expect(ev[0].text).toBe('Making original tracks, not just DJing.')
    expect(ev[0].label).toBe('what this project is')
  })

  it('is empty with no description and nothing said', () => {
    expect(buildFirstCutEvidence('Untitled', '', [])).toEqual([])
  })

  it('folds in anything else said', () => {
    const ev = buildFirstCutEvidence('Producing my first track', 'Making original tracks.', ['I want to try a lo-fi sound first'])
    expect(ev.map(e => e.text)).toContain('I want to try a lo-fi sound first')
  })
})

describe('buildFirstCutPrompt', () => {
  const FIRST_CUT_INPUT: FirstCutInput = {
    title: 'Producing my first track',
    description: 'Making original tracks, not just DJing.',
    said: [],
  }
  const prompt = (i = FIRST_CUT_INPUT) => buildFirstCutPrompt(i, buildFirstCutEvidence(i.title, i.description, i.said))

  it('plans forwards, explicitly not backwards from a finish line', () => {
    const p = prompt()
    expect(p).toContain('forwards, not backwards')
    expect(p).toContain("There's no finish line yet, and none should be invented")
  })

  it('asks for exactly the first-cut count, not the full spine range', () => {
    expect(prompt()).toContain(`Give exactly ${FIRST_CUT_STEPS} moves`)
    expect(prompt()).not.toContain(`${MIN_SPINE_STEPS}-${MAX_SPINE_STEPS} steps`)
  })

  it('tells the model to leave things coarse on purpose', () => {
    expect(prompt()).toContain('coarse ON PURPOSE')
  })

  it('bans a finish line as an output, not just backwards planning as a method', () => {
    expect(prompt()).toContain('A finish line, a deadline, or a description of what "done" looks like')
  })

  it('carries the same no-invented-specifics and anti-admin rules', () => {
    const p = prompt()
    expect(p).toContain('does NOT appear verbatim above')
    for (const v of ['research', 'decide', 'brainstorm']) expect(p).toContain(v)
  })
})

describe('sanitizeSteps', () => {
  it('strips list formatting the model adds anyway', () => {
    expect(sanitizeSteps(['1. Record the vocal', '- Mix it']).map(s => s.text))
      .toEqual(['Record the vocal', 'Mix it'])
  })

  it('drops admin steps', () => {
    expect(sanitizeSteps(['Research microphones', 'Record the vocal']).map(s => s.text))
      .toEqual(['Record the vocal'])
  })

  it('drops near-duplicates', () => {
    expect(sanitizeSteps(['Mix it', 'mix it.'])).toHaveLength(1)
  })

  it('never returns a backlog', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Do distinct thing number ${i}`)
    expect(sanitizeSteps(many).length).toBeLessThanOrEqual(MAX_SPINE_STEPS)
  })

  it('caps at a passed-in count, for the first-cut list', () => {
    const many = Array.from({ length: 10 }, (_, i) => `Do distinct thing number ${i}`)
    expect(sanitizeSteps(many, FIRST_CUT_STEPS)).toHaveLength(FIRST_CUT_STEPS)
  })

  it('keeps the citations so each step can be checked', () => {
    expect(sanitizeSteps([{ text: 'Record the vocal', evidence: ['e2'] }])[0].evidence).toEqual(['e2'])
  })

  it('survives junk', () => {
    expect(sanitizeSteps(null)).toEqual([])
    expect(sanitizeSteps([1, {}, null])).toEqual([])
  })
})

describe('toStoredTasks', () => {
  const now = new Date('2026-09-01T10:00:00Z')

  it('produces the shape the app already stores tasks in', () => {
    const [task] = toStoredTasks([{ text: 'Record the vocal', source: 'from what you said about it', estimatedMinutes: null }], now)
    expect(task).toMatchObject({
      text: 'Record the vocal',
      done: false,
      origin: 'spine',
      source: 'from what you said about it',
    })
    expect(task.created_at).toBe(now.toISOString())
  })

  it('gives every task a distinct id', () => {
    const tasks = toStoredTasks([{ text: 'a', source: null, estimatedMinutes: null }, { text: 'b', source: null, estimatedMinutes: null }], now)
    expect(new Set(tasks.map(t => t.id)).size).toBe(2)
  })

  it('always sets an explicit order, continuing from wherever the list already ends', () => {
    // An absent order used to sort as 0 -- so a spine step and a close-out
    // step could land in whatever relative order the engine's sort chose.
    const tasks = toStoredTasks([{ text: 'a', source: null, estimatedMinutes: null }, { text: 'b', source: null, estimatedMinutes: null }], now, 3)
    expect(tasks.map(t => t.order)).toEqual([3, 4])
  })

  it('carries the estimate onto the stored task when one was set', () => {
    const [task] = toStoredTasks([{ text: 'Record the vocal', source: null, estimatedMinutes: 20 }], now)
    expect(task.estimated_minutes).toBe(20)
    expect(task.estimate_set).toBe(true)
  })

  it('leaves the estimate unset rather than guessing when none was given', () => {
    const [task] = toStoredTasks([{ text: 'Record the vocal', source: null, estimatedMinutes: null }], now)
    expect(task.estimated_minutes).toBeUndefined()
    expect(task.estimate_set).toBeUndefined()
  })
})

describe('generateFirstCutTasks', () => {
  it('returns nothing rather than invent, when there is no description to plan from', async () => {
    // No GEMINI_API_KEY in the test env either way, but the point here is
    // that it never even tries -- an empty description means no evidence,
    // same rule as generateTaskSpine with no goal.
    const { generateFirstCutTasks } = await import('./task-spine.js')
    const steps = await generateFirstCutTasks({ title: 'Untitled', description: '', said: [] })
    expect(steps).toEqual([])
  })
})
