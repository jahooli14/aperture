/**
 * Rotating sparks across PROJECTS, not just across types.
 *
 * spark-types.ts already stops the same *shape* of question arriving two
 * days running, because habituation kills a type fast. The same is true of
 * the subject: three days of questions about the song is the app with one
 * thing on its mind, and it quietly teaches you that the other eleven
 * projects aren't really in play.
 *
 * There's a second reason, specific to this app. Being asked about a
 * different project each day is what keeps the whole shelf warm enough to
 * cross-reference — and cross-referencing between disciplines is where the
 * output that's actually yours comes from. A rotation stuck on one project
 * can't produce that by construction.
 *
 * `forgotten` already did this for itself (forgotten.ts's own cooldown).
 * This is the same rule, lifted out so every project-attributed type
 * shares it rather than each re-deriving its own.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Don't make the same project the subject again inside this window. Shorter
 *  than forgotten.ts's 21 days on purpose: that one is re-offering a project
 *  you'd abandoned, which needs real distance, while this is just "not two
 *  days in a row about the shelf". */
export const SPARK_PROJECT_COOLDOWN_DAYS = 4

/**
 * Which projects have been a spark's subject recently. Empty on any query
 * failure: a rotation that silently blocks everything would starve the
 * spark entirely, and repeating a project is a much smaller cost than
 * saying nothing at all.
 */
export async function recentlySparkedProjectIds(
  supabase: SupabaseClient,
  userId: string,
  withinDays: number = SPARK_PROJECT_COOLDOWN_DAYS,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - withinDays * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('sparks')
    .select('project_id')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .not('project_id', 'is', null)
  if (error || !data) return []
  return [...new Set(data.map((s: any) => s.project_id).filter(Boolean))]
}

/**
 * Drop anything on cooldown, but never return nothing when there WAS
 * something: a spark about a project you saw on Tuesday still beats
 * silence on Friday. The cooldown is a preference, not a gate.
 */
export function preferUnsparked<T extends { project_id?: string | null; id?: string }>(
  candidates: T[],
  recentIds: string[],
  idOf: (c: T) => string | null | undefined = (c) => c.project_id ?? c.id,
): T[] {
  if (candidates.length === 0) return []
  const onCooldown = new Set(recentIds)
  const fresh = candidates.filter(c => {
    const id = idOf(c)
    return !id || !onCooldown.has(id)
  })
  return fresh.length > 0 ? fresh : candidates
}
