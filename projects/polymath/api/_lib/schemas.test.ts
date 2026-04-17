import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CaptureMemoryBody,
  CaptureTitleResponse,
  ExtractMetadataResponse,
  FixAction,
  FixDraftResponse,
  MAX_MEMORY_BODY_CHARS,
  MAX_TITLE_CHARS,
  MAX_TAGS,
  validate,
  tryValidate,
} from './schemas'

describe('CaptureMemoryBody', () => {
  it('accepts a minimal transcript payload', () => {
    const result = CaptureMemoryBody.safeParse({ transcript: 'hello world' })
    expect(result.success).toBe(true)
  })

  it('accepts a checklist-only payload with no transcript/body', () => {
    const result = CaptureMemoryBody.safeParse({
      checklist_items: [{ text: 'buy milk' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a payload with no content at all', () => {
    const result = CaptureMemoryBody.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects transcripts above MAX_MEMORY_BODY_CHARS', () => {
    const oversized = 'a'.repeat(MAX_MEMORY_BODY_CHARS + 1)
    const result = CaptureMemoryBody.safeParse({ transcript: oversized })
    expect(result.success).toBe(false)
  })

  it('rejects more than MAX_TAGS tags', () => {
    const tooManyTags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag${i}`)
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      tags: tooManyTags,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown memory_type values', () => {
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      memory_type: 'not-a-real-type',
    })
    expect(result.success).toBe(false)
  })

  it('accepts source_reference as a string (legacy shape)', () => {
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      source_reference: 'project:abc',
    })
    expect(result.success).toBe(true)
  })

  it('accepts source_reference as null', () => {
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      source_reference: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts source_reference as a structured object', () => {
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      source_reference: { type: 'list_item', id: 'abc' },
    })
    expect(result.success).toBe(true)
  })

  it('allows memory_type = null (explicit clear)', () => {
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      memory_type: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects titles above MAX_TITLE_CHARS', () => {
    const result = CaptureMemoryBody.safeParse({
      transcript: 'ok',
      title: 'a'.repeat(MAX_TITLE_CHARS + 1),
    })
    expect(result.success).toBe(false)
  })
})

describe('CaptureTitleResponse', () => {
  it('accepts a valid title + bullets payload', () => {
    const result = CaptureTitleResponse.safeParse({
      title: 'Test note',
      bullets: ['first point', 'second point'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = CaptureTitleResponse.safeParse({
      title: '',
      bullets: ['one'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty bullets array', () => {
    const result = CaptureTitleResponse.safeParse({
      title: 'Something',
      bullets: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('ExtractMetadataResponse', () => {
  it('accepts a minimal structured response with defaults filling in', () => {
    const result = ExtractMetadataResponse.safeParse({
      memory_type: 'insight',
      entities: {},
      summary_title: 'A title',
      insightful_body: 'body',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entities.people).toEqual([])
      expect(result.data.themes).toEqual([])
      expect(result.data.emotional_tone).toBe('')
    }
  })

  it('rejects unknown memory_type', () => {
    const result = ExtractMetadataResponse.safeParse({
      memory_type: 'rumination',
      entities: {},
      summary_title: 'A',
      insightful_body: 'B',
    })
    expect(result.success).toBe(false)
  })

  it('rejects triage.confidence outside 0..1', () => {
    const result = ExtractMetadataResponse.safeParse({
      memory_type: 'insight',
      entities: {},
      summary_title: 'A',
      insightful_body: 'B',
      triage: { category: 'task_update', confidence: 1.5 },
    })
    expect(result.success).toBe(false)
  })
})

describe('FixAction discriminated union', () => {
  it('accepts a valid send_email action', () => {
    const result = FixAction.safeParse({
      type: 'send_email',
      to: 'me@example.com',
      subject: 'hi',
      body: 'hello',
    })
    expect(result.success).toBe(true)
  })

  it('rejects send_email with a non-email "to" field', () => {
    const result = FixAction.safeParse({
      type: 'send_email',
      to: 'not-an-email',
      subject: 'hi',
      body: 'hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown action type', () => {
    const result = FixAction.safeParse({
      type: 'nuke_from_orbit',
      to: 'me@example.com',
    })
    expect(result.success).toBe(false)
  })

  it('accepts weather_email with in-range coords', () => {
    const result = FixAction.safeParse({
      type: 'weather_email',
      to: 'me@example.com',
      subject: 'Weather',
      lat: 51.5,
      lon: -0.1,
      template: 'Today: {{weather}}',
    })
    expect(result.success).toBe(true)
  })

  it('rejects weather_email with lat out of range', () => {
    const result = FixAction.safeParse({
      type: 'weather_email',
      to: 'me@example.com',
      subject: 'Weather',
      lat: 120,
      lon: 0,
      template: 'x',
    })
    expect(result.success).toBe(false)
  })

  it('rejects http_request with invalid method', () => {
    const result = FixAction.safeParse({
      type: 'http_request',
      url: 'https://example.com',
      method: 'DELETE',
    })
    expect(result.success).toBe(false)
  })

  it('rejects smart_home with unknown device', () => {
    const result = FixAction.safeParse({
      type: 'smart_home',
      device: 'toaster',
      command: 'on',
    })
    expect(result.success).toBe(false)
  })
})

describe('FixDraftResponse', () => {
  it('accepts a minimal valid draft', () => {
    const result = FixDraftResponse.safeParse({
      name: 'Morning digest',
      description: 'daily summary',
      schedule: { cron: '0 8 * * *', timezone: 'Europe/London', description: 'Every day 8am' },
      actions: [{
        type: 'send_email',
        to: 'me@example.com',
        subject: 'hi',
        body: 'hello',
      }],
      estimated_cost: '$0.01/month',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a draft with zero actions', () => {
    const result = FixDraftResponse.safeParse({
      name: 'noop',
      description: 'x',
      schedule: { cron: '* * * * *', timezone: 'UTC', description: 'x' },
      actions: [],
      estimated_cost: 'free',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a draft where one action is malformed', () => {
    const result = FixDraftResponse.safeParse({
      name: 'bad',
      description: 'x',
      schedule: { cron: '* * * * *', timezone: 'UTC', description: 'x' },
      actions: [{
        type: 'send_email',
        to: 'not-an-email',
        subject: 'hi',
        body: 'hello',
      }],
      estimated_cost: 'free',
    })
    expect(result.success).toBe(false)
  })
})

describe('validate()', () => {
  it('returns typed data on success', () => {
    const out = validate(CaptureTitleResponse, { title: 'ok', bullets: ['a'] }, 'test')
    expect(out.title).toBe('ok')
  })

  it('throws with label and path on failure', () => {
    expect(() =>
      validate(CaptureTitleResponse, { title: '', bullets: [] }, 'test-label'),
    ).toThrow(/test-label/)
  })
})

describe('tryValidate()', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns parsed value on success', () => {
    const out = tryValidate(CaptureTitleResponse, { title: 'ok', bullets: ['a'] }, 'label')
    expect(out?.title).toBe('ok')
  })

  it('returns null on failure and logs a warning', () => {
    const out = tryValidate(CaptureTitleResponse, { bogus: true }, 'label')
    expect(out).toBeNull()
    expect(warnSpy).toHaveBeenCalledOnce()
  })
})
