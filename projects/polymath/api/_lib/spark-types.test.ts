import { describe, it, expect } from 'vitest'
import { pickNextSparkType, highestWeightSparkType, SPARK_TYPES } from './spark-types.js'

describe('pickNextSparkType', () => {
  it('never repeats the immediately previous type', () => {
    for (let i = 0; i < 50; i++) {
      const picked = pickNextSparkType([{ type: 'noticing', answered: true }])
      expect(picked).not.toBe('noticing')
    }
  })

  it('only ever picks a real spark type', () => {
    for (let i = 0; i < 50; i++) {
      const picked = pickNextSparkType([])
      expect(SPARK_TYPES).toContain(picked)
    }
  })

  it('falls back to the full set if history is somehow just one type repeated', () => {
    // Degenerate case: shouldn't throw, and must still return a valid type.
    const picked = pickNextSparkType([{ type: 'material_fact', answered: false }])
    expect(SPARK_TYPES).toContain(picked)
  })
})

describe('highestWeightSparkType', () => {
  it('favours a type with a high answer rate over one that is ignored', () => {
    const history = [
      { type: 'noticing' as const, answered: true }, // last shown -- excluded from candidates
      ...Array(5).fill({ type: 'contradiction' as const, answered: true }),
      ...Array(5).fill({ type: 'scale_jump' as const, answered: false }),
    ]
    const picked = highestWeightSparkType(history)
    expect(picked).toBe('contradiction')
  })

  it('never lets outside_reach drop to zero weight despite a poor answer rate', () => {
    // Give every OTHER type an equally poor track record too, so this
    // isolates the floor rather than being won by an unseen type's
    // neutral default weight.
    // Every non-outside_reach candidate needs a poor track record here,
    // otherwise an unseen type wins on its neutral 0.5 default (0.25 + 0.5 =
    // 0.75) rather than the floor being what's under test.
    const badHistoryFor = (type: 'contradiction' | 'material_fact' | 'scale_jump' | 'transferred_constraint' | 'unfinished_thought' | 'forgotten') =>
      Array(10).fill({ type, answered: false })

    const history = [
      { type: 'noticing' as const, answered: true },
      ...Array(10).fill({ type: 'outside_reach' as const, answered: false }),
      ...badHistoryFor('material_fact'),
      ...badHistoryFor('contradiction'),
      ...badHistoryFor('scale_jump'),
      ...badHistoryFor('transferred_constraint'),
      ...badHistoryFor('unfinished_thought'),
      ...badHistoryFor('forgotten'),
    ]
    const picked = highestWeightSparkType(history)
    // outside_reach's floor (0.5) beats everyone else's unfloor'd 0.25 rate-adjusted weight.
    expect(picked).toBe('outside_reach')
  })

  it('excludes the immediately previous type from the candidate pool', () => {
    const history = [{ type: 'unfinished_thought' as const, answered: true }]
    const picked = highestWeightSparkType(history)
    expect(picked).not.toBe('unfinished_thought')
  })
})
