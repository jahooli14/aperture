/**
 * Centralized API Client
 * Single source of truth for all frontend API calls
 */

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message)
    this.name = 'ApiError'
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

export const api = {
  get: async (endpoint: string) => {
    // 1. Check Cache
    const cached = cache.get(endpoint)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // 2. Check Pending Requests (Deduplication)
    if (pendingRequests.has(endpoint)) {
      return pendingRequests.get(endpoint)
    }

    // 3. Make Request
    const promise = (async () => {
      try {
        const response = await fetch(`/api/${endpoint}`)
        const data = await handleResponse(response)

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

  post: async (endpoint: string, data: any) => {
    // Invalidate Cache on Mutation
    cache.clear()

    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(response)
  },

  patch: async (endpoint: string, data?: any) => {
    // Invalidate Cache on Mutation
    cache.clear()

    // For Vercel serverless routing, convert path-based IDs to query params
    // Special handling for priority endpoint: "projects/{id}/priority" → "projects?resource=priority&id={id}"
    let finalEndpoint = endpoint

    if (endpoint.includes('/priority')) {
      // Extract ID and convert to resource-based route
      const priorityMatch = endpoint.match(/^([^\/]+)\/([^\/]+)\/priority$/)
      if (priorityMatch) {
        const [, base, id] = priorityMatch
        finalEndpoint = `${base}?resource=priority&id=${id}`
      }
    } else {
      // Regular path conversion: "projects/abc-123" → "projects?id=abc-123"
      const pathMatch = endpoint.match(/^([^\/]+)\/([^\/\?]+)(.*)$/)
      if (pathMatch) {
        const [, base, id, rest] = pathMatch
        finalEndpoint = `${base}?id=${id}${rest}`
      }
    }

    const response = await fetch(`/api/${finalEndpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    })
    return handleResponse(response)
  },

  delete: async (endpoint: string) => {
    // Invalidate Cache on Mutation
    cache.clear()

    // For Vercel serverless routing, convert path-based IDs to query params
    // e.g., "projects/abc-123" → "projects?id=abc-123"
    let finalEndpoint = endpoint
    const pathMatch = endpoint.match(/^([^\/]+)\/([^\/\?]+)(.*)$/)
    if (pathMatch) {
      const [, base, id, rest] = pathMatch
      finalEndpoint = `${base}?id=${id}${rest}`
    }

    const response = await fetch(`/api/${finalEndpoint}`, {
      method: 'DELETE'
    })
    return handleResponse(response)
  }
}

export { ApiError }
