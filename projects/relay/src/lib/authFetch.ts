/**
 * Patches fetch so every /api/ call carries the Supabase session token.
 * On a 401 it refreshes once and retries — a transient refresh failure must
 * not bounce someone out of a story they're halfway through reading.
 */
import { supabase } from './supabase'

const originalFetch = window.fetch.bind(window)

export function setupAuthFetch() {
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith('/api/')) return originalFetch(input, init)

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      const headers = new Headers(init?.headers)
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
      init = { ...init, headers }
    }

    const response = await originalFetch(input, init)
    if (response.status !== 401 || !token) return response

    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error || !refreshed.session?.access_token) return response

    const retry = new Headers(init?.headers)
    retry.set('Authorization', `Bearer ${refreshed.session.access_token}`)
    return originalFetch(input, { ...init, headers: retry })
  } as typeof window.fetch
}
