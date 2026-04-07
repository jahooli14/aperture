/**
 * Gemini model configuration
 * Centralized model names for easy updates
 */

export const MODELS = {
  // Generation: Cheap and fast for idea creation
  GENERATE: 'gemini-2.0-flash-lite',

  // Pre-filter: Better quality for scoring ideas
  FILTER: 'gemini-2.0-flash',

  // Review: High quality for final verdicts
  REVIEW: 'gemini-2.5-pro-preview-05-06',

  // Summarize: Good enough for feedback compression
  SUMMARIZE: 'gemini-2.0-flash',

  // Embedding: For deduplication vectors
  EMBEDDING: 'text-embedding-004',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];
