/**
 * Exponential backoff with jitter utility for retry logic
 * Helps prevent thundering herd problem and server overload
 */

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number // milliseconds
  maxDelay?: number // milliseconds
  shouldRetry?: (error: any) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  shouldRetry: (error: any) => {
    // Retry on network errors and 5xx server errors
    if (error.name === 'TypeError' || error.message?.includes('Failed to fetch')) {
      return true
    }
    if (error.status >= 500 && error.status < 600) {
      return true
    }
    // Retry on rate limits (429)
    if (error.status === 429) {
      return true
    }
    return false
  }
}

/**
 * Retry a function with exponential backoff and jitter
 *
 * @example
 * const result = await retryWithBackoff(
 *   async () => await fetch('/api/endpoint'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * )
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if this is the last attempt
      if (attempt === opts.maxRetries - 1) {
        throw error
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = opts.baseDelay * Math.pow(2, attempt)

      // Add jitter (random value between 0 and 1000ms)
      const jitter = Math.random() * 1000

      // Apply max delay cap
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelay)

      console.log(
        `[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed. Retrying in ${Math.round(delay)}ms...`,
        error instanceof Error ? error.message : error
      )

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Circuit breaker to prevent repeated failures from overwhelming the system
 */
export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold: number = 5, // failures before opening
    private timeout: number = 60000 // 60s before trying again
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now()
      if (now - this.lastFailureTime >= this.timeout) {
        console.log('[CircuitBreaker] Transitioning to half-open, attempting request')
        this.state = 'half-open'
      } else {
        const remainingMs = this.timeout - (now - this.lastFailureTime)
        throw new Error(
          `Circuit breaker is open. Retry in ${Math.round(remainingMs / 1000)}s`
        )
      }
    }

    try {
      const result = await fn()

      // Success - reset circuit breaker
      if (this.state === 'half-open') {
        console.log('[CircuitBreaker] Half-open request succeeded, closing circuit')
        this.state = 'closed'
      }
      this.failureCount = 0
      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.threshold) {
        console.error(
          `[CircuitBreaker] Threshold reached (${this.failureCount} failures), opening circuit`
        )
        this.state = 'open'
      }

      throw error
    }
  }

  reset() {
    this.failureCount = 0
    this.state = 'closed'
    console.log('[CircuitBreaker] Manually reset')
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    }
  }
}
