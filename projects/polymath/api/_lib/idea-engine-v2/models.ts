/**
 * Gemini model configuration
 * Centralized model names for easy updates
 */

export const MODELS = {
  // Generation: Cheap and fast for idea creation
  GENERATE: 'gemini-3.1-flash-lite-preview',

  // Pre-filter: Better quality for scoring ideas
  FILTER: 'gemini-3-flash-preview',

  // Review: High quality for final verdicts
  REVIEW: 'gemini-3.1-pro-preview',

  // Summarize: Good enough for feedback compression
  SUMMARIZE: 'gemini-3-flash-preview',

  // Embedding: For deduplication vectors
  EMBEDDING: 'text-embedding-004',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];
