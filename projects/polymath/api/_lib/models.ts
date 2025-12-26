/**
 * Centralized Model Configuration
 * Using gemini-2.0-flash-exp for stability
 * Note: gemini-3-flash-preview may not be available in all regions yet
 */

export const MODELS = {
  DEFAULT_CHAT: 'gemini-3-flash-preview',
  DEFAULT_EMBEDDING: 'text-embedding-004',
} as const
