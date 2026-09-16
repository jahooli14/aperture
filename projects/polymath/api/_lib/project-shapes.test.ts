import { describe, it, expect } from 'vitest'
import {
  findRestarts, findAbandonedBatches, findUntouchedHaul, isDead,
  HAUL_MIN, HAUL_MIN_AGE_DAYS,
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
    // Both months named, not just the gap. A question that says "and started
    // it again in June" must not be rejected as inventing June.
    const months = (found[0].fact.match(/January|February|March|April|May|June|July|August|September|October|November|December/g) ?? [])
    expect(months.length).toBeGreaterThanOrEqual(2)
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

  it('sits above the corpus ceiling for coincidence, not just above average', () => {
    // Live: project-to-project similarity p99 is 0.72, the one true restart
    // scores 0.84, and the next pair down is 0.81 — two different projects
    // that merely share a register. A restart claims something about what
    // the person DID, so it has to be near-impossible to reach by accident.
    expect(RESTART_SIM).toBeGreaterThan(0.81)
    expect(RESTART_SIM).toBeLessThan(0.84)
    expect(RESTART_MIN_GAP_DAYS).toBeGreaterThanOrEqual(30)
  })

  it('does not call two different projects in the same register a restart', () => {
    // "A single note on paper" and "Paint one wood block", 0.81 apart —
    // the second-closest pair in the whole corpus, and not a restart.
    const found = findRestarts([
      { id: 'a', title: 'A single note on paper', status: 'dormant', createdAt: ago(250), embedding: [1, 0, 0] },
      { id: 'b', title: 'Paint one wood block', status: 'active', createdAt: ago(74), embedding: [1, 0, 0.7240] },
    ], NOW)
    expect(found).toHaveLength(0)
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

describe('findUntouchedHaul', () => {
  const item = (content: string, days: number, status: string | null = 'pending') =>
    ({ content, status, createdAt: ago(days), listTitle: 'Lines' })
  const ten = (days = 250, status: string | null = 'pending') =>
    Array.from({ length: 10 }, (_, i) => item(`line ${i}`, days, status))

  it('finds a sitting nobody ever came back to', () => {
    // Live: ten lines onto a list on 10 January, every one still untouched.
    const found = findUntouchedHaul(ten(), NOW)
    expect(found).toHaveLength(1)
    expect(found[0].fact).toContain('10 things on a list in one sitting')
    expect(found[0].fact).toContain('not touched any of them since')
    // Quotes a few, so the question has their words to work with.
    expect(found[0].fact).toContain('"line 0"')
  })

  it('says nothing when one of them got picked up', () => {
    // That is a list doing its job, not a pile.
    const mixed = [...ten().slice(0, 9), item('line 9', 250, 'active')]
    expect(findUntouchedHaul(mixed, NOW)).toHaveLength(0)
  })

  it('ignores an ordinary day of adding one or two things', () => {
    expect(findUntouchedHaul([item('a', 250), item('b', 250)], NOW)).toHaveLength(0)
    expect(HAUL_MIN).toBeGreaterThanOrEqual(4)
  })

  it('leaves a recent haul alone — not touching it yet is not a fact', () => {
    expect(findUntouchedHaul(ten(10), NOW)).toHaveLength(0)
    expect(HAUL_MIN_AGE_DAYS).toBeGreaterThanOrEqual(60)
  })

  it('returns only the biggest sitting', () => {
    // Four days qualify on the live corpus, and four questions about
    // "you saved some things once" is one question and three repeats.
    const twoDays = [...ten(250), ...Array.from({ length: 6 }, (_, i) => item(`other ${i}`, 180))]
    const found = findUntouchedHaul(twoDays, NOW)
    expect(found).toHaveLength(1)
    expect(found[0].fact).toContain('10 things')
  })

  it('carries no project, because the point is one that is not there yet', () => {
    expect(findUntouchedHaul(ten(), NOW)[0].projectId).toBe('')
  })
})
