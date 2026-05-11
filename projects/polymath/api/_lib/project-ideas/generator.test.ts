/**
 * Tests for synthesiseFallbackIdea — the no-LLM template that fires when
 * the on-demand idea pipeline can't reach a model. The previous version
 * stamped the same "pick this back up / today is as good a day as any /
 * open the project, smallest visible change" boilerplate on whatever
 * dormant project was at the top of the list. These tests pin the new
 * behaviour: resurfaces are earned by thematic resonance, copy names the
 * specific reason, and the template bromides never ship.
 */

import { describe, it, expect } from 'vitest'
import { synthesiseFallbackIdea } from './generator'
import type { GatherResult } from './types'

const NOW = Date.now()
const day = 86_400_000

function isoDaysAgo(n: number): string {
  return new Date(NOW - n * day).toISOString()
}

function emptyGather(overrides: Partial<GatherResult> = {}): GatherResult {
  return {
    memories: [],
    list_items: [],
    active_projects: [],
    dormant_projects: [],
    reading: [],
    highlights: [],
    prior_suggestions: [],
    ie_ideas: [],
    prior_ideas: { saved: [], rejected: [], built: [] },
    recent_seed_pairs: [],
    recent_titles: [],
    recent_centre_ids: [],
    total_signal_count: 0,
    ...overrides,
  }
}

describe('synthesiseFallbackIdea — no stamped bromides', () => {
  const STAMPED_LINES = [
    'You started this and stopped. Today is as good a day as any to revisit it.',
    'Open the project. Make the smallest visible change you can in the next 30 minutes.',
    'You showed up. That\'s the data point.',
  ]

  it('never emits the old template lines for a dormant project', () => {
    const g = emptyGather({
      dormant_projects: [
        { id: 'p1', title: 'Smashed glass colours', description: 'Smash some glass and let colours bleed through it, then frame it, maybe add some light', status: 'dormant', updated_at: isoDaysAgo(40) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    for (const line of STAMPED_LINES) {
      expect(idea.why_now).not.toBe(line)
      expect(idea.next_step).not.toBe(line)
      expect(idea.pitch).not.toContain('Pick this back up.')
    }
  })

  it('uses the project description verbatim in the pitch (no "Pick this back up" preamble)', () => {
    const desc = 'Cut beech strips and glue them into a synth case before the trip'
    const g = emptyGather({
      dormant_projects: [
        { id: 'p1', title: 'Synth case', description: desc, status: 'dormant', updated_at: isoDaysAgo(30) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    expect(idea.pitch).toContain('Cut beech strips')
    expect(idea.pitch.startsWith('Pick this back up')).toBe(false)
  })
})

describe('synthesiseFallbackIdea — resonance picks the right dormant project', () => {
  it('prefers a dormant project whose themes overlap a recent voice note', () => {
    const g = emptyGather({
      dormant_projects: [
        // First by recency — the OLD fallback would always pick this one.
        { id: 'p1', title: 'Bird cam latency', description: 'Fix the dropped frames on the garden bird cam stream', status: 'dormant', updated_at: isoDaysAgo(8) },
        // Second by recency, but matches the recent voice note.
        { id: 'p2', title: 'Smashed glass colours', description: 'Smash some glass and let colours bleed through it, then frame it', status: 'dormant', updated_at: isoDaysAgo(60) },
      ],
      memories: [
        { id: 'm1', title: null, body: 'thinking about colour again — how broken glass holds light differently than whole glass', themes: ['colour', 'glass'], memory_type: 'reflection', created_at: isoDaysAgo(4) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    expect(idea.title).toBe('Smashed glass colours')
  })

  it('names the resonant voice note in why_now when one matches', () => {
    const memBody = 'thinking about colour again — how broken glass holds light differently than whole glass'
    const g = emptyGather({
      dormant_projects: [
        { id: 'p1', title: 'Smashed glass colours', description: 'Smash some glass and let colours bleed through it', status: 'dormant', updated_at: isoDaysAgo(60) },
      ],
      memories: [
        { id: 'm1', title: null, body: memBody, themes: ['glass'], memory_type: 'reflection', created_at: isoDaysAgo(4) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    // The why_now must quote something from the user's own voice note —
    // that's the entire point of the rewrite. A generic "today is as good
    // a day as any" line is exactly the regression we're guarding against.
    expect(idea.why_now).toMatch(/broken glass|colour|whole glass/)
    expect(idea.why_now).toContain('"')
  })

  it('falls back to most-recent dormant when no memory resonates', () => {
    const g = emptyGather({
      dormant_projects: [
        { id: 'p1', title: 'Bird cam latency', description: 'Fix the dropped frames on the garden bird cam stream', status: 'dormant', updated_at: isoDaysAgo(8) },
        { id: 'p2', title: 'Smashed glass colours', description: 'Smash some glass and let colours bleed through it', status: 'dormant', updated_at: isoDaysAgo(60) },
      ],
      memories: [
        { id: 'm1', title: null, body: 'random unrelated capture about cooking', themes: ['food'], memory_type: 'reflection', created_at: isoDaysAgo(2) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    expect(idea.title).toBe('Bird cam latency')
    // No resonance → why_now should name the dormancy gap, not a bromide.
    expect(idea.why_now.toLowerCase()).toMatch(/week|recent|moved past/)
  })
})

describe('synthesiseFallbackIdea — next_step is specific when description allows', () => {
  it('uses a verb-led first clause from the description as the action', () => {
    const g = emptyGather({
      dormant_projects: [
        { id: 'p1', title: 'Synth case', description: 'Cut beech strips and glue them into a case before the trip', status: 'dormant', updated_at: isoDaysAgo(20) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    expect(idea.next_step.toLowerCase()).toContain('cut beech')
  })
})

describe('synthesiseFallbackIdea — voice-note tier when no dormant projects', () => {
  it('quotes the voice note in the pitch', () => {
    const g = emptyGather({
      memories: [
        { id: 'm1', title: null, body: 'a friend asked me what i would build if i had a free week and i said a metronome that breathes', themes: ['music'], memory_type: 'reflection', created_at: isoDaysAgo(1) },
      ],
    })
    const idea = synthesiseFallbackIdea(g)
    expect(idea.pitch).toContain('metronome that breathes')
  })
})

describe('synthesiseFallbackIdea — universal tier never goes empty', () => {
  it('returns a non-empty idea with concrete next_step even with no data', () => {
    const idea = synthesiseFallbackIdea(emptyGather())
    expect(idea.title.length).toBeGreaterThan(0)
    expect(idea.pitch.length).toBeGreaterThan(0)
    expect(idea.next_step.length).toBeGreaterThan(0)
    // The universal-tier next_step shouldn't say "open the project" —
    // there's no project to open.
    expect(idea.next_step.toLowerCase()).not.toContain('open the project')
  })
})
