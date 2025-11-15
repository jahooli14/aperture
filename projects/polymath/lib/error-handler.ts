/**
 * Centralized Error Handling
 * Provides consistent error responses across all API endpoints
 */

import type { VercelResponse } from '@vercel/node'

/**
 * Custom API Error class with status code and error code
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * Common API errors
 */
export class NotFoundError extends APIError {
  constructor(resource: string, id?: string) {
    super(404, `${resource}${id ? ` with id ${id}` : ''} not found`, 'NOT_FOUND')
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details)
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends APIError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN')
  }
}

export class ConflictError extends APIError {
  constructor(message: string) {
    super(409, message, 'CONFLICT')
  }
}

export class TooManyRequestsError extends APIError {
  constructor(message = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_EXCEEDED')
  }
}

export class InternalServerError extends APIError {
  constructor(message = 'Internal server error') {
    super(500, message, 'INTERNAL_ERROR')
  }
}

/**
 * Handle API errors with consistent response format
 */
export function handleAPIError(error: unknown, res: VercelResponse) {
  // Handle known API errors
  if (error instanceof APIError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details && { details: error.details })
    })
  }

  // Handle validation errors from Zod
  if (error && typeof error === 'object' && 'issues' in error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error
    })
  }

  // Log unexpected errors
  console.error('[error-handler] Unexpected error:', error)

  // Return generic error response
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  })
}

/**
 * Async error wrapper for API handlers
 * Automatically catches and handles errors
 */
export function withErrorHandler(
  handler: (req: any, res: any) => Promise<any>
) {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res)
    } catch (error) {
      return handleAPIError(error, res)
    }
  }
}
