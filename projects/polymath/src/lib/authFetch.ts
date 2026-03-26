/**
 * Authenticated fetch interceptor.
 * Patches the global fetch to automatically attach Supabase session tokens
 * to all /api/ requests. Call setupAuthFetch() once at app startup.
 */
import { supabase } from './supabase'

const originalFetch = window.fetch.bind(window)

export function setupAuthFetch() {
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Only intercept requests to our own API
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.startsWith('/api/')) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const headers = new Headers(init?.headers)
        // Don't override if already set (e.g. cron auth)
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${session.access_token}`)
        }
        init = { ...init, headers }
      }
    }
    return originalFetch(input, init)
  } as typeof window.fetch
}
