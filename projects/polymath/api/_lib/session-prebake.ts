/**
 * Baking the session ahead, so opening a project is instant.
 *
 * The product this serves is narrow and specific: an hour appears, the
 * baby is asleep, and the app has to be useful in the first two seconds.
 * A briefing costs a model call (sometimes two, with the spark), and a
 * spinner with 58 minutes left on the clock IS the faffing this is
 * supposed to remove. Worse, it costs the hour at exactly the moment the
 * user is deciding whether the app is worth opening at all.
 *
 * So the overnight cron shapes the handful of projects most likely to be
 * picked and stores the result. Opening one serves the stored plan with
 * no model call; anything unbaked falls straight through to the live
 * path, which is what shipped before this existed.
 *
 * Staleness is the whole risk here: a plan built against a task list that
 * has since changed is worse than no plan, because it silently plans work
 * that's already done. So the bake carries a fingerprint of exactly what
 * it was built from -- the open steps and the exit note -- and any drift
 * in either invalidates it. Cheap to check, impossible to get subtly
 * wrong, and it fails toward the live path rather than toward stale work.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { shapeSession, type ShapeResult } from './session-shaper.js'

/** The window a bake is built for. Most sessions are an hour; a shorter
 *  one trims items off the front, which is pure and needs no re-shape. */
export const PREBAKE_WINDOW_MINUTES = 60

/** How many projects get baked per run. The point is covering what you'd
 *  plausibly open tonight, not the whole shelf -- each one is a model
 *  call, and a project you haven't touched in a year isn't tonight's. */
export const PREBAKE_LIMIT = 8

/** A bake older than this is thrown away even if nothing changed: the
 *  corpus moves underneath it (the spark is drawn from the last fortnight)
 *  and a two-week-old "while you're in there" isn't this week any more. */
export const PREBAKE_MAX_AGE_DAYS = 3

export interface PrebakedSession {
  items: ShapeResult['items']
  doneLooksLike: string | null
  source: ShapeResult['source']
  friction: ShapeResult['friction']
  packdown: ShapeResult['packdown']
  truncatedCount: number
  builtAt: string
  windowMinutes: number
  fingerprint: string
}

/**
 * Exactly what the plan was built from: the open steps, in order, and the
 * exit note. Anything that would change the plan changes this string, and
 * anything that wouldn't (a title edit, a heat bump) doesn't -- so a bake
 * isn't thrown away for no reason.
 *
 * Pure, so the invalidation rule is testable without a database.
 */
export function fingerprintFor(tasks: unknown[], exitNote: string | null | undefined): string {
  const open = (tasks as any[])
    .filter(t => t && !t.done && typeof t.id === 'string' && typeof t.text === 'string')
    .map(t => `${t.id}:${t.text.trim()}`)
    .join('|')
  return `${open}::${(exitNote ?? '').trim()}`
}

export function isPrebakeFresh(
  bake: PrebakedSession | null | undefined,
  tasks: unknown[],
  exitNote: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!bake || typeof bake.fingerprint !== 'string' || !bake.builtAt) return false
  if (bake.fingerprint !== fingerprintFor(tasks, exitNote)) return false
  const ageDays = (now.getTime() - new Date(bake.builtAt).getTime()) / 86_400_000
  return Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= PREBAKE_MAX_AGE_DAYS
}

export function readPrebake(metadata: any): PrebakedSession | null {
  const raw = metadata?.session_prebake
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null
  return raw as PrebakedSession
}

/**
 * The projects worth baking: what's in motion, in the order you'd most
 * likely reach for it. Priority first, then anything pinned to Up Next,
 * then most recently touched.
 */
export async function projectsToPrebake(
  supabase: SupabaseClient,
  userId: string,
  limit = PREBAKE_LIMIT,
): Promise<{ id: string; title: string }[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, is_priority, up_next_position, last_active, metadata')
    .eq('user_id', userId)
    .in('status', ['active', 'upcoming'])
    .order('last_active', { ascending: false })
    .limit(40)
  if (error || !data) return []

  const rank = (p: any) => (p.is_priority ? 0 : p.up_next_position != null ? 1 : 2)
  return data
    // Nothing to plan from means nothing to bake -- shapeSession would ask
    // a question instead, and a stored question goes stale worse than a
    // stored plan does.
    .filter((p: any) => Array.isArray(p.metadata?.tasks) && p.metadata.tasks.some((t: any) => t && !t.done))
    .sort((a: any, b: any) => rank(a) - rank(b))
    .slice(0, limit)
    .map((p: any) => ({ id: p.id, title: p.title }))
}

/**
 * Shapes and stores one project's next session. Never throws: a failed
 * bake just means that project opens the slow way, which is the behaviour
 * that shipped before any of this existed.
 */
export async function prebakeProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  try {
    const result = await shapeSession(supabase, userId, projectId, PREBAKE_WINDOW_MINUTES)
    // A plan that had to ask a question, or that came back with nothing
    // real, is not worth storing -- it would freeze a question in place
    // for three days.
    if (result.needsInput || result.items.length === 0 || result.source === 'derived') return false

    // Re-read AFTER shaping: shapeSession can itself write to the task
    // list (planning an empty project, moving a blocked step up), and a
    // fingerprint taken before that would be stale the moment it's stored.
    const { data: project } = await supabase
      .from('projects')
      .select('metadata, last_closeout_text')
      .eq('id', projectId).eq('user_id', userId).single()
    if (!project) return false

    const metadata = project.metadata ?? {}
    const bake: PrebakedSession = {
      items: result.items,
      doneLooksLike: result.doneLooksLike,
      source: result.source,
      friction: result.friction,
      packdown: result.packdown,
      truncatedCount: result.truncatedCount,
      builtAt: new Date().toISOString(),
      windowMinutes: PREBAKE_WINDOW_MINUTES,
      fingerprint: fingerprintFor(
        Array.isArray(metadata.tasks) ? metadata.tasks : [],
        project.last_closeout_text,
      ),
    }
    const { error } = await supabase
      .from('projects')
      .update({ metadata: { ...metadata, session_prebake: bake } })
      .eq('id', projectId).eq('user_id', userId)
    if (error) {
      console.warn(`[session-prebake] could not store the bake for ${projectId}:`, error.message)
      return false
    }
    return true
  } catch (e) {
    console.error(`[session-prebake] failed for ${projectId}:`, e)
    return false
  }
}

export async function prebakeForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = PREBAKE_LIMIT,
): Promise<{ considered: number; baked: number }> {
  const projects = await projectsToPrebake(supabase, userId, limit)
  let baked = 0
  for (const p of projects) {
    if (await prebakeProject(supabase, userId, p.id)) baked++
  }
  return { considered: projects.length, baked }
}
