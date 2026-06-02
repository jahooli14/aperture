/**
 * Centralized Model Configuration
 *
 * Chat/generation models use `-latest` aliases so they auto-track Google's
 * newest build per variation — no hardcoded version to rot when a model is
 * deprecated (e.g. gemini-2.0-flash was discontinued Jun 2026, and a
 * gemini-3-pro sibling was pulled with little notice in Mar 2026).
 *
 * Deliberate tradeoff: `-latest` can hot-swap onto a stable, preview OR
 * experimental build, with ~2 weeks' email notice. A swap can shift output
 * voice, cost, thinking defaults, and rate limits. If quality or cost drifts,
 * pin a specific stable ID here (this file is the single source of truth) or
 * dial GEMINI_THINKING_LEVEL. Aliases verified against
 * https://ai.google.dev/gemini-api/docs/models (June 2026):
 *   gemini-flash-lite-latest → Flash-Lite tier (cheapest; thinking model)
 *   gemini-flash-latest      → full Flash
 *   gemini-pro-latest        → Pro (3.1 Pro as of Mar 2026)
 *
 * Embeddings stay PINNED: an alias swap would change the vector space and
 * break cosine similarity against every stored embedding. Never alias these.
 */

export const MODELS = {
  // Flash-Lite, latest. Thinking model — callers must give maxOutputTokens
  // enough headroom for reasoning + the answer (see generator.ts fast path).
  DEFAULT_CHAT: 'gemini-flash-lite-latest',       // bulk + default everywhere
  FLASH_CHAT: 'gemini-flash-lite-latest',         // Seam: set to 'gemini-flash-latest' for full Flash
  FLASH_LIVE: 'gemini-3.1-flash-live-preview',    // Live API audio-to-audio (onboarding); pinned — no GA -latest alias
  PRO: 'gemini-pro-latest',                       // Reserved — high-stakes reasoning, off by default
  DEFAULT_EMBEDDING: 'gemini-embedding-001',      // PINNED — aliasing would break stored vectors
  DEFAULT_EMBEDDING_DIMS: 768, // Use MRL to match existing DB vector(768) columns
} as const
