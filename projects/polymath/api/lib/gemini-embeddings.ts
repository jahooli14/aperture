/**
 * Gemini Embedding Service
 * Free embeddings using Google's text-embedding-004 model
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// Validate API key at module load
if (!process.env.GEMINI_API_KEY) {
  console.error('[Gemini] GEMINI_API_KEY environment variable is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key-for-initialization')

// Simple in-memory usage tracking (resets on deployment)
let usageStats = {
  single_embeddings: 0,
  batch_embeddings: 0,
  total_items_embedded: 0,
  errors: 0,
  retries: 0,
  last_reset: new Date().toISOString()
}

/**
 * Get current Gemini API usage stats
 */
export function getUsageStats() {
  return { ...usageStats }
}

/**
 * Reset usage stats
 */
export function resetUsageStats() {
  usageStats = {
    single_embeddings: 0,
    batch_embeddings: 0,
    total_items_embedded: 0,
    errors: 0,
    retries: 0,
    last_reset: new Date().toISOString()
  }
}

/**
 * Generate a single embedding using Gemini with retry logic
 * Model: text-embedding-004 (768 dimensions, latest model)
 * Cost: FREE (up to 1M requests/day)
 */
export async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key-for-initialization') {
    throw new Error('GEMINI_API_KEY environment variable is not configured')
  }

  let lastError: any

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
      const result = await model.embedContent(text)

      // Track usage
      usageStats.single_embeddings++
      usageStats.total_items_embedded++
      if (attempt > 0) {
        usageStats.retries++
        console.log(`[Gemini] Success on retry ${attempt}`)
      }

      return result.embedding.values
    } catch (error: any) {
      lastError = error
      usageStats.errors++

      const isRateLimitError = error?.status === 429 || error?.message?.includes('rate limit')
      const isServerError = error?.status >= 500

      // Only retry on rate limits or server errors
      if ((isRateLimitError || isServerError) && attempt < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Exponential backoff, max 10s
        console.warn(`[Gemini] Rate limit/server error (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Log error details
      console.error('[Gemini] Embedding error:', {
        attempt: attempt + 1,
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText
      })

      if (attempt === retries - 1) {
        break // Final attempt failed
      }
    }
  }

  throw lastError
}

/**
 * Generate multiple embeddings in batch with retry logic
 * More efficient than individual calls
 */
export async function batchGenerateEmbeddings(texts: string[], retries = 3): Promise<number[][]> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key-for-initialization') {
    throw new Error('GEMINI_API_KEY environment variable is not configured')
  }

  let lastError: any

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

      // Process in parallel (Gemini is fast)
      const embeddings = await Promise.all(
        texts.map(text => model.embedContent(text))
      )

      // Track usage
      usageStats.batch_embeddings++
      usageStats.total_items_embedded += texts.length
      if (attempt > 0) {
        usageStats.retries++
        console.log(`[Gemini] Batch success on retry ${attempt}`)
      }

      return embeddings.map(e => e.embedding.values)
    } catch (error: any) {
      lastError = error
      usageStats.errors++

      const isRateLimitError = error?.status === 429 || error?.message?.includes('rate limit')
      const isServerError = error?.status >= 500

      if ((isRateLimitError || isServerError) && attempt < retries - 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 20000) // Longer delays for batch
        console.warn(`[Gemini] Batch rate limit/server error (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      console.error('[Gemini] Batch embedding error:', {
        attempt: attempt + 1,
        message: error?.message,
        status: error?.status,
        count: texts.length
      })

      if (attempt === retries - 1) {
        break
      }
    }
  }

  throw lastError
}

/**
 * Calculate cosine similarity between two embeddings
 * Handles both array and JSON string formats from Supabase
 */
export function cosineSimilarity(a: number[] | string, b: number[] | string): number {
  // Convert to arrays if needed (Supabase returns vectors as JSON strings)
  const arrayA = Array.isArray(a) ? a : JSON.parse(a)
  const arrayB = Array.isArray(b) ? b : JSON.parse(b)

  const dotProduct = arrayA.reduce((sum, val, i) => sum + val * arrayB[i], 0)
  const magnitudeA = Math.sqrt(arrayA.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(arrayB.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}
