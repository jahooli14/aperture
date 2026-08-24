/**
 * Project labels.
 *
 * Projects carry `metadata.tags: string[]` — a field that already existed and
 * was already read by the idea generator (gather.ts, seed-picker.ts) and the
 * resurface scorer, but had nothing writing to it. This module fills it.
 *
 * Labels, not containers: a project can be both `music` and `woodwork`, and
 * that overlap is the point — it's what lets the resurface path say "you're on
 * a music thing; these two dormant ones share a label" instead of dumping
 * every non-priority project into one flat pile.
 *
 * The vocabulary is derived from what the user already has, not a fixed
 * enum. New labels get minted only when nothing existing fits, which keeps the
 * set from rotting into forty singletons that group nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'

/** Labels per project. Enough to catch a genuine overlap, few enough to mean something. */
export const MAX_TAGS_PER_PROJECT = 3

/** Projects per Gemini call. Keeps the backfill to a handful of cheap requests. */
export const TAG_BATCH_SIZE = 25

/**
 * A label is a short lowercase slug: `music`, `woodwork`, `long-form-writing`.
 * Anything that can't be reduced to one is dropped rather than stored dirty —
 * a malformed label is worse than a missing one, because it becomes a filter
 * that matches exactly one project forever.
 */
export function normalizeTag(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (slug.length < 2 || slug.length > 24) return null
  return slug
}

export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const slug = normalizeTag(item as string)
    if (slug && !out.includes(slug)) out.push(slug)
    if (out.length >= MAX_TAGS_PER_PROJECT) break
  }
  return out
}

/**
 * Every label the user already uses, most-used first. This is the "prefer
 * these" list handed to the model — reusing an existing label is always
 * better than minting a near-synonym of it.
 */
export function collectVocabulary(projects: Array<{ metadata?: any }>): string[] {
  const counts = new Map<string, number>()
  for (const p of projects) {
    for (const tag of normalizeTags(p.metadata?.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}

interface TaggableProject {
  id: string
  title: string
  description?: string | null
  type?: string | null
}

/**
 * Ask for labels on a batch of projects. Mechanical classification, so
 * thinking is capped per the repo's cost rules — this is picking buckets, not
 * writing prose.
 *
 * Returns a map of project id → labels. Projects the model skips or mangles
 * are simply absent; the caller leaves those untouched rather than guessing.
 */
export async function suggestTags(
  projects: TaggableProject[],
  vocabulary: string[]
): Promise<Record<string, string[]>> {
  if (projects.length === 0) return {}

  const vocabLine = vocabulary.length > 0
    ? `Labels already in use (STRONGLY prefer reusing these — reuse beats inventing a near-synonym):\n${vocabulary.join(', ')}`
    : 'No labels exist yet. Establish a small, reusable starting set.'

  const list = projects
    .map(p => {
      const desc = (p.description || '').slice(0, 300)
      return `- id: ${p.id}\n  title: ${p.title}\n  description: ${desc || '(none)'}`
    })
    .join('\n')

  const prompt = `Label each creative project below with 1-${MAX_TAGS_PER_PROJECT} labels describing what it actually IS — the craft, medium, or domain.

${vocabLine}

Rules:
- Labels are lowercase slugs: music, woodwork, writing, electronics, photography, long-form-writing.
- A project can hold several. Something that is both music and furniture gets both. That overlap is the point.
- Label the CRAFT, not the status or vibe. No "active", "someday", "fun", "big".
- Plain words a person would actually say. Real: music, woodwork, film. Rubbish: "creative", "sonic-exploration", "maker-journey", "content". "creative" labels nothing — every project here is creative.
- Only invent a new label when nothing in the existing list genuinely fits.
- Prefer 1-2 labels. Use 3 only when the project really does span three.

Projects:
${list}

Return ONLY a JSON object mapping each project id to an array of label strings. No prose, no code fences.
Example: {"a1b2c3d4-0000-0000-0000-000000000000": ["music", "electronics"]}`

  const raw = await generateText(prompt, {
    temperature: 0.2,
    maxTokens: 2000,
    responseFormat: 'json',
    thinkingLevel: 'low',
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim())
  } catch {
    console.error('[project-tags] model returned unparseable JSON')
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

  const validIds = new Set(projects.map(p => p.id))
  const out: Record<string, string[]> = {}
  for (const [id, tags] of Object.entries(parsed as Record<string, unknown>)) {
    if (!validIds.has(id)) continue
    const clean = normalizeTags(tags)
    if (clean.length > 0) out[id] = clean
  }
  return out
}

export interface BackfillResult {
  scanned: number
  tagged: number
  skipped: number
  vocabulary: string[]
}

/**
 * Label every project that has none yet.
 *
 * Idempotent by default: a project with existing labels is left alone, so this
 * is safe to run on a schedule to catch newly-created projects. `force`
 * re-labels everything, for when the vocabulary has drifted enough to be worth
 * a clean pass.
 *
 * The vocabulary is recomputed from the whole corpus up front and grows as
 * batches land, so later batches can reuse labels the earlier ones minted
 * instead of inventing parallel ones.
 */
export async function backfillProjectTags(
  supabase: SupabaseClient,
  userId: string,
  options: { force?: boolean; limit?: number } = {}
): Promise<BackfillResult> {
  const { force = false, limit = 100 } = options

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, type, metadata')
    .eq('user_id', userId)
    .not('status', 'in', '("completed","graveyard")')

  if (error) throw new Error(`Failed to load projects: ${error.message}`)

  const all = projects || []
  const vocabulary = collectVocabulary(all)

  const needsTags = all
    .filter(p => force || normalizeTags(p.metadata?.tags).length === 0)
    .slice(0, limit)

  if (needsTags.length === 0) {
    return { scanned: all.length, tagged: 0, skipped: all.length, vocabulary }
  }

  // Vocabulary grows as we go, so batch 3 can reuse what batch 1 established.
  const runningVocab = [...vocabulary]
  let tagged = 0

  for (let i = 0; i < needsTags.length; i += TAG_BATCH_SIZE) {
    const batch = needsTags.slice(i, i + TAG_BATCH_SIZE)
    let suggestions: Record<string, string[]> = {}
    try {
      suggestions = await suggestTags(batch, runningVocab)
    } catch (err) {
      console.error('[project-tags] batch failed, continuing:', err)
      continue
    }

    for (const project of batch) {
      const tags = suggestions[project.id]
      if (!tags || tags.length === 0) continue

      const metadata = { ...(project.metadata || {}), tags }
      const { error: updateError } = await supabase
        .from('projects')
        .update({ metadata })
        .eq('id', project.id)
        .eq('user_id', userId)

      if (updateError) {
        console.error(`[project-tags] failed to save tags for ${project.id}:`, updateError.message)
        continue
      }
      tagged++
      for (const tag of tags) {
        if (!runningVocab.includes(tag)) runningVocab.push(tag)
      }
    }
  }

  return {
    scanned: all.length,
    tagged,
    skipped: all.length - tagged,
    vocabulary: runningVocab,
  }
}
