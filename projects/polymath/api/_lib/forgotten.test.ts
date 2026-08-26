import { describe, it, expect } from 'vitest'
import {
  selectForgottenProject,
  forgottenSparkText,
  FORGOTTEN_MIN_DAYS,
} from './forgotten.js'

const NOW = new Date('2026-08-26T00:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString()

const base = {
  projectIdsWithRecentFragments: [] as string[],
  recentlyOfferedProjectIds: [] as string[],
}

describe('selectForgottenProject', () => {
  it('returns null when nothing is old enough', () => {
    const result = selectForgottenProject({
      ...base,
      projects: [{ id: 'a', title: 'Recent thing', last_touched_at: daysAgo(10), state: 'mull' }],
    }, NOW)
    expect(result).toBeNull()
  })

  it('offers the longest-untouched eligible project', () => {
    const result = selectForgottenProject({
      ...base,
      projects: [
        { id: 'a', title: 'Older', last_touched_at: daysAgo(200), state: 'mull' },
        { id: 'b', title: 'Old', last_touched_at: daysAgo(90), state: 'mull' },
      ],
    }, NOW)
    expect(result?.project.id).toBe('a')
    expect(result?.daysUntouched).toBe(200)
  })

  it('THE ROUTING RULE: skips a project the corpus is still talking about', () => {
    // 'a' is older, but has recent fragments -> that is the morph path's
    // job. Asking a vague question about it instead of proposing something
    // concrete would be strictly worse, so it must be skipped entirely.
    const result = selectForgottenProject({
      ...base,
      projectIdsWithRecentFragments: ['a'],
      projects: [
        { id: 'a', title: 'Has material', last_touched_at: daysAgo(300), state: 'mull' },
        { id: 'b', title: 'Truly silent', last_touched_at: daysAgo(90), state: 'mull' },
      ],
    }, NOW)
    expect(result?.project.id).toBe('b')
  })

  it('returns null rather than reaching for a noisy project when it is the only one', () => {
    const result = selectForgottenProject({
      ...base,
      projectIdsWithRecentFragments: ['a'],
      projects: [{ id: 'a', title: 'Has material', last_touched_at: daysAgo(300), state: 'mull' }],
    }, NOW)
    expect(result).toBeNull()
  })

  it('respects the per-project cooldown', () => {
    const result = selectForgottenProject({
      ...base,
      recentlyOfferedProjectIds: ['a'],
      projects: [
        { id: 'a', title: 'Asked recently', last_touched_at: daysAgo(300), state: 'mull' },
        { id: 'b', title: 'Not asked', last_touched_at: daysAgo(80), state: 'mull' },
      ],
    }, NOW)
    expect(result?.project.id).toBe('b')
  })

  it('never offers the live project or a harvested one', () => {
    const result = selectForgottenProject({
      ...base,
      projects: [
        { id: 'live', title: 'In play', last_touched_at: daysAgo(400), state: 'live' },
        { id: 'dead', title: 'Harvested', last_touched_at: daysAgo(500), state: 'harvested' },
      ],
    }, NOW)
    expect(result).toBeNull()
  })

  it('treats a never-touched project as maximally forgotten', () => {
    const result = selectForgottenProject({
      ...base,
      projects: [
        { id: 'a', title: 'Never started', last_touched_at: null, state: 'mull' },
        { id: 'b', title: 'Old', last_touched_at: daysAgo(300), state: 'mull' },
      ],
    }, NOW)
    expect(result?.project.id).toBe('a')
  })

  it('uses the documented minimum age boundary', () => {
    const justUnder = selectForgottenProject({
      ...base,
      projects: [{ id: 'a', title: 'x', last_touched_at: daysAgo(FORGOTTEN_MIN_DAYS - 1), state: 'mull' }],
    }, NOW)
    expect(justUnder).toBeNull()

    const exactly = selectForgottenProject({
      ...base,
      projects: [{ id: 'a', title: 'x', last_touched_at: daysAgo(FORGOTTEN_MIN_DAYS), state: 'mull' }],
    }, NOW)
    expect(exactly?.project.id).toBe('a')
  })
})

describe('forgottenSparkText', () => {
  it('states the fact plainly, without narrating what it means', () => {
    expect(forgottenSparkText('the book', 120)).toBe('You set down the book 4 months ago.')
  })

  it('handles years and never-started', () => {
    // 60 days is the minimum age, so months is always >= 2 in practice and
    // the weeks branch is unreachable defensive code -- 70 days reads as
    // "2 months", which is the better phrasing anyway.
    expect(forgottenSparkText('the book', 70)).toBe('You set down the book 2 months ago.')
    expect(forgottenSparkText('the book', 400)).toBe('You set down the book over a year ago.')
    expect(forgottenSparkText('the book', 900)).toBe('You set down the book over 2 years ago.')
    expect(forgottenSparkText('the book', Number.MAX_SAFE_INTEGER)).toBe('You never started the book.')
  })
})
