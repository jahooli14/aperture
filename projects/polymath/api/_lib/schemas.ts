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
  'action_item',
  'todo_new',
  'list_item',
  'annoyance',
])
const severity = z.enum(['critical', 'annoying', 'minor'])

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
      .object({
        type: z.enum(['article', 'project', 'suggestion', 'list_item']),
        id: z.string().max(200),
        title: z.string().max(500).optional(),
        url: z.string().max(2000).optional(),
        list_type: z.string().max(100).optional(),
      })
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

const entities = z.object({
  people: z.array(shortString).max(100).default([]),
  places: z.array(shortString).max(100).default([]),
  topics: z.array(shortString).max(200).default([]),
  skills: z.array(shortString).max(100).default([]),
})

const triageInfo = z.object({
  category: triageCategory,
  project_id: z.string().optional(),
  confidence: z.number().min(0).max(1),
  suggested_todo_text: z.string().max(1_000).optional(),
  severity: severity.optional(),
  automatable: z.boolean().optional(),
  fix_hint: z.string().max(2_000).optional(),
})

/** Structured output from the full metadata-extraction prompt in process-memory.ts. */
export const ExtractMetadataResponse = z.object({
  memory_type: memoryType,
  entities,
  themes: z.array(shortString).max(50).default([]),
  tags: tags.optional(),
  emotional_tone: z.string().max(200).default(''),
  summary_title: title,
  insightful_body: z.string().max(MAX_MEMORY_BODY_CHARS),
  triage: triageInfo.optional(),
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
