/**
 * Gemini model configuration
 * Centralized model names for easy updates
 */

export const MODELS = {
  // Generation: Cheap and fast for idea creation
  GENERATE: 'gemini-3.1-flash-lite-preview',

  // Pre-filter: Use pro for reliable JSON responses
  FILTER: 'gemini-3.1-pro-preview',

  // Review: High quality for final verdicts
  REVIEW: 'gemini-3.1-pro-preview',

  // Summarize: Use pro for reliable JSON
  SUMMARIZE: 'gemini-3.1-pro-preview',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];
