import { describe, it, expect } from 'vitest'
import { scoreProjectHeat, HEAT_TUNING } from './metabolism'

// Controlled embeddings: identical vectors → cosine 1.0; orthogonal → 0.
const SAME = [1, 0]
const ORTHO = [0, 1]
const iso = (daysAgo = 1) => new Date(Date.now() - daysAgo * 86400000).toISOString()

function project(over: Partial<Parameters<typeof scoreProjectHeat>[0]> = {}) {
  return { id: 'p1', title: 'Sourdough Starter Journal', description: null, embedding: SAME, ...over } as any
}
const emptyInputs = { recentMemories: [], recentArticles: [], recentRetros: [] }

describe('scoreProjectHeat', () => {
  it('scores 0 when the project has no embedding', () => {
    const r = scoreProjectHeat(project({ embedding: null }), emptyInputs)
    expect(r.score).toBe(0)
    expect(r.reason).toBeNull()
  })

  it('accumulates (capped) and sets a reason for a highly-similar memory', () => {
    const r = scoreProjectHeat(project(), {
      ...emptyInputs,
      recentMemories: [{ id: 'm1', content: 'a thought about bread', embedding: SAME, created_at: iso() }],
    })
    // sim 1.0 → min(1*10, cap 8) = 8; reason set because 1.0 > MEMORY_SIM_REASON
    expect(r.score).toBe(HEAT_TUNING.MEMORY_WEIGHT_MAX)
    expect(r.evidence_ref).toBe('memory:m1')
    expect(r.reason).toContain('bread')
  })

  it('ignores a dissimilar memory below the accumulate threshold', () => {
    const r = scoreProjectHeat(project(), {
      ...emptyInputs,
      recentMemories: [{ id: 'm1', content: 'unrelated', embedding: ORTHO, created_at: iso() }],
    })
    expect(r.score).toBe(0)
    expect(r.reason).toBeNull()
  })

  it('adds the catalyst bonus and marks the catalyst matched when a memory contains its text', () => {
    const r = scoreProjectHeat(project({ catalysts: [{ text: 'logic pro' }] }), {
      ...emptyInputs,
      // orthogonal embedding so only the catalyst keyword match contributes
      recentMemories: [{ id: 'm9', content: 'my Logic Pro trial finally expired', embedding: ORTHO, created_at: iso() }],
    })
    expect(r.score).toBe(HEAT_TUNING.CATALYST_BONUS)
    expect(r.catalysts?.[0].matched).toBe(true)
    expect(r.catalysts?.[0].matched_evidence).toBe('memory:m9')
    expect(r.reason).toContain('logic pro')
  })

  it('does not mutate the input catalysts array (returns fresh objects)', () => {
    const cats = [{ text: 'logic pro' }]
    scoreProjectHeat(project({ catalysts: cats }), {
      ...emptyInputs,
      recentMemories: [{ id: 'm9', content: 'logic pro showed up', embedding: ORTHO, created_at: iso() }],
    })
    expect((cats[0] as any).matched).toBeUndefined() // original untouched
  })

  it('adds the retro bonus when project words overlap a retrospective', () => {
    const r = scoreProjectHeat(project(), {
      ...emptyInputs,
      recentRetros: [{ project_id: 'p1', answers: { note: 'my sourdough starter is thriving' }, created_at: iso() }],
    })
    // 'sourdough' + 'starter' both >5 chars and present → overlap 2 == RETRO_OVERLAP_MIN
    expect(r.score).toBe(HEAT_TUNING.RETRO_BONUS)
  })

  it('rounds the final score to one decimal place', () => {
    const r = scoreProjectHeat(project(), {
      ...emptyInputs,
      recentArticles: [{ id: 'a1', title: 'bread science', embedding: SAME, created_at: iso() }],
    })
    // article sim 1.0 → min(12, cap 10) = 10
    expect(r.score).toBe(HEAT_TUNING.ARTICLE_WEIGHT_MAX)
    expect(Number.isInteger(r.score * 10)).toBe(true)
  })
})
