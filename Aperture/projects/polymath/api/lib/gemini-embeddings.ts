/**
 * Gemini Embedding Service
 * Free embeddings using Google's text-embedding-004 model
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

/**
 * Generate a single embedding using Gemini
 * Model: text-embedding-004 (768 dimensions)
 * Cost: FREE (up to 1M requests/day)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  const result = await model.embedContent(text)
  return result.embedding.values
}

/**
 * Generate multiple embeddings in batch
 * More efficient than individual calls
 */
export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  // Process in parallel (Gemini is fast)
  const embeddings = await Promise.all(
    texts.map(text => model.embedContent(text))
  )

  return embeddings.map(e => e.embedding.values)
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}
