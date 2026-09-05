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
 *
 * `isOnline`/`onNetworkChange` are Capacitor-aware connectivity checks.
 * navigator.onLine is unreliable on Android (it can report true on a
 * captive-portal or dead wifi connection), so native platforms use
 * @capacitor/network's real status instead. Web keeps the old behaviour.
 */

import { Network } from '@capacitor/network'
import { isNative } from './platform'

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

export async function isOnline(): Promise<boolean> {
  if (isNative()) {
    const status = await Network.getStatus()
    return status.connected
  }
  return navigator.onLine
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function.
 */
export function onNetworkChange(cb: (online: boolean) => void): () => void {
  if (isNative()) {
    let removed = false
    let handle: { remove: () => void } | undefined

    Network.addListener('networkStatusChange', (status) => {
      if (!removed) cb(status.connected)
    }).then((h) => {
      if (removed) {
        h.remove()
      } else {
        handle = h
      }
    })

    return () => {
      removed = true
      handle?.remove()
    }
  }

  const handleOnline = () => cb(true)
  const handleOffline = () => cb(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
