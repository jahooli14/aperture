import { supabase } from './supabase'

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }
  return {}
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new ApiError(
        408,
        `Request timeout after ${timeout}ms`,
        { timeout }
      )
    }
    throw error
  }
}

async function handleResponse(response: Response) {
  // Handle 204 No Content - no JSON to parse
  if (response.status === 204) {
    return null
  }

  // Read response text first (can only read body once)
  const text = await response.text()

  // Handle empty responses
  if (!text) {
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Request failed with status ${response.status}`,
        {}
      )
    }
    return null
  }

  // Parse JSON
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Request failed with status ${response.status}`,
        { text }
      )
    }
    throw new Error('Failed to parse response as JSON')
  }

  // Check if response indicates an error
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || data.details || `Request failed with status ${response.status}`,
      data
    )
  }

  return data
}

const pendingRequests = new Map<string, Promise<any>>()
const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

// The cache is keyed only by endpoint, not by user. Clear it on any auth
// change (sign-in / sign-out / token refresh) so a cached GET from a previous
// session can't be served to a different account within the TTL window.
supabase.auth.onAuthStateChange(() => {
  cache.clear()
  pendingRequests.clear()
})

// A failure worth one retry: a network blip, a request timeout, or a 5xx.
// 4xx (auth, validation, not-found) won't get better on a retry, so we don't.
function isTransientFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408
  }
  // Native fetch network failures surface as TypeError.
  return error instanceof TypeError
}

export const api = {
  get: async (endpoint: string, options: { timeout?: number } = {}) => {
    // 1. Check Cache
    const cached = cache.get(endpoint)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // 2. Check Pending Requests (Deduplication)
    if (pendingRequests.has(endpoint)) {
      return pendingRequests.get(endpoint)
    }

    // 3. Make Request with timeout (default 30s). GETs are safe to retry, so
    //    a single transient failure (network blip / 5xx / timeout) gets one
    //    automatic retry with a short backoff before surfacing to the UI.
    const promise = (async () => {
      try {
        const authHeaders = await getAuthHeaders()
        const doFetch = async () => {
          const response = await fetchWithTimeout(
            `/api/${endpoint}`,
            { headers: authHeaders },
            options.timeout || 30000
          )
          return handleResponse(response)
        }

        let data
        try {
          data = await doFetch()
        } catch (err) {
          if (!isTransientFailure(err)) throw err
          await new Promise(r => setTimeout(r, 600))
          data = await doFetch()
        }

        // Update Cache
        cache.set(endpoint, { data, timestamp: Date.now() })
        return data
      } finally {
        pendingRequests.delete(endpoint)
      }
    })()

    pendingRequests.set(endpoint, promise)
    return promise
  },

  post: async (endpoint: string, data: any, options: { timeout?: number } = {}) => {
    // Invalidate Cache on Mutation
    cache.clear()

    const authHeaders = await getAuthHeaders()
    const response = await fetchWithTimeout(
      `/api/${endpoint}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data)
      },
      options.timeout || 30000
    )
    return handleResponse(response)
  },

  patch: async (endpoint: string, data?: any, options: { timeout?: number } = {}) => {
    // Invalidate Cache on Mutation
    cache.clear()

    // For Vercel serverless routing, convert path-based IDs to query params
    // Special handling for priority endpoint: "projects/{id}/priority"  "projects?resource=priority&id={id}"
    let finalEndpoint = endpoint

    if (endpoint.includes('/priority')) {
      // Extract ID and convert to resource-based route
      const priorityMatch = endpoint.match(/^([^\/]+)\/([^\/]+)\/priority$/)
      if (priorityMatch) {
        const [, base, id] = priorityMatch
        finalEndpoint = `${base}?resource=priority&id=${id}`
      }
    } else {
      // Regular path conversion: "projects/abc-123"  "projects?id=abc-123"
      const pathMatch = endpoint.match(/^([^\/]+)\/([^\/\?]+)(.*)$/)
      if (pathMatch) {
        const [, base, id, rest] = pathMatch
        finalEndpoint = `${base}?id=${id}${rest}`
      }
    }

    const authHeaders = await getAuthHeaders()
    const response = await fetchWithTimeout(
      `/api/${finalEndpoint}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: data ? JSON.stringify(data) : undefined
      },
      options.timeout || 30000
    )
    return handleResponse(response)
  },

  delete: async (endpoint: string, options: { timeout?: number } = {}) => {
    // Invalidate Cache on Mutation
    cache.clear()

    // For Vercel serverless routing, convert path-based IDs to query params
    // e.g., "projects/abc-123"  "projects?id=abc-123"
    let finalEndpoint = endpoint
    const pathMatch = endpoint.match(/^([^\/]+)\/([^\/\?]+)(.*)$/)
    if (pathMatch) {
      const [, base, id, rest] = pathMatch
      finalEndpoint = `${base}?id=${id}${rest}`
    }

    const authHeaders = await getAuthHeaders()
    const response = await fetchWithTimeout(
      `/api/${finalEndpoint}`,
      {
        method: 'DELETE',
        headers: authHeaders
      },
      options.timeout || 30000
    )
    return handleResponse(response)
  }
}

export { ApiError }
