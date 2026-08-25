/**
 * Slot seeding (SPEC.md).
 *
 * "An empty slot is what dormancy actually is" only works if a project
 * HAS named slots to begin with. Nothing else in the rebuild writes
 * projects.slots -- fragments.ts only fills a slot that already exists by
 * name -- so every project needs 2-4 real, concrete open questions seeded
 * once, the same moment catalysts get inferred (project-genesis-adjacent
 * scaffolding, following that existing fire-and-forget pattern in
 * api/projects.ts's project-creation handler).
 *
 * Idempotent: only ever touches a project whose slots array is still
 * empty, so it's safe to run as a backfill across the whole portfolio and
 * safe to call twice on the same project.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'

const MAX_SLOTS = 4
const BACKFILL_BATCH_SIZE = 25

export interface Slot {
  name: string
  filled: boolean
}

async function generateSlots(title: string, description: string | null): Promise<string[]> {
  const prompt = `Project: "${title}" -- ${description || 'no description yet'}

Name up to 4 concrete, unresolved questions this project genuinely needs answered before or
during the work -- things like a missing material, a venue, a first concrete piece, a deadline,
a collaborator. Each one should be a short noun phrase (2-4 words), not a sentence.

Skip anything that's clearly already settled or that doesn't apply to this kind of project. It's
fine to return fewer than 4, or none, if the project doesn't obviously need them.

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "slots": ["...", "..."] }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'low' })
    const parsed = JSON.parse(response)
    const slots = Array.isArray(parsed?.slots) ? parsed.slots.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0) : []
    return slots.slice(0, MAX_SLOTS).map((s: string) => s.trim())
  } catch (e) {
    console.warn('[slot-seed] generation failed:', e instanceof Error ? e.message : e)
    return []
  }
}

export async function seedSlotsForProject(
  supabase: SupabaseClient,
  userId: string,
  project: { id: string; title: string; description: string | null }
): Promise<number> {
  const names = await generateSlots(project.title, project.description)
  if (names.length === 0) return 0

  const slots: Slot[] = names.map(name => ({ name, filled: false }))
  const { error } = await supabase
    .from('projects')
    .update({ slots })
    .eq('id', project.id)
    .eq('user_id', userId)

  if (error) {
    console.warn('[slot-seed] update failed:', error.message)
    return 0
  }
  return slots.length
}

/** Cron-friendly backfill: seeds slots for every project that still has none. */
export async function backfillProjectSlots(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, description, slots')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(BACKFILL_BATCH_SIZE)

  const unseeded = (projects ?? []).filter(p => !Array.isArray(p.slots) || p.slots.length === 0)
  let seeded = 0
  for (const project of unseeded) {
    const count = await seedSlotsForProject(supabase, userId, project)
    if (count > 0) seeded++
  }
  return seeded
}
