/**
 * Centralized Model Configuration
 */

export const MODELS = {
  DEFAULT_CHAT: 'gemini-3.1-flash-lite-preview',
  DEFAULT_EMBEDDING: 'gemini-embedding-001',
  DEFAULT_EMBEDDING_DIMS: 768, // Use MRL to match existing DB vector(768) columns
} as const
