/**
 * Model IDs, in one place.
 *
 * Chat models use `-latest` aliases so they track Google's newest build
 * rather than rotting on a deprecated version. Verified against
 * https://ai.google.dev/gemini-api/docs/models — same convention as
 * Polymath's api/_lib/models.ts.
 *
 * Relay only ever asks the model to *read* the story and point at lines, so
 * the cheapest tier is the right one. Nothing here writes prose for the user.
 */
export const MODELS = {
  INDEX: 'gemini-flash-lite-latest',
} as const
