import { describe, it, expect } from 'vitest'
import {
  findRestarts, findAbandonedBatches, isDead,
  RESTART_SIM, RESTART_MIN_GAP_DAYS, BATCH_MIN,
  type ShapeProject,
} from './project-shapes.js'

const NOW = new Date('2026-09-15T00:00:00Z')
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const p = (
  id: string, title: string, status: string, days: number, embedding: number[] | null = [1, 0, 0],
): ShapeProject => ({ id, title, status, createdAt: ago(days), embedding, description: `about ${title}` })

describe('isDead', () => {
  it('counts both ways a project gets let go', () => {
    expect(isDead('abandoned')).toBe(true)
    expect(isDead('dormant')).toBe(true)
    expect(isDead('active')).toBe(false)
    expect(isDead('completed')).toBe(false)
    expect(isDead(null)).toBe(false)
  })
})

describe('findRestarts', () => {
  it('finds the thing given up on and quietly started again', () => {
    // The live one: "Custom t-shirts" abandoned in January, "Create custom
    // t-shirts for friends" created 176 days later, 0.84 similar.
    const found = findRestarts([
      p('a', 'Custom t-shirts', 'abandoned', 250),
      p('b', 'Create custom t-shirts for friends', 'active', 74),
    ], NOW)
    expect(found).toHaveLength(1)
    expect(found[0].projectTitle).toBe('Create custom t-shirts for friends')
    expect(found[0].fact).toContain('gave up on "Custom t-shirts"')
    expect(found[0].fact).toContain('from scratch')
    // A month named, not "a while ago" — the part they cannot argue with.
    expect(found[0].fact).toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/)
  })

  it('ignores two projects that merely sound alike', () => {
    const found = findRestarts([
      p('a', 'Custom t-shirts', 'abandoned', 250, [1, 0, 0]),
      p('b', 'A book about rivers', 'active', 74, [0, 1, 0]),
    ], NOW)
    expect(found).toHaveLength(0)
  })

  it('ignores a duplicate made the same week — that is a mistake, not a return', () => {
    const found = findRestarts([
      p('a', 'Custom t-shirts', 'abandoned', 250),
      p('b', 'Custom t-shirts again', 'active', 249),
    ], NOW)
    expect(found).toHaveLength(0)
  })

  it('only looks forward: a live project is not a restart of something abandoned later', () => {
    const found = findRestarts([
      p('a', 'Custom t-shirts', 'abandoned', 40),
      p('b', 'Custom t-shirts for friends', 'active', 250),
    ], NOW)
    expect(found).toHaveLength(0)
  })

  it('skips projects with no vector rather than guessing', () => {
    expect(findRestarts([
      p('a', 'Custom t-shirts', 'abandoned', 250, null),
      p('b', 'Custom t-shirts for friends', 'active', 74),
    ], NOW)).toHaveLength(0)
  })

  it('keeps its thresholds honest', () => {
    expect(RESTART_SIM).toBeGreaterThan(0.7)
    expect(RESTART_MIN_GAP_DAYS).toBeGreaterThanOrEqual(30)
  })
})

describe('findAbandonedBatches', () => {
  it('finds a sitting where everything started died', () => {
    // Live: 3 January, three projects opened, all three now dead.
    const found = findAbandonedBatches([
      p('a', 'World memory palace', 'dormant', 255),
      p('b', 'Custom t-shirts', 'abandoned', 255),
      p('c', 'Side quests on side quests book', 'dormant', 255),
    ])
    expect(found).toHaveLength(1)
    expect(found[0].fact).toContain('3 projects in one sitting')
    expect(found[0].fact).toContain('every one of them is dead')
    expect(found[0].fact).toContain('World memory palace')
  })

  it('says nothing about a day where something survived', () => {
    // A productive afternoon is not a question.
    expect(findAbandonedBatches([
      p('a', 'World memory palace', 'dormant', 255),
      p('b', 'Custom t-shirts', 'abandoned', 255),
      p('c', 'Aperture', 'active', 255),
    ])).toHaveLength(0)
  })

  it('says nothing about two projects — that is a morning, not a pattern', () => {
    expect(findAbandonedBatches([
      p('a', 'One', 'abandoned', 255),
      p('b', 'Two', 'dormant', 255),
    ])).toHaveLength(0)
    expect(BATCH_MIN).toBeGreaterThanOrEqual(3)
  })

  it('does not merge separate days into one batch', () => {
    expect(findAbandonedBatches([
      p('a', 'One', 'abandoned', 255),
      p('b', 'Two', 'abandoned', 255),
      p('c', 'Three', 'abandoned', 254),
    ])).toHaveLength(0)
  })
})
