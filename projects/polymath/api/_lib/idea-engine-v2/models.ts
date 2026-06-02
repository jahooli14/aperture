/**
 * Gemini model configuration
 * Centralized model names for easy updates.
 *
 * Chat models use `-latest` aliases (auto-track newest build); embeddings stay
 * pinned to protect the dedup vector space. See api/_lib/models.ts for the
 * rationale and the -latest tradeoff.
 */

export const MODELS = {
  // Generation: Cheap and fast for idea creation
  GENERATE: 'gemini-flash-lite-latest',

  // Pre-filter: Score ideas before storage
  FILTER: 'gemini-flash-lite-latest',

  // Review: High quality for final verdicts
  REVIEW: 'gemini-pro-latest',

  // Summarize: Feedback compression
  SUMMARIZE: 'gemini-flash-lite-latest',

  // Embedding: For deduplication vectors — PINNED, never alias
  EMBEDDING: 'gemini-embedding-001',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];
