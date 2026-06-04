import { describe, it, expect } from 'vitest'
import {
  tokenise,
  topicalOverlap,
  parseEmbedding,
  cosineToRelatedness,
  relatedness,
  pickSeedPairs,
  SEMANTIC_FLOOR,
  SEMANTIC_CEIL,
} from './seed-picker'
import type { GatherResult } from './types'

describe('tokenise', () => {
  it('lowercases, splits on non-alphanumerics, drops short tokens and stopwords', () => {
    const t = tokenise('The quick brown Fox-jumps! AI ok')
    expect(t.has('quick')).toBe(true)
    expect(t.has('brown')).toBe(true)
    expect(t.has('fox')).toBe(true)
    expect(t.has('jumps')).toBe(true)
    expect(t.has('the')).toBe(false) // stopword
    expect(t.has('ai')).toBe(false)  // < 3 chars
    expect(t.has('ok')).toBe(false)  // < 3 chars
  })

  it('returns an empty set for empty/falsy input', () => {
    expect(tokenise('').size).toBe(0)
    expect(tokenise(undefined as any).size).toBe(0)
  })
})

describe('topicalOverlap (Jaccard)', () => {
  it('is 1.0 for identical sets', () => {
    expect(topicalOverlap(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c']))).toBe(1)
  })

  it('is 0 for disjoint or empty sets', () => {
    expect(topicalOverlap(new Set(['a', 'b']), new Set(['c', 'd']))).toBe(0)
    expect(topicalOverlap(new Set(), new Set(['a']))).toBe(0)
  })

  it('computes intersection-over-union', () => {
    // {a,b,c} vs {b,c,d}: inter 2, union 4 → 0.5
    expect(topicalOverlap(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(0.5)
    // {a,b} vs {b,c,d,e}: inter 1, union 5 → 0.2
    expect(topicalOverlap(new Set(['a', 'b']), new Set(['b', 'c', 'd', 'e']))).toBeCloseTo(0.2)
  })
})

describe('parseEmbedding', () => {
  it('passes through a non-empty number array', () => {
    expect(parseEmbedding([0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3])
  })

  it('parses the JSON string form Supabase returns for pgvector', () => {
    expect(parseEmbedding('[0.1,0.2,0.3]')).toEqual([0.1, 0.2, 0.3])
  })

  it('returns null for null, empty, or malformed input', () => {
    expect(parseEmbedding(null)).toBeNull()
    expect(parseEmbedding(undefined)).toBeNull()
    expect(parseEmbedding([])).toBeNull()
    expect(parseEmbedding('not json')).toBeNull()
    expect(parseEmbedding('{}')).toBeNull()
    expect(parseEmbedding(42)).toBeNull()
  })
})

describe('cosineToRelatedness', () => {
  it('is 0 at or below the floor (unrelated → no topical boost)', () => {
    expect(cosineToRelatedness(SEMANTIC_FLOOR)).toBe(0)
    expect(cosineToRelatedness(SEMANTIC_FLOOR - 0.1)).toBe(0)
    expect(cosineToRelatedness(0)).toBe(0)
    expect(cosineToRelatedness(-0.3)).toBe(0)
  })

  it('is 1 at or above the ceiling (a real "this is about that" hit)', () => {
    expect(cosineToRelatedness(SEMANTIC_CEIL)).toBe(1)
    expect(cosineToRelatedness(1)).toBe(1)
  })

  it('is linear between floor and ceiling', () => {
    const mid = (SEMANTIC_FLOOR + SEMANTIC_CEIL) / 2
    expect(cosineToRelatedness(mid)).toBeCloseTo(0.5)
  })

  it('treats non-finite cosine as unrelated', () => {
    expect(cosineToRelatedness(NaN)).toBe(0)
  })
})

describe('relatedness', () => {
  it('uses cosine when both sides are embedded', () => {
    // [1,0,0] vs itself → cosine 1 → above ceiling → 1, semantic true.
    const r = relatedness(
      { embedding: [1, 0, 0], tokens: new Set(['ignored']) },
      { embedding: [1, 0, 0], tokens: new Set(['unrelated']) },
    )
    expect(r.semantic).toBe(true)
    expect(r.value).toBe(1)
  })

  it('orthogonal embeddings → unrelated even if tokens overlap', () => {
    const r = relatedness(
      { embedding: [1, 0, 0], tokens: new Set(['synth', 'audio']) },
      { embedding: [0, 1, 0], tokens: new Set(['synth', 'audio']) },
    )
    expect(r.semantic).toBe(true)
    expect(r.value).toBe(0)
  })

  it('falls back to Jaccard token overlap when either embedding is missing', () => {
    const r = relatedness(
      { embedding: null, tokens: new Set(['a', 'b', 'c']) },
      { embedding: [1, 0, 0], tokens: new Set(['b', 'c', 'd']) },
    )
    expect(r.semantic).toBe(false)
    expect(r.value).toBe(0.5) // {a,b,c} vs {b,c,d}: inter 2 / union 4
  })
})

function makeGather(overrides: Partial<GatherResult>): GatherResult {
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
    blocked_project_ids: [],
    recently_mined: [],
    total_signal_count: 0,
    ...overrides,
  }
}

describe('pickSeedPairs — semantic ranking', () => {
  const nowIso = new Date().toISOString()

  it('prefers the semantically nearer arrival when recency is equal', () => {
    // One dormant centre; two equally-recent memories. The near memory shares
    // no keywords with the centre but is close in embedding space; the far
    // memory is orthogonal. Cosine should float the near one to the top —
    // exactly the convergence Jaccard would have missed.
    const g = makeGather({
      dormant_projects: [
        { id: 'centre', title: 'Modular rig', description: '', status: 'dormant', updated_at: nowIso, embedding: [1, 0, 0] },
      ],
      memories: [
        { id: 'near', title: 'a note', body: 'sound that decays slowly over time', themes: [], memory_type: null, created_at: nowIso, embedding: [0.9, 0.43589, 0] }, // cos ≈ 0.9
        { id: 'far', title: 'b note', body: 'tax return spreadsheet admin', themes: [], memory_type: null, created_at: nowIso, embedding: [0, 1, 0] }, // cos 0
      ],
    })
    const picked = pickSeedPairs(g, { count: 1 })
    expect(picked).toHaveLength(1)
    expect(picked[0].arrival.id).toBe('near')
    expect(picked[0].semantic).toBe(true)
    expect(picked[0].relatedness).toBe(1)
  })

  it('falls back to token overlap when embeddings are absent', () => {
    const g = makeGather({
      dormant_projects: [
        { id: 'centre', title: 'Synth build', description: 'eurorack modular', status: 'dormant', updated_at: nowIso },
      ],
      memories: [
        { id: 'near', title: 'modular note', body: 'wiring the eurorack modular synth today', themes: [], memory_type: null, created_at: nowIso },
        { id: 'far', title: 'lunch', body: 'thinking about sandwiches and soup again', themes: [], memory_type: null, created_at: nowIso },
      ],
    })
    const picked = pickSeedPairs(g, { count: 1 })
    expect(picked).toHaveLength(1)
    expect(picked[0].arrival.id).toBe('near')
    expect(picked[0].semantic).toBe(false)
    expect(picked[0].relatedness).toBeGreaterThan(0)
  })
})
