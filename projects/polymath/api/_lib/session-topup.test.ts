import { describe, it, expect } from 'vitest'
import { buildTopupPrompt, topUpSession, TOPUP_SOURCE, type TopupInput } from './session-topup.js'
import type { Evidence } from './session-grounding.js'

const evidence: Evidence[] = [
  { id: 'e1', label: 'the finish line you set', text: 'A remixed track, out on the streaming services' },
  { id: 'e2', label: 'from your last close-out', text: 'Bounced the vocal, need a cleaner take next' },
]

const input: TopupInput = {
  title: 'Graham song',
  evidence,
  currentItems: ['Bounce a cleaner vocal take'],
  remainingMinutes: 25,
  maxItems: 2,
}

describe('buildTopupPrompt', () => {
  const p = buildTopupPrompt(input)

  it('says how much real time is left and hands over the closed evidence list', () => {
    expect(p).toContain('25 minutes')
    expect(p).toContain('[e1] A remixed track, out on the streaming services')
    expect(p).toContain('Anything not in it, you do not know')
  })

  it('lists what is already on the plan so it is not repeated', () => {
    expect(p).toContain('1. Bounce a cleaner vocal take')
    expect(p).toContain("don't repeat these")
  })

  it('says an empty list is the right, honest answer far more often than not', () => {
    expect(p).toContain('An empty list is the right, honest answer')
  })

  it('bans admin, invented specifics, and repeating the plan', () => {
    expect(p).toContain('research, plan, outline, decide')
    expect(p).toContain("isn't word for word in the evidence")
    expect(p).toContain('A repeat or rewording of anything already on the plan')
  })

  it('carries a worked example showing an empty list is also GOOD', () => {
    expect(p).toContain('BAD:')
    expect(p).toContain('GOOD:')
    expect(p).toContain('ALSO GOOD: an empty list')
  })

  it('says plainly when there is nothing on the plan yet', () => {
    expect(buildTopupPrompt({ ...input, currentItems: [] })).toContain('(nothing yet)')
  })
})

describe('topUpSession', () => {
  it('never calls the model when there is no room left to fill', async () => {
    expect(await topUpSession({ ...input, maxItems: 0 })).toEqual([])
  })

  it('never calls the model when there is no evidence to ground a suggestion in', async () => {
    expect(await topUpSession({ ...input, evidence: [] })).toEqual([])
  })

  it('stays short rather than inventing when the model is unreachable', async () => {
    // No GEMINI_API_KEY in the test env -- the real-world "silence over
    // slop" case: an empty session is honest, an invented item isn't.
    expect(await topUpSession(input)).toEqual([])
  })
})

describe('TOPUP_SOURCE', () => {
  it('reads as a proposal, not a committed step -- distinct from every other session-item caption', () => {
    expect(TOPUP_SOURCE).not.toBe('already on the project')
    expect(TOPUP_SOURCE.toLowerCase()).toContain('not committed')
  })
})
