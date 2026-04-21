/**
 * Authenticated fetch interceptor.
 * Patches the global fetch to automatically attach Supabase session tokens
 * to all /api/ requests. Call setupAuthFetch() once at app startup.
 *
 * On 401 we try refreshing the session once and retry. We do NOT force a
 * sign-out here: a transient refresh failure (network blip, rate limit, a
 * backend 401 that isn't actually a token-expiry) shouldn't nuke the local
 * session and bounce the user to the login screen. Supabase's own
 * auto-refresh fires SIGNED_OUT via onAuthStateChange when the refresh
 * token is genuinely dead — that's the right place to clear auth state.
 */
import { supabase } from './supabase'
import type { AuthError } from '@supabase/supabase-js'

const originalFetch = window.fetch.bind(window)

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// A refresh_token_not_found / invalid_grant error means the session is truly
// dead and the user must sign in again. Anything else (network, 5xx, rate
// limit) is transient and should not sign the user out.
function isDeadSessionError(error: AuthError | null): boolean {
  if (!error) return false
  const code = (error as { code?: string }).code
  if (code === 'refresh_token_not_found' || code === 'invalid_grant') return true
  const status = (error as { status?: number }).status
  return status === 400 || status === 401 || status === 403
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

    // On 401, try refreshing the session once and retry.
    if (response.status === 401 && token) {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
      if (!error && refreshed?.access_token) {
        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set('Authorization', `Bearer ${refreshed.access_token}`)
        return originalFetch(input, { ...init, headers: retryHeaders })
      }
      if (error) {
        console.warn('[authFetch] Session refresh failed on 401:', error.message)
        // Only sign out if the refresh token itself is dead. Otherwise keep
        // the local session intact — the 401 gets surfaced to the caller and
        // the user isn't dropped into a redirect loop on transient errors.
        if (isDeadSessionError(error)) {
          await supabase.auth.signOut()
        }
      }
    }

    return response
  } as typeof window.fetch
}
