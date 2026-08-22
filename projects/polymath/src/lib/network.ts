/**
 * Shared network helpers for write paths that must never hang on a flaky
 * connection. A bad cell signal often reports `navigator.onLine === true`
 * while requests silently stall — an un-timed-out fetch can hang for a
 * minute or more, which reads to the user as "the app froze" and, if it
 * eventually fails, as "my note just vanished."
 *
 * `fetchWithTimeout` bounds that wait and normalizes both a real connectivity
 * failure and our own abort into `NetworkError`, so callers can tell "the
 * network isn't there" (safe to queue and retry later) apart from "the
 * server rejected this" (a real error to surface).
 */

export class NetworkError extends Error {
  constructor(message = 'Network error') {
    super(message)
    this.name = 'NetworkError'
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : 'Network error')
  } finally {
    clearTimeout(timeoutId)
  }
}
