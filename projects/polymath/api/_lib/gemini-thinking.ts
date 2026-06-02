/**
 * Gemini thinking-level control
 *
 * gemini-3.1-flash-lite is a *thinking* model: it spends "thinking" tokens
 * before answering, and those tokens are billed as OUTPUT ($1.50 / 1M) — the
 * priciest part of a request. Deep reasoning earns its keep on creative
 * synthesis, but most Polymath calls are mechanical: classify a tag, score an
 * idea, extract metadata, pick a bucket. Those don't need multi-step reasoning,
 * and the app's plain-voice rules actively reject the long, hedged output that
 * heavy thinking produces. Capping thinking on those calls cuts cost with no
 * quality cost.
 *
 * Wire format verified against @google/genai (the official SDK): Gemini 3.x
 * takes `generationConfig.thinkingConfig.thinkingLevel` with the uppercase
 * enum values below. The legacy @google/generative-ai SDK we call through
 * forwards generationConfig verbatim to the v1beta endpoint, so the same
 * fragment reaches the API unchanged.
 */

import type { GenerationConfig } from '@google/generative-ai'

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high'

const WIRE: Record<ThinkingLevel, string> = {
  minimal: 'MINIMAL',
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
}

/**
 * Effective thinking level. GEMINI_THINKING_LEVEL, when set to a valid level,
 * overrides every per-call request — a global dial to trade reasoning depth
 * against cost from the Vercel dashboard without a code change. Returns
 * undefined to leave the model on its own default.
 */
export function resolveThinkingLevel(requested?: ThinkingLevel): ThinkingLevel | undefined {
  const override = process.env.GEMINI_THINKING_LEVEL?.trim().toLowerCase()
  if (override && override in WIRE) return override as ThinkingLevel
  return requested
}

/**
 * generationConfig fragment pinning the Gemini 3.x thinking level. Spread it
 * into a generationConfig object. Returns {} when no level applies, so the
 * model keeps its own default. Only valid for Gemini 3.x models.
 */
export function thinkingFragment(requested?: ThinkingLevel): Partial<GenerationConfig> {
  const level = resolveThinkingLevel(requested)
  if (!level) return {}
  // thinkingConfig is a v1beta field not yet in the legacy SDK's type; the
  // cast keeps it type-safe to spread while still reaching the API at runtime.
  return { thinkingConfig: { thinkingLevel: WIRE[level] } } as Partial<GenerationConfig>
}
