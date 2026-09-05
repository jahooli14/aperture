import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Evidence } from './session-grounding.js'
import type { BriefingInput } from './session-briefing.js'

vi.mock('./gemini-chat.js', () => ({ generateText: vi.fn() }))

const { generateText } = await import('./gemini-chat.js')
const { buildBriefingPrompt, briefSession, isUsableExitNote } = await import('./session-briefing.js')

const evidence: Evidence[] = [
  { id: 'e1', label: 'from your last close-out', text: 'Uprights are cut, need to glue them before the split gets worse' },
  { id: 'e4', label: 'already on the project', text: 'Glue and clamp the uprights' },
  { id: 'e5', label: 'already on the project', text: 'Sand the front edges' },
]

const input: BriefingInput = {
  title: 'The shelf',
  exitNote: 'Uprights are cut, need to glue them before the split gets worse',
  openSteps: [
    { id: 't4', text: 'Glue and clamp the uprights' },
    { id: 't5', text: 'Sand the front edges' },
  ],
  windowMinutes: 60,
  maxItems: 5,
  evidence,
  taskIdByEvidenceId: { e4: 't4', e5: 't5' },
  confidence: 'partial',
  knownSetup: null,
  knownPackdown: null,
}

beforeEach(() => vi.mocked(generateText).mockReset())

describe('isUsableExitNote', () => {
  it('rejects an acknowledgement rather than building a session on it', () => {
    expect(isUsableExitNote('Done.')).toBe(false)
    expect(isUsableExitNote('good session')).toBe(false)
    expect(isUsableExitNote(null)).toBe(false)
    expect(isUsableExitNote(undefined)).toBe(false)
  })

  it('accepts a note that actually says what comes next', () => {
    expect(isUsableExitNote('next up is the verse two vocal, it is flat')).toBe(true)
  })
})

describe('buildBriefingPrompt', () => {
  const p = buildBriefingPrompt(input)

  it('puts the exit note at the centre of the session', () => {
    expect(p).toContain('Uprights are cut, need to glue them')
    expect(p).toContain('most current, most precise thing')
  })

  it('says the item count is a ceiling and not a target', () => {
    expect(p).toContain('is a ceiling, not a target')
    expect(p).toContain('Fewer is better')
    expect(p).toContain('under-reach when unsure')
  })

  it('bans inventing a step outside the closed list', () => {
    expect(p).toContain('Invent a step')
    expect(p).toContain("If you can't cite it, you can't say it")
  })

  it('carries the clear-step rule so a step is never craft shorthand', () => {
    expect(p).toContain('without decoding it')
    expect(p).toContain('comp')
  })

  it('asks for setting up and clearing away, and says most projects need neither', () => {
    expect(p).toContain('SETTING UP AND CLEARING AWAY')
    expect(p).toContain('null for both is the common answer')
    expect(p).toContain('"packdown"')
  })

  it('repeats a setup already known about this project rather than re-inventing it', () => {
    const known = buildBriefingPrompt({
      ...input,
      knownSetup: { text: 'Get the paint and brushes out', minutes: 10 },
    })
    expect(known).toContain('already known to need: "Get the paint and brushes out" (10 min)')
  })
})

describe('briefSession', () => {
  it('never calls the model without a usable exit note', async () => {
    expect(await briefSession({ ...input, exitNote: 'Done.' })).toBeNull()
    expect(generateText).not.toHaveBeenCalled()
  })

  it('never calls the model when there are no open steps to draw on', async () => {
    expect(await briefSession({ ...input, openSteps: [] })).toBeNull()
    expect(generateText).not.toHaveBeenCalled()
  })

  it('resolves each item back to the real task id it cited', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [
        { text: 'Glue and clamp the uprights', evidence: ['e4'] },
        { text: 'Sand the front edges', evidence: ['e5'] },
      ],
      done_looks_like: 'Both uprights glued and the edges sanded.',
    }))
    const result = await briefSession(input)
    expect(result?.items.map(i => i.taskId)).toEqual(['t4', 't5'])
  })

  it('marks a reworded step partial, and a verbatim one not', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [
        { text: 'Glue and clamp the two uprights before the split gets worse', evidence: ['e4'] },
        { text: 'Sand the front edges', evidence: ['e5'] },
      ],
      done_looks_like: null,
    }))
    const result = await briefSession(input)
    expect(result?.items[0].partial).toBe(true)
    expect(result?.items[1].partial).toBe(false)
  })

  it('drops an item that does not resolve to a real step, however it was cited', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [
        { text: 'Glue and clamp the uprights', evidence: ['e4'] },
        // cites the close-out, not a step -- a real move, but not one on
        // the project, so the briefing has no business planning it
        { text: 'Buy more clamps', evidence: ['e1'] },
      ],
      done_looks_like: null,
    }))
    const result = await briefSession(input)
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].taskId).toBe('t4')
  })

  it('returns null when nothing grounded survives, so the caller falls back to the real list', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Pick up a bottle of Titebond III', evidence: ['e4'] }],
      done_looks_like: null,
    }))
    expect(await briefSession(input)).toBeNull()
  })

  it('returns null rather than half a session when the model is unreachable', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('boom'))
    expect(await briefSession(input)).toBeNull()
  })

  it('hands the raw setup and pack-down back for the caller to sanitize', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Glue and clamp the uprights', evidence: ['e4'] }],
      done_looks_like: null,
      setup: { text: 'Clear the bench', minutes: 10 },
      packdown: { text: 'Wipe the squeeze-out off', minutes: 5 },
    }))
    const result = await briefSession(input)
    expect(result?.rawSetup).toEqual({ text: 'Clear the bench', minutes: 10 })
    expect(result?.rawPackdown).toEqual({ text: 'Wipe the squeeze-out off', minutes: 5 })
  })
})
