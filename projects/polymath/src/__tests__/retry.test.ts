import { describe, it, expect, vi } from 'vitest'
import { retryWithBackoff, CircuitBreaker } from '../lib/retry'

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retryWithBackoff(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('ok')

    const result = await retryWithBackoff(fn, { baseDelay: 10, maxDelay: 50 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10, maxDelay: 50 })
    ).rejects.toThrow('Failed to fetch')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable errors', async () => {
    const error = new Error('Bad request')
    Object.assign(error, { status: 400 })
    const fn = vi.fn().mockRejectedValue(error)

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 })
    ).rejects.toThrow('Bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects custom shouldRetry', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom'))
    const shouldRetry = vi.fn().mockReturnValue(false)

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10, shouldRetry })
    ).rejects.toThrow('custom')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(shouldRetry).toHaveBeenCalled()
  })
})

describe('CircuitBreaker', () => {
  it('allows requests when closed', async () => {
    const cb = new CircuitBreaker(3, 100)
    const result = await cb.execute(async () => 'ok')
    expect(result).toBe('ok')
    expect(cb.getState().state).toBe('closed')
  })

  it('opens after threshold failures', async () => {
    const cb = new CircuitBreaker(2, 100)

    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow()
    }

    expect(cb.getState().state).toBe('open')
    expect(cb.getState().failureCount).toBe(2)
  })

  it('rejects immediately when open', async () => {
    const cb = new CircuitBreaker(1, 60000)
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow()

    await expect(cb.execute(async () => 'ok')).rejects.toThrow('Circuit breaker is open')
  })

  it('transitions to half-open after timeout', async () => {
    const cb = new CircuitBreaker(1, 50) // 50ms timeout
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow()
    expect(cb.getState().state).toBe('open')

    // Wait for timeout
    await new Promise(r => setTimeout(r, 60))

    // Should try the request (half-open)
    const result = await cb.execute(async () => 'recovered')
    expect(result).toBe('recovered')
    expect(cb.getState().state).toBe('closed')
  })

  it('resets manually', async () => {
    const cb = new CircuitBreaker(1, 60000)
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow()
    expect(cb.getState().state).toBe('open')

    cb.reset()
    expect(cb.getState().state).toBe('closed')
    expect(cb.getState().failureCount).toBe(0)
  })
})
