/**
 * Centralized Model Configuration
 */

export const MODELS = {
  DEFAULT_CHAT: 'gemini-3.1-flash-lite-preview', // Fast, cost-effective — bulk operations
  FLASH_CHAT: 'gemini-3-flash-preview',           // Full Flash — high-quality creative generation
  PRO: 'gemini-3.1-pro-preview',                  // Reserved — high-stakes reasoning, off by default
  DEFAULT_EMBEDDING: 'gemini-embedding-001',
  DEFAULT_EMBEDDING_DIMS: 768, // Use MRL to match existing DB vector(768) columns
} as const
