/**
 * Authenticated fetch interceptor.
 * Patches the global fetch to automatically attach Supabase session tokens
 * to all /api/ requests. Call setupAuthFetch() once at app startup.
 *
 * Also handles 401 responses by refreshing the session and retrying once.
 */
import { supabase } from './supabase'

const originalFetch = window.fetch.bind(window)

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export function setupAuthFetch() {
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Only intercept requests to our own API
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!url.startsWith('/api/')) {
      return originalFetch(input, init)
    }

    // Attach auth token
    const token = await getAccessToken()
    if (token) {
      const headers = new Headers(init?.headers)
      // Don't override if already set (e.g. cron auth)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      init = { ...init, headers }
    }

    const response = await originalFetch(input, init)

    // On 401, try refreshing the session and retry once
    if (response.status === 401 && token) {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
      if (!error && refreshed?.access_token) {
        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set('Authorization', `Bearer ${refreshed.access_token}`)
        return originalFetch(input, { ...init, headers: retryHeaders })
      }
      // Refresh failed — the local session is dead. Sign out so onAuthStateChange
      // fires SIGNED_OUT, AuthContext clears state, and the user sees the login
      // screen instead of every API call silently returning 401.
      console.warn('[authFetch] Session refresh failed on 401 — signing out')
      await supabase.auth.signOut()
    }

    return response
  } as typeof window.fetch
}
