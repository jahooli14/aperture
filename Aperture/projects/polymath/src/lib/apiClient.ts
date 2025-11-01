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
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      data.error || data.details || `Request failed with status ${response.status}`,
      data
    )
  }
  return response.json()
}

export const api = {
  get: async (endpoint: string) => {
    const response = await fetch(`/api/${endpoint}`)
    return handleResponse(response)
  },

  post: async (endpoint: string, data: any) => {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(response)
  },

  patch: async (endpoint: string, data?: any) => {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    })
    return handleResponse(response)
  },

  delete: async (endpoint: string) => {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'DELETE'
    })
    return handleResponse(response)
  }
}

export { ApiError }
