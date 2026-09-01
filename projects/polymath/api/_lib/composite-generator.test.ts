import { describe, it, expect } from 'vitest'
import { buildCompositeEvidence, buildCompositePrompt } from './composite-generator.js'

const JOINT = { text: 'You keep saying you want things to feel handmade, not perfect.' }

const PROJECT_A = {
  id: 'proj-a',
  title: 'Record shelf',
  description: 'A wooden shelf for the record collection.',
  last_session_ended_at: null,
  slots: [{ filled: false }],
  fragments: [{ id: 'frag-1', text: 'Want to use reclaimed oak if I can find some.' }],
}
const PROJECT_B = {
  id: 'proj-b',
  title: 'DJ sets',
  description: 'Learning to mix vinyl for house parties.',
  last_session_ended_at: null,
  slots: [{ filled: false }],
  fragments: [{ id: 'frag-2', text: 'Keep leaning towards scratchy, worn-in records over clean pressings.' }],
}

describe('buildCompositeEvidence', () => {
  it('puts the joint first — everything else is checked against real evidence, this is the seed', () => {
    const { evidence } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    expect(evidence[0].text).toContain('feel handmade')
  })

  it('includes every stalled project considered, not just the eventual pair', () => {
    const { evidence } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    expect(evidence.map(e => e.text)).toContain('A wooden shelf for the record collection.')
    expect(evidence.map(e => e.text)).toContain('Learning to mix vinyl for house parties.')
  })

  it('includes each project\'s fragments, and maps evidence ids back to real fragment ids', () => {
    const { evidence, fragmentIdByEvidenceId } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    const oakEntry = evidence.find(e => e.text.includes('reclaimed oak'))
    expect(oakEntry).toBeDefined()
    expect(fragmentIdByEvidenceId[oakEntry!.id]).toBe('frag-1')
  })

  it('does not map a fragment id for the joint or a bare description', () => {
    const { evidence, fragmentIdByEvidenceId } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    const jointEntry = evidence.find(e => e.text.includes('feel handmade'))!
    const descEntry = evidence.find(e => e.text === 'A wooden shelf for the record collection.')!
    expect(fragmentIdByEvidenceId[jointEntry.id]).toBeUndefined()
    expect(fragmentIdByEvidenceId[descEntry.id]).toBeUndefined()
  })
})

describe('buildCompositePrompt', () => {
  const { evidence } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
  const prompt = buildCompositePrompt(JOINT, [PROJECT_A, PROJECT_B], evidence)

  it('bans invented detail the same way session items are banned from it', () => {
    expect(prompt).toContain('NEVER INVENT A DETAIL')
    expect(prompt).toContain("if you can't cite it, you can't say it")
  })

  it('hands over a closed, numbered evidence list', () => {
    expect(prompt).toContain('EVERYTHING KNOWN')
    expect(prompt).toContain('[e1]')
    expect(prompt).toContain('Anything not in it, you do not know')
  })

  it('asks for the response to cite its evidence', () => {
    expect(prompt).toContain('"evidence": ["e1", "e2"]')
  })

  it('still asks which two projects it applies to, by real id', () => {
    expect(prompt).toContain('[project:proj-a]')
    expect(prompt).toContain('[project:proj-b]')
  })

  it('carries the plain-English voice rules', () => {
    expect(prompt.toLowerCase()).toContain('plain english')
  })
})

describe('grounding blocks an invented composite — the real proposeComposite gates', () => {
  // These call the actual two gates proposeComposite runs, in the order it
  // runs them: filterGrounded (specifics + per-citation), then
  // hasAdequateCoverage (whole-sentence word coverage). A model that
  // smuggles an invention past ONE citation by sharing a single real word
  // ("shelf") is exactly what the second gate exists to catch — this is
  // the failure a first version of this fix let straight through.
  it('lets a single shared word slip past filterGrounded alone', async () => {
    const { filterGrounded } = await import('./session-grounding.js')
    const { evidence } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    const invented = 'Build the shelf frame from powder-coated steel tubing and mount a turntable in it.'
    const { kept } = filterGrounded([{ text: invented, evidence: ['e2'] }], evidence, 'the composite')
    expect(kept).toHaveLength(1) // passes on "shelf" alone -- this is why the second gate exists
  })

  it('the coverage gate catches what filterGrounded let through', async () => {
    const { hasAdequateCoverage } = await import('./session-grounding.js')
    const { evidence } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    const invented = 'Build the shelf frame from powder-coated steel tubing and mount a turntable in it.'
    expect(hasAdequateCoverage(invented, evidence)).toBe(false)
  })

  it('an honest fusion clears both gates', async () => {
    const { filterGrounded, hasAdequateCoverage } = await import('./session-grounding.js')
    const { evidence } = buildCompositeEvidence(JOINT, [PROJECT_A, PROJECT_B])
    const honest = 'Build the shelf from reclaimed oak and store the worn-in records you already prefer on it.'
    const { kept } = filterGrounded(
      [{ text: honest, evidence: evidence.map(e => e.id) }],
      evidence,
      'the composite',
    )
    expect(kept).toHaveLength(1)
    expect(hasAdequateCoverage(honest, evidence)).toBe(true)
  })
})

describe('attachFragments', () => {
  function stubClient(rows: { id: string; project_id: string; text: string; created_at: string }[]) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any
  }

  const base = [PROJECT_A, PROJECT_B].map(p => ({ ...p, fragments: [] }))

  it('caps fragments per project, not across all projects combined', async () => {
    const { attachFragments } = await import('./composite-generator.js')
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `a${i}`, project_id: 'proj-a', text: `note a${i}`, created_at: `2026-01-0${(i % 9) + 1}`,
      })),
      { id: 'b0', project_id: 'proj-b', text: 'note b0', created_at: '2026-01-01' },
    ]
    const result = await attachFragments(stubClient(rows), 'u1', base)
    const a = result.find(p => p.id === 'proj-a')!
    const b = result.find(p => p.id === 'proj-b')!
    expect(a.fragments.length).toBe(4) // FRAGMENTS_PER_PROJECT, not starved by proj-a's own volume
    expect(b.fragments.length).toBe(1)
  })

  it('leaves fragments empty for a project with none, rather than erroring', async () => {
    const { attachFragments } = await import('./composite-generator.js')
    const result = await attachFragments(stubClient([]), 'u1', base)
    expect(result.every(p => p.fragments.length === 0)).toBe(true)
  })

  it('is a no-op on an empty project list', async () => {
    const { attachFragments } = await import('./composite-generator.js')
    expect(await attachFragments(stubClient([]), 'u1', [])).toEqual([])
  })
})
