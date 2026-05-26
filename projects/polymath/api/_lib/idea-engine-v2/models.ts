/**
 * Gemini model configuration
 * Centralized model names for easy updates
 */

export const MODELS = {
  // Generation: Cheap and fast for idea creation
  GENERATE: 'gemini-3.1-flash-lite',

  // Pre-filter: Score ideas before storage
  FILTER: 'gemini-3.1-flash-lite',

  // Review: High quality for final verdicts
  REVIEW: 'gemini-3.1-pro-preview',

  // Summarize: Feedback compression
  SUMMARIZE: 'gemini-3.1-flash-lite',

  // Embedding: For deduplication vectors
  EMBEDDING: 'gemini-embedding-001',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];
