import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FixDraft } from './types.js'

// Runner captures RESEND_API_KEY into a module-level const at import time.
// vi.hoisted runs BEFORE any import — including the dynamic runner import below —
// so the const sees the stubbed value.
const { sendMock } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'test-key'
  return { sendMock: vi.fn() }
})

vi.mock('resend', () => {
  class Resend {
    emails = { send: sendMock }
  }
  return { Resend }
})

const { executeFix } = await import('./runner.js')

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue({ id: 'mock-email-id' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeDraft(actions: FixDraft['actions']): FixDraft {
  return {
    name: 'Test fix',
    description: 'test',
    schedule: { cron: '* * * * *', timezone: 'UTC', description: 'x' },
    actions,
    estimated_cost: 'free',
  }
}

describe('executeFix', () => {
  it('runs a send_email action when requirements are satisfied', async () => {
    const draft = makeDraft([{
      type: 'send_email',
      to: 'me@example.com',
      subject: 'hi',
      body: 'hello',
    }])
    const result = await executeFix(draft)

    expect(result.success).toBe(true)
    expect(result.actions_run).toBe(1)
    expect(result.errors).toEqual([])
    expect(sendMock).toHaveBeenCalledOnce()
  })

  it('records per-action errors without aborting remaining actions', async () => {
    sendMock
      .mockReset()
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce({ id: 'ok' })

    const draft = makeDraft([
      { type: 'send_email', to: 'a@example.com', subject: 's1', body: 'b1' },
      { type: 'send_email', to: 'b@example.com', subject: 's2', body: 'b2' },
    ])
    const result = await executeFix(draft)

    expect(result.success).toBe(false)
    expect(result.actions_run).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/send_email: smtp down/)
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  it('runs http_request via fetch and records non-OK responses as errors', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 500, statusText: 'Server Error' }))

    const draft = makeDraft([{
      type: 'http_request',
      url: 'https://example.com/hook',
      method: 'POST',
      body: '{}',
    }])
    const result = await executeFix(draft)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    )
    expect(result.success).toBe(false)
    expect(result.errors[0]).toMatch(/HTTP 500/)
  })

  it('reports missing HOME_ASSISTANT_URL for smart_home:frame_tv', async () => {
    const savedUrl = process.env.HOME_ASSISTANT_URL
    const savedToken = process.env.HOME_ASSISTANT_TOKEN
    delete process.env.HOME_ASSISTANT_URL
    delete process.env.HOME_ASSISTANT_TOKEN

    try {
      const draft = makeDraft([{
        type: 'smart_home',
        device: 'frame_tv',
        command: 'art_mode_on',
      }])
      const result = await executeFix(draft)

      expect(result.success).toBe(false)
      expect(result.errors[0]).toMatch(/HOME_ASSISTANT_URL/)
    } finally {
      if (savedUrl !== undefined) process.env.HOME_ASSISTANT_URL = savedUrl
      if (savedToken !== undefined) process.env.HOME_ASSISTANT_TOKEN = savedToken
    }
  })

  it('reports missing BIRD_CAM_URL for smart_home:bird_cam', async () => {
    const savedUrl = process.env.HOME_ASSISTANT_URL
    const savedToken = process.env.HOME_ASSISTANT_TOKEN
    const savedCam = process.env.BIRD_CAM_URL
    delete process.env.HOME_ASSISTANT_URL
    delete process.env.HOME_ASSISTANT_TOKEN
    delete process.env.BIRD_CAM_URL

    try {
      const draft = makeDraft([{
        type: 'smart_home',
        device: 'bird_cam',
        command: 'snapshot',
      }])
      const result = await executeFix(draft)

      expect(result.success).toBe(false)
      expect(result.errors[0]).toMatch(/BIRD_CAM_URL/)
    } finally {
      if (savedUrl !== undefined) process.env.HOME_ASSISTANT_URL = savedUrl
      if (savedToken !== undefined) process.env.HOME_ASSISTANT_TOKEN = savedToken
      if (savedCam !== undefined) process.env.BIRD_CAM_URL = savedCam
    }
  })
})
