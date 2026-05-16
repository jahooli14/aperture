/**
 * Centralized Model Configuration
 *
 * Model IDs verified against https://ai.google.dev/gemini-api/docs/models
 * (May 2026). Of the Gemini 3.x chat models, ONLY
 * `gemini-3.1-flash-lite` is GA/stable — Flash (full) and Pro are
 * preview-only, and the `gemini-3-pro-preview` sibling was shut down with
 * little notice in March 2026. We therefore standardise on GA Flash-Lite
 * everywhere, including the idea generator (its earlier failures were
 * config bugs, not model capability). FLASH_CHAT is kept as a named seam:
 * set it to 'gemini-3-flash-preview' if a task ever needs full-Flash
 * quality and can accept preview-deprecation risk.
 */

export const MODELS = {
  // GA/stable. Thinking model — callers must give maxOutputTokens enough
  // headroom for reasoning + the answer (see generator.ts fast path).
  DEFAULT_CHAT: 'gemini-3.1-flash-lite',          // GA — bulk + default everywhere
  FLASH_CHAT: 'gemini-3.1-flash-lite',            // Seam: 'gemini-3-flash-preview' for full Flash
  FLASH_LIVE: 'gemini-3.1-flash-live-preview',    // Audio-to-audio Live API (onboarding chat)
  PRO: 'gemini-3.1-pro-preview',                  // Reserved — high-stakes reasoning, off by default
  DEFAULT_EMBEDDING: 'gemini-embedding-001',
  DEFAULT_EMBEDDING_DIMS: 768, // Use MRL to match existing DB vector(768) columns
} as const
