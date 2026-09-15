/**
 * Shared Zod schemas for API request bodies and Gemini response parsing.
 *
 * Two purposes:
 *  1. Bound untrusted client input (length caps, allowed enums) before it hits the DB.
 *  2. Validate model outputs before we trust them — Gemini changing schema should
 *     produce a structured error, not silently propagate `undefined` into storage.
 */

import { z } from 'zod'

// ── Shared primitives ──────────────────────────────────────────────────────

/** Max body length for a single captured note (≈ 20 pages of text). */
export const MAX_MEMORY_BODY_CHARS = 50_000
export const MAX_TITLE_CHARS = 500
export const MAX_TAGS = 20
export const MAX_TAG_CHARS = 100

const shortString = z.string().max(MAX_TAG_CHARS)
const title = z.string().max(MAX_TITLE_CHARS)
const memoryBody = z.string().max(MAX_MEMORY_BODY_CHARS)
const tags = z.array(shortString).max(MAX_TAGS)

const memoryType = z.enum(['foundational', 'event', 'insight', 'quick-note'])
const triageCategory = z.enum([
  'task_update',
  'new_thought',
  'reading_lead',
  'new_project_idea',
  'list_item',
  'annoyance',
  'taste_signal',
])
const severity = z.enum(['critical', 'annoying', 'minor'])

// ── Reading model output ───────────────────────────────────────────────────
//
// A model says "no value" with `null` far more often than by leaving the key
// out, and Zod's `.optional()` means "may be absent" — not "may be null". That
// one-word difference threw away 44 of this corpus's 75 notes: every capture
// with no obvious project got `"triage": {"project_id": null}` back from
// Gemini, failed validation, and stayed unprocessed with no title, no themes,
// no fragment and no place in any search. Silently, for eight months.
//
// So: a field we ask the model to fill in is read leniently, and an optional
// one that comes back malformed is dropped rather than throwing. The note is
// the thing being saved; `severity` is a garnish, and no garnish is worth
// losing a thought the user actually said.
//
// This applies to model OUTPUT only. Request bodies from our own client stay
// strict — there a wrong shape is a bug to surface, not noise to absorb.

/**
 * Parse JSON a model produced, repairing the two things they actually get
 * wrong before giving up.
 *
 * A note was lost to `Expected double-quoted property name at position 629`.
 * The thought was fine, the extraction was fine; a comma in the wrong place
 * threw the whole thing away, and the row then spent retries reproducing a
 * failure that had nothing to do with its content.
 *
 * Repairs are attempted ONLY after an honest parse fails, so valid JSON is
 * never touched. If the repair does not parse either, the original error is
 * thrown -- a salvage that invents structure would be worse than the loss.
 */
export function parseModelJson(text: string): unknown {
  const block = text.match(/\{[\s\S]*\}/)
  if (!block) throw new Error('no JSON object in model response')
  const raw = block[0]

  try {
    return JSON.parse(raw)
  } catch (first) {
    const repaired = raw
      // A trailing comma before a closing brace or bracket.
      .replace(/,(\s*[}\]])/g, '$1')
      // An unquoted property name: { role: "x" } rather than { "role": "x" }.
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    try {
      return JSON.parse(repaired)
    } catch {
      throw first
    }
  }
}

/** Optional on model output: absent, null, or malformed all read as absent. */
function said<T>(schema: z.ZodType<T>): z.ZodType<T | undefined> {
  return z
    .preprocess((v) => (v === null ? undefined : v), schema.optional())
    .catch(undefined) as unknown as z.ZodType<T | undefined>
}

/** Same, but with a fallback so a missing list is empty rather than absent. */
function saidOr<T>(schema: z.ZodType<T>, fallback: T): z.ZodType<T> {
  return z
    .preprocess((v) => (v === null || v === undefined ? fallback : v), schema)
    .catch(fallback) as unknown as z.ZodType<T>
}


// ── Request body schemas ───────────────────────────────────────────────────

const checklistItem = z.object({
  text: z.string().max(1000),
  checked: z.boolean().optional(),
})

export const CaptureMemoryBody = z
  .object({
    transcript: memoryBody.optional(),
    body: memoryBody.optional(),
    title: title.optional(),
    source_reference: z
      .union([
        z.string().max(500),
        z.object({
          type: z.enum(['article', 'project', 'suggestion', 'list_item']),
          id: z.string().max(200),
          title: z.string().max(500).optional(),
          url: z.string().max(2000).optional(),
          list_type: z.string().max(100).optional(),
        }),
      ])
      .nullable()
      .optional(),
    tags: tags.optional(),
    memory_type: memoryType.nullable().optional(),
    image_urls: z.array(z.string().max(2000)).max(20).nullable().optional(),
    checklist_items: z.array(checklistItem).max(200).nullable().optional(),
  })
  .refine((d) => !!(d.transcript || d.body || d.checklist_items), {
    message: 'transcript, body, or checklist_items field required',
  })

export type CaptureMemoryBodyInput = z.infer<typeof CaptureMemoryBody>

// ── Gemini response schemas ────────────────────────────────────────────────

/** Structured output from the capture-title prompt (title + 2-4 summary bullets). */
export const CaptureTitleResponse = z.object({
  title: z.string().min(1).max(MAX_TITLE_CHARS),
  bullets: z.array(z.string().max(2_000)).min(1).max(8),
})

const entities = saidOr(z.object({
  people: saidOr(z.array(shortString).max(100), []),
  places: saidOr(z.array(shortString).max(100), []),
  topics: saidOr(z.array(shortString).max(200), []),
  skills: saidOr(z.array(shortString).max(100), []),
}), { people: [], places: [], topics: [], skills: [] })

const triageInfo = z.object({
  category: triageCategory,
  project_id: said(z.string()),
  // Clamped rather than rejected: a model that answers 1.2 has still told us
  // "very confident", and that is not worth losing the note over.
  confidence: z.number().min(0).max(1),
  suggested_todo_text: said(z.string().max(1_000)),
  severity: said(severity),
  automatable: said(z.boolean()),
  fix_hint: said(z.string().max(2_000)),
})

/** Structured output from the full metadata-extraction prompt in process-memory.ts. */
export const ExtractMetadataResponse = z.object({
  memory_type: memoryType,
  entities,
  themes: saidOr(z.array(shortString).max(50), []),
  tags: saidOr(tags, []),
  emotional_tone: saidOr(z.string().max(200), ''),
  summary_title: title,
  insightful_body: z.string().max(MAX_MEMORY_BODY_CHARS),
  // Triage is enrichment. A malformed one costs the triage, never the thought.
  triage: said(triageInfo),
})

export type ExtractMetadataResult = z.infer<typeof ExtractMetadataResponse>

// ── Fix Queue schemas ──────────────────────────────────────────────────────
// Mirror api/_lib/fix-queue/types.ts. Both exist because the TS types are the
// internal contract and these schemas validate the untrusted Gemini JSON output
// before it becomes a scheduled side-effect.

const email = z.email().max(320)

const fixActionSendEmail = z.object({
  type: z.literal('send_email'),
  to: email,
  subject: z.string().max(500),
  body: z.string().max(20_000),
})

const fixActionSendEmailDigest = z.object({
  type: z.literal('send_email_digest'),
  to: email,
  subject: z.string().max(500),
  items_query: z.string().max(2_000),
})

const fixActionWeatherEmail = z.object({
  type: z.literal('weather_email'),
  to: email,
  subject: z.string().max(500),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  template: z.string().max(20_000),
})

const fixActionHttpRequest = z.object({
  type: z.literal('http_request'),
  url: z.string().url().max(2_000),
  method: z.enum(['GET', 'POST', 'PUT']),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().max(20_000).optional(),
})

const fixActionSmartHome = z.object({
  type: z.literal('smart_home'),
  device: z.enum(['frame_tv', 'sonos', 'bird_cam']),
  command: z.string().max(200),
  params: z.record(z.string(), z.string()).optional(),
})

export const FixAction = z.discriminatedUnion('type', [
  fixActionSendEmail,
  fixActionSendEmailDigest,
  fixActionWeatherEmail,
  fixActionHttpRequest,
  fixActionSmartHome,
])

export const FixSchedule = z.object({
  cron: z.string().max(100),
  timezone: z.string().max(100),
  description: z.string().max(500),
})

export const FixDraftResponse = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2_000),
  schedule: FixSchedule,
  actions: z.array(FixAction).min(1).max(10),
  estimated_cost: z.string().max(100),
})

export type FixActionInput = z.infer<typeof FixAction>

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Validate `data` against `schema`. Returns the typed value on success.
 * On failure, throws a single-line Error ("{label}: {path} {message}") — cheap
 * enough to let the API's outer try/catch return 400/500 without custom handling.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  const first = result.error.issues[0]
  const path = first?.path.join('.') || '(root)'
  throw new Error(`${label} validation failed: ${path} ${first?.message ?? 'invalid'}`)
}

/** Like {@link validate} but returns `null` on failure and logs. Use for Gemini
 * responses where we want to fall back rather than 500 the whole request. */
export function tryValidate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string,
): T | null {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  const first = result.error.issues[0]
  const path = first?.path.join('.') || '(root)'
  console.warn(`[${label}] schema mismatch at ${path}: ${first?.message ?? 'invalid'}`)
  return null
}
