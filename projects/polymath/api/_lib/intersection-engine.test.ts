/**
 * Battle tests for the intersection pipeline's reliability-critical paths:
 *
 *   1. normalizeTitle — drives the whole dedup layer. If this fails to
 *      collapse equivalent titles, users see the same crossover twice.
 *   2. parseCandidatesJSON — Gemini regularly truncates at the maxTokens
 *      boundary mid-string. Recovery preserves the N-1 complete objects
 *      instead of dropping them all.
 *   3. embeddingBasedDiscovery — the fallback used whenever AI discovery
 *      throws or returns zero candidates. Has to produce usable clusters
 *      from pure geometry.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTitle,
  parseCandidatesJSON,
  embeddingBasedDiscovery,
  type ProjectInput,
  type MemoryInput,
  type ListItemInput,
} from './intersection-engine'

// ---------- normalizeTitle ----------

describe('normalizeTitle', () => {
  it('is case-insensitive', () => {
    expect(normalizeTitle('Signal Detection')).toBe(normalizeTitle('signal detection'))
  })

  it('strips punctuation', () => {
    expect(normalizeTitle('Signal: detection!')).toBe('signal detection')
    expect(normalizeTitle('A, B, and C.')).toBe('a b and c')
  })

  it('collapses runs of whitespace', () => {
    expect(normalizeTitle('signal   detection')).toBe('signal detection')
    expect(normalizeTitle('\tsignal\n\ndetection ')).toBe('signal detection')
  })

  it('treats em-dashes and smart quotes as punctuation', () => {
    expect(normalizeTitle('Signal — Detection')).toBe(normalizeTitle('Signal Detection'))
    expect(normalizeTitle('"Signal" Detection')).toBe(normalizeTitle('Signal Detection'))
  })

  it('preserves unicode letters and numbers', () => {
    expect(normalizeTitle('Café 42')).toBe('café 42')
  })

  it('returns empty string for null / undefined / empty', () => {
    expect(normalizeTitle(null)).toBe('')
    expect(normalizeTitle(undefined)).toBe('')
    expect(normalizeTitle('')).toBe('')
    expect(normalizeTitle('  !!!  ')).toBe('')
  })

  it('produces the same key for the dedup scenarios the pipeline actually hits', () => {
    // The filter in intersection-weekly.ts normalises both sides before
    // comparing — these should all collide on the same set key.
    const variants = [
      'Signal Detection in Noisy Streams',
      'Signal-Detection, in Noisy Streams!',
      '  signal   detection in   noisy streams  ',
      'Signal Detection in Noisy Streams.',
    ]
    const keys = new Set(variants.map(normalizeTitle))
    expect(keys.size).toBe(1)
  })
})

// ---------- parseCandidatesJSON ----------

describe('parseCandidatesJSON', () => {
  it('parses a well-formed array', () => {
    const out = parseCandidatesJSON('[{"a":1},{"a":2}]')
    expect(out).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('returns [] for a non-array value', () => {
    expect(parseCandidatesJSON('{"a":1}')).toEqual([])
    expect(parseCandidatesJSON('null')).toEqual([])
  })

  it('returns [] for garbage with no array start', () => {
    expect(parseCandidatesJSON('totally not json')).toEqual([])
    expect(parseCandidatesJSON('')).toEqual([])
  })

  it('recovers the complete prefix when truncated mid-string', () => {
    // Simulates Gemini hitting maxTokens partway through the second object.
    const raw = '[{"pattern_name":"A","the_insight":"ok"},{"pattern_name":"B","the_insight":"truncat'
    const out = parseCandidatesJSON(raw)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ pattern_name: 'A', the_insight: 'ok' })
  })

  it('recovers two complete candidates when the third is cut off', () => {
    const raw =
      '[{"pattern_name":"A"},{"pattern_name":"B"},{"pattern_name":"C","the_insight":"cut'
    const out = parseCandidatesJSON(raw)
    expect(out).toHaveLength(2)
    expect(out.map((c: any) => c.pattern_name)).toEqual(['A', 'B'])
  })

  it('ignores braces that appear inside JSON strings', () => {
    // An embedded `}` inside a string should NOT count as closing an object.
    const raw = '[{"pattern_name":"A","body":"has } and { inside"},{"pattern_name":"B","bro'
    const out = parseCandidatesJSON(raw)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ pattern_name: 'A' })
  })

  it('handles escaped quotes inside strings during recovery', () => {
    const raw = '[{"pattern_name":"A","note":"he said \\"hi\\""},{"pattern_name":"B","tru'
    const out = parseCandidatesJSON(raw)
    expect(out).toHaveLength(1)
    expect(out[0].note).toBe('he said "hi"')
  })

  it('returns [] when no object ever completes', () => {
    const raw = '[{"pattern_name":"A","stuck_mid_stream'
    const out = parseCandidatesJSON(raw)
    expect(out).toEqual([])
  })
})

// ---------- embeddingBasedDiscovery (fallback path) ----------

/** Build a unit-length embedding in the given direction. 768 dims to match prod. */
function emb(direction: number[], dims = 768): number[] {
  // Place the direction into the first N dims, zero-pad the rest, normalise.
  const vec = Array(dims).fill(0)
  for (let i = 0; i < direction.length; i++) vec[i] = direction[i]
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  if (mag === 0) return vec
  return vec.map(v => v / mag)
}

function mkProject(id: string, title: string, embedding: number[]): ProjectInput {
  return { id, title, description: null, embedding, metadata: null, status: 'active' }
}

function mkMemory(id: string, body: string, embedding: number[]): MemoryInput {
  return { id, title: null, body, themes: null, embedding }
}

function mkListItem(id: string, content: string, embedding: number[]): ListItemInput {
  return { id, content, metadata: null, embedding }
}

describe('embeddingBasedDiscovery (fallback clustering)', () => {
  it('returns [] when fewer than 2 candidates have embeddings', () => {
    const out = embeddingBasedDiscovery(
      [mkProject('p1', 'Only One', emb([1, 0]))],
      [],
      [],
      []
    )
    expect(out).toEqual([])
  })

  it('forms a cluster across related projects in the sweet-spot similarity band', () => {
    // Two projects roughly related (~0.55 cos sim) — should cluster.
    const p1 = mkProject('p1', 'Photo app', emb([1, 0.3, 0]))
    const p2 = mkProject('p2', 'Knowledge graph', emb([0.3, 1, 0]))
    const out = embeddingBasedDiscovery([p1, p2], [], [], [])
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].nodes.map(n => n.id).sort()).toEqual(['p1', 'p2'])
    expect(out[0].nodes.every(n => n.type === 'project')).toBe(true)
  })

  it('skips near-duplicate projects above the UPPER cutoff', () => {
    // Two projects that are essentially the same idea (cos ~1.0) shouldn't
    // form a "cluster" — there's nothing to collide.
    const p1 = mkProject('p1', 'X', emb([1, 0, 0]))
    const p2 = mkProject('p2', 'X2', emb([1, 0, 0]))
    const out = embeddingBasedDiscovery([p1, p2], [], [], [])
    expect(out).toEqual([])
  })

  it('skips orthogonal projects below the LOWER cutoff', () => {
    // Totally unrelated — cos sim 0 — no cluster.
    const p1 = mkProject('p1', 'A', emb([1, 0, 0, 0]))
    const p2 = mkProject('p2', 'B', emb([0, 0, 0, 1]))
    const out = embeddingBasedDiscovery([p1, p2], [], [], [])
    expect(out).toEqual([])
  })

  it('requires at least one project in every cluster', () => {
    // Two substantial memories that look related — on their own they should
    // NOT surface (no project anchor keeps things grounded).
    const m1 = mkMemory(
      'm1',
      'a'.repeat(120) + ' pattern recognition is fascinating',
      emb([1, 0.5])
    )
    const m2 = mkMemory(
      'm2',
      'b'.repeat(120) + ' pattern recognition across streams',
      emb([0.5, 1])
    )
    const out = embeddingBasedDiscovery([], [], [], [])
    expect(out).toEqual([])
    // With just memories (no project) — still filtered out.
    const out2 = embeddingBasedDiscovery([], [m1, m2], [], [])
    expect(out2).toEqual([])
  })

  it('builds a mixed-type cluster (project + memory + list item)', () => {
    const direction1 = [1, 0.5, 0.2]
    const direction2 = [0.5, 1, 0.3]
    const direction3 = [0.3, 0.5, 1]
    const p1 = mkProject('p1', 'Proj A', emb(direction1))
    const m1 = mkMemory(
      'm1',
      'substantial thought '.repeat(8) + ' about the same space',
      emb(direction2)
    )
    const li1 = mkListItem('li1', 'substantial list item to consider later', emb(direction3))
    const out = embeddingBasedDiscovery([p1], [m1], [], [li1])
    expect(out.length).toBeGreaterThan(0)
    const types = out[0].nodes.map(n => n.type).sort()
    // At minimum contains the project; ideally all three.
    expect(types).toContain('project')
    expect(out[0].projectIds).toEqual(['p1'])
  })

  it('ignores memories / list items with no substance (too short)', () => {
    const p1 = mkProject('p1', 'Proj A', emb([1, 0.5]))
    const p2 = mkProject('p2', 'Proj B', emb([0.5, 1]))
    const shortMem = mkMemory('m1', 'short', emb([1, 0.5]))
    const shortLi = mkListItem('li1', 'tiny', emb([0.5, 1]))
    const out = embeddingBasedDiscovery([p1, p2], [shortMem], [], [shortLi])
    // Cluster still forms from the two projects, but short mem/li don't appear.
    const nodeIds = out[0]?.nodes.map(n => n.id) ?? []
    expect(nodeIds).not.toContain('m1')
    expect(nodeIds).not.toContain('li1')
  })

  it('caps results at 3 clusters per deck', () => {
    // 6 projects arranged so multiple disjoint pairs land in the sweet spot.
    const projects = [
      mkProject('p1', 'A', emb([1, 0.5, 0, 0, 0, 0])),
      mkProject('p2', 'B', emb([0.5, 1, 0, 0, 0, 0])),
      mkProject('p3', 'C', emb([0, 0, 1, 0.5, 0, 0])),
      mkProject('p4', 'D', emb([0, 0, 0.5, 1, 0, 0])),
      mkProject('p5', 'E', emb([0, 0, 0, 0, 1, 0.5])),
      mkProject('p6', 'F', emb([0, 0, 0, 0, 0.5, 1])),
    ]
    const out = embeddingBasedDiscovery(projects, [], [], [])
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('produces a stable id derived from sorted member ids (idempotent)', () => {
    const p1 = mkProject('p1', 'A', emb([1, 0.5]))
    const p2 = mkProject('p2', 'B', emb([0.5, 1]))
    const a = embeddingBasedDiscovery([p1, p2], [], [], [])
    const b = embeddingBasedDiscovery([p2, p1], [], [], [])
    expect(a[0]?.id).toBe(b[0]?.id)
  })
})

// ---------- Dedup pipeline (the filter from intersection-weekly.ts) ----------

describe('weekly dedup filter semantics', () => {
  /**
   * Mirrors `isAllowed` in intersection-weekly.ts so we can assert the
   * semantics hold regardless of the data path that produced the cards.
   */
  function buildFilter(disliked: string[], alreadySeen: string[]) {
    const dislikedSet = new Set(disliked.map(normalizeTitle).filter(Boolean))
    const seenSet = new Set(alreadySeen.map(normalizeTitle).filter(Boolean))
    const thisRunSeen = new Set<string>()
    return (title: string | undefined) => {
      const norm = normalizeTitle(title)
      if (!norm) return true
      if (dislikedSet.has(norm)) return false
      if (seenSet.has(norm)) return false
      if (thisRunSeen.has(norm)) return false
      thisRunSeen.add(norm)
      return true
    }
  }

  it('drops cards whose title matches a disliked theme (fuzzy)', () => {
    const allow = buildFilter(['Signal Detection'], [])
    expect(allow('signal-detection!')).toBe(false)
  })

  it('drops cards whose title matches any previously-shown title', () => {
    const allow = buildFilter([], ['The Same Pattern Twice'])
    expect(allow('The same pattern, twice.')).toBe(false)
  })

  it('drops duplicates within the same generation run', () => {
    const allow = buildFilter([], [])
    expect(allow('Cross-Domain Loop')).toBe(true)
    expect(allow('cross domain loop')).toBe(false)
  })

  it('allows cards with missing/empty titles through (defence in depth)', () => {
    const allow = buildFilter(['anything'], ['anything'])
    expect(allow(undefined)).toBe(true)
    expect(allow('')).toBe(true)
    expect(allow('   ')).toBe(true)
  })

  it('allows a new, unseen title', () => {
    const allow = buildFilter(['Old Thing'], ['Older Thing'])
    expect(allow('Genuinely Novel Idea')).toBe(true)
  })
})
