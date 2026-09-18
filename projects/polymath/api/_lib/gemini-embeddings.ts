/**
 * Gemini Embedding Service
 * Embeddings using Google's gemini-embedding-001 model
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models.js'

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
 * Unit-length the vector, which gemini-embedding-001 does NOT do for you
 * below its native 3072 dimensions.
 *
 * The model uses Matryoshka representation learning, so asking for 768
 * dimensions returns a truncation of the 3072-dim vector — and truncating
 * a unit vector leaves something shorter than unit length. Google's docs
 * are explicit that you must normalize non-3072 output yourself.
 *
 * Nothing is broken today, because every comparison in this codebase is
 * cosine (pgvector's `<=>`, and cosineSimilarity below divides by both
 * magnitudes) and cosine ignores magnitude entirely. That is also why this
 * needs no migration: a normalized vector and its un-normalized self score
 * identically against anything, so new and old rows stay comparable.
 *
 * It matters for what comes next. An inner-product index (`<#>`), an L2
 * index (`<->`), or any raw dot product silently returns wrong neighbours
 * on un-normalized vectors, and that failure looks like "search got worse"
 * rather than like a bug.
 */
function normalize(values: number[]): number[] {
  let sumSquares = 0
  for (const v of values) sumSquares += v * v
  const magnitude = Math.sqrt(sumSquares)
  // A zero vector has no direction to preserve; hand it back untouched
  // rather than turning every component into NaN.
  if (magnitude === 0 || !Number.isFinite(magnitude)) return values
  return values.map(v => v / magnitude)
}

/**
 * Normalize, and check the API gave us the width we asked for.
 *
 * `outputDimensionality` isn't in this SDK's request types (it predates the
 * parameter), so it rides through as an untyped extra field. That works,
 * but it means a future SDK or endpoint that drops the field would hand
 * back 3072 numbers instead of 768 — and the first thing to notice would
 * be a Postgres error about a vector(768) column, thrown somewhere far
 * from the cause. Say it here instead.
 */
function toVector(values: number[]): number[] {
  if (values?.length !== MODELS.DEFAULT_EMBEDDING_DIMS) {
    throw new Error(
      `[Gemini] expected a ${MODELS.DEFAULT_EMBEDDING_DIMS}-dim embedding, got ${values?.length ?? 0} — ` +
      'outputDimensionality was not honoured, so this vector cannot be stored',
    )
  }
  return normalize(values)
}

/**
 * ONE vector space, and it is the query one. Measured, not chosen.
 *
 * `taskType` looks like free quality: retrieval here is asymmetric — a
 * blind-spot question against a corpus of notes — so the textbook answer is
 * RETRIEVAL_DOCUMENT for stored rows and RETRIEVAL_QUERY for searches. That
 * answer assumes retrieval is the only thing the vectors are for. Here it is
 * one use out of eight. The same `memories.embedding` column also decides
 * which project a capture attaches to (fragments.ts), which projects are a
 * restart of each other (project-shapes.ts), which notes cluster into a joint
 * (joints.ts, joint-miner.ts), and where a project's centre of mass sits
 * (orbit.ts) — all of them document-against-document and symmetric.
 *
 * RETRIEVAL_DOCUMENT is trained to make a document findable BY A QUERY. It is
 * not trained to hold documents apart from each other, and measured on this
 * corpus it does the opposite. Same 76 notes and 34 projects, embedded both
 * ways:
 *
 *                              DOCUMENT   QUERY
 *   attach margin p50           0.0081   0.0164
 *   attach margin p90           0.0407   0.0807
 *   project<->project max-p99    0.043    0.121
 *
 * Margins halve and the headroom a restart needs above the corpus's ceiling
 * for coincidence collapses to a third. The ranking degrades with it: in
 * query space the woodwork note reaches *Paint one wood block* and the
 * dream-door note reaches *Vivid dreams book* — two of the four pairs
 * CLAUDE.md names as the ones that stop being arguable — and in document
 * space both drop out of the top six for vaguer pairs.
 *
 * Every measured constant in this codebase (ATTACH_MARGIN, ORBIT_FLOOR /
 * CEILING / RIVAL_MARGIN, RECURRENCE_SIM_THRESHOLD) was measured in this
 * space. CONNECTOR_FLOOR/CEILING and RESTART_SIM are retired along with the
 * connector-search pipeline they tuned (see mull-generator.ts) — the numbers
 * above are the historical record of why this constant exists, not a live
 * inventory. Changing the task is still a flag day for the vectors and a
 * retune of everything still measured in this space, which is why this is a
 * constant with the numbers attached rather than a per-call parameter someone
 * can set on one writer and quietly break the thresholds everywhere else.
 *
 * Passing no taskType at all is byte-identical to this (cosine 1.000000
 * against the live API), so this names what was already true rather than
 * changing it. `gemini-embedding-2` cannot express it either way: measured,
 * it IGNORES taskType entirely (query and document come back cosine
 * 1.000000), taking the task as a prompt instruction instead.
 */
const CORPUS_TASK = 'RETRIEVAL_QUERY'


/**
 * Generate a single embedding using Gemini with retry logic
 * Model: gemini-embedding-001 (768 dimensions via MRL)
 */
export async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key-for-initialization') {
    throw new Error('GEMINI_API_KEY environment variable is not configured')
  }

  let lastError: any

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_EMBEDDING })
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: MODELS.DEFAULT_EMBEDDING_DIMS,
        taskType: CORPUS_TASK,
      } as Parameters<typeof model.embedContent>[0])

      // Track usage
      usageStats.single_embeddings++
      usageStats.total_items_embedded++
      if (attempt > 0) {
        usageStats.retries++
        console.log(`[Gemini] Success on retry ${attempt}`)
      }

      return toVector(result.embedding.values)
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
      const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_EMBEDDING })

      // One request, not N. This was `Promise.all(texts.map(embedContent))`,
      // which is not a batch at all — it fires a separate HTTP call per
      // text, all at once, so a 40-item backfill was 40 concurrent requests
      // against the rate limit and any single 429 failed the whole set and
      // re-fired all 40 on retry. batchEmbedContents is the actual batch
      // endpoint and takes the same per-request fields.
      const result = await model.batchEmbedContents({
        requests: texts.map(text => ({
          content: { role: 'user', parts: [{ text }] },
          outputDimensionality: MODELS.DEFAULT_EMBEDDING_DIMS,
          taskType: CORPUS_TASK,
        })),
      } as Parameters<typeof model.batchEmbedContents>[0])

      // Track usage
      usageStats.batch_embeddings++
      usageStats.total_items_embedded += texts.length
      if (attempt > 0) {
        usageStats.retries++
        console.log(`[Gemini] Batch success on retry ${attempt}`)
      }

      return result.embeddings.map(e => toVector(e.values))
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

  if (!arrayA?.length || !arrayB?.length) return 0

  const dotProduct = arrayA.reduce((sum: number, val: number, i: number) => sum + val * arrayB[i], 0)
  const magnitudeA = Math.sqrt(arrayA.reduce((sum: number, val: number) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(arrayB.reduce((sum: number, val: number) => sum + val * val, 0))

  // Guard against zero-magnitude vectors (all-zero embeddings produce NaN)
  if (magnitudeA === 0 || magnitudeB === 0) return 0

  return dotProduct / (magnitudeA * magnitudeB)
}
