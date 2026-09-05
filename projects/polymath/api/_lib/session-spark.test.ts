import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Evidence } from './session-grounding.js'
import type { SparkInput, WeekSignal } from './session-spark.js'

vi.mock('./gemini-chat.js', () => ({ generateText: vi.fn() }))

const { generateText } = await import('./gemini-chat.js')
const { buildSparkPrompt, sparkForSession, sparkMinutesCap } = await import('./session-spark.js')

const projectEvidence: Evidence[] = [
  { id: 'e1', label: 'the finish line you set', text: 'A finished song, second verse still empty' },
]

const weekSignals: WeekSignal[] = [
  { id: 'w1', label: 'you added to a list', text: 'garage', source: 'you added "garage" to a list' },
  { id: 'w2', label: 'you have been reading', text: 'The Art of Cutting', source: 'you’ve been reading "The Art of Cutting"' },
]

const input: SparkInput = {
  title: 'Graham song',
  projectEvidence,
  weekSignals,
  currentItems: ['Record the second verse'],
  windowMinutes: 60,
}

beforeEach(() => vi.mocked(generateText).mockReset())

describe('sparkMinutesCap', () => {
  it('never lets a punt eat a meaningful share of a short window', () => {
    expect(sparkMinutesCap(20)).toBe(5)
  })

  it('allows a proper ten-to-fifteen minutes of an hour or more', () => {
    expect(sparkMinutesCap(60)).toBe(15)
    expect(sparkMinutesCap(120)).toBe(15)
  })

  it('falls back to the hard ceiling when the window is unknown', () => {
    expect(sparkMinutesCap(null)).toBe(15)
  })
})

describe('buildSparkPrompt', () => {
  const p = buildSparkPrompt(input)

  it('keeps the project and the week as separate, both citable', () => {
    expect(p).toContain('WHAT THIS PROJECT IS')
    expect(p).toContain("WHAT THEY'VE BEEN INTO LATELY")
    expect(p).toContain('[w1] garage')
  })

  it('says an empty answer is right most of the time', () => {
    expect(p).toContain('right answer most of the time')
    expect(p).toContain('forced connection is worse than')
  })

  it('lists the plan so the punt does not restate a real step', () => {
    expect(p).toContain('1. Record the second verse')
  })

  it('carries the clear-step rule', () => {
    expect(p).toContain('without decoding it')
  })
})

describe('sparkForSession', () => {
  it('never calls the model when the week has been quiet', async () => {
    expect(await sparkForSession({ ...input, weekSignals: [] })).toBeNull()
    expect(generateText).not.toHaveBeenCalled()
  })

  it('builds the visible source line from the signal it actually cited', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Chop a vocal into a stutter under the second half', evidence: ['w1'], minutes: 10 }],
    }))
    const spark = await sparkForSession(input)
    // w1, not w2 -- the receipt has to be true of what it came from
    expect(spark?.source).toContain('you added "garage" to a list')
    expect(spark?.source).not.toContain('The Art of Cutting')
    expect(spark?.source).toContain("while you're in there")
  })

  it('never carries a taskId, so it is not a step on the project', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Chop a vocal into a stutter under the second half', evidence: ['w1'], minutes: 10 }],
    }))
    expect((await sparkForSession(input))?.taskId).toBeNull()
  })

  it('caps the minutes to the window share, whatever the model asked for', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Chop a vocal into a stutter under the second half', evidence: ['w1'], minutes: 45 }],
    }))
    const spark = await sparkForSession({ ...input, windowMinutes: 20 })
    expect(spark?.source).toContain('5 min')
  })

  it('lets a real translation through even though it shares no words with the signal', async () => {
    // The whole point: "chop a vocal into a stutter" is a good answer to a
    // week of garage precisely because it doesn't say "garage" back. A
    // vocabulary-overlap gate would reject every genuine spark.
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Chop a vocal into a stutter under the second half', evidence: ['w1'], minutes: 10 }],
    }))
    const spark = await sparkForSession(input)
    expect(spark?.text).toBe('Chop a vocal into a stutter under the second half')
  })

  it('still kills an invented specific -- the gear code nothing above mentions', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Add a Roland TR-909 shuffle under the second half', evidence: ['w1'], minutes: 10 }],
    }))
    expect(await sparkForSession(input)).toBeNull()
  })

  it('drops a punt that cites nothing from the week', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Play the whole thing back once', evidence: ['e1'], minutes: 10 }],
    }))
    expect(await sparkForSession(input)).toBeNull()
  })

  it('drops a punt that just restates a step already on the plan', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({
      items: [{ text: 'Record the second verse', evidence: ['w1'], minutes: 10 }],
    }))
    expect(await sparkForSession(input)).toBeNull()
  })

  it('goes without rather than inventing when the model is unreachable', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('boom'))
    expect(await sparkForSession(input)).toBeNull()
  })

  it('returns nothing when the model honestly finds no connection', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({ items: [] }))
    expect(await sparkForSession(input)).toBeNull()
  })
})
