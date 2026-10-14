/**
 * The weekend nudge — one push on a Saturday morning, if it's turned on:
 * "Paint pouring's been waiting five weeks. Here's where you got to."
 *
 * Weekends are when there's time to pick something back up, and the hard
 * part of that is remembering what's there and where you left it. The push
 * names ONE project and opens it on its catch-up (up-to-speed.ts).
 *
 * What it must never become: a streak, a "you missed", or a second daily
 * reminder. Once a week at most, off by default, never about the project
 * you're already working on, and the same project isn't named two weeks
 * running.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isGraveyarded } from './project-state.js'
import { UP_TO_SPEED_AFTER_DAYS } from './up-to-speed.js'
import { inSeason, isBlocked, isoDay, readSeasonTag, type SeasonTag } from './season.js'

/** Local hour from which Saturday's push may go. The cron runs every 2h,
 *  so it lands at the first run on or after this. */
export const SEND_FROM_HOUR = 10
/** Older than this and it's not "waiting", it's gone. Drift-decay's job. */
export const MAX_QUIET_DAYS = 365

export interface NudgeProject {
  id: string
  title: string
  status: string | null
  state?: string | null
  is_priority?: boolean | null
  last_active: string | null
  last_session_ended_at?: string | null
  metadata?: unknown
}

const DONE_STATUSES = new Set(['completed', 'archived', 'abandoned', 'graveyard'])

function quietDays(p: NudgeProject, now: Date): number | null {
  const last = [p.last_session_ended_at, p.last_active]
    .map(d => (d ? new Date(d).getTime() : 0))
    .filter(n => Number.isFinite(n) && n > 0)
  if (last.length === 0) return null
  return Math.floor((now.getTime() - Math.max(...last)) / 86_400_000)
}

/**
 * The one project worth naming: put down a while ago but not long gone,
 * not the one you're on, not last week's pick. The most recently touched
 * of those — the warmest of the cold ones is the likeliest to get picked up.
 */
export function pickWeekendProject(
  projects: NudgeProject[],
  lastPickedId: string | null,
  now = new Date(),
): { project: NudgeProject; days: number } | null {
  const candidates = projects
    .filter(p => !DONE_STATUSES.has(p.status ?? '') && !isGraveyarded(p))
    .filter(p => p.state !== 'live' && !p.is_priority)
    .filter(p => p.id !== lastPickedId)
    .map(p => ({ project: p, days: quietDays(p, now) }))
    .filter((c): c is { project: NudgeProject; days: number } =>
      c.days != null && c.days >= UP_TO_SPEED_AFTER_DAYS && c.days <= MAX_QUIET_DAYS)
    .sort((a, b) => a.days - b.days)
  return candidates[0] ?? null
}

/** Don't offer a weekend-sized job with less than this left in the season:
 *  it would only be a worry. */
export const WEEKEND_JOB_MIN_DAYS = 21

/**
 * A small thing from this season that can be finished: tagged, in date,
 * not waiting on anything, not named last week. A few hours (or unsized)
 * come before a weekend job, and a weekend job only while there is enough
 * season left for it. Nothing qualifying is a fine answer: the caller falls
 * back to the usual pick-up.
 */
export function pickSmallFinish(
  projects: NudgeProject[],
  lastPickedId: string | null,
  now = new Date(),
): { project: NudgeProject; size: 'hours' | 'weekend' } | null {
  const day = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000)
  const today = day(isoDay(now))
  const found: { project: NudgeProject; size: 'hours' | 'weekend'; tag: SeasonTag }[] = []
  for (const p of projects) {
    if (DONE_STATUSES.has(p.status ?? '') || isGraveyarded(p) || p.id === lastPickedId) continue
    if (p.state === 'live' || p.is_priority) continue
    const tag = readSeasonTag(p.metadata)
    if (!tag || tag.role !== 'also' || !inSeason(tag, now) || isBlocked(tag, now)) continue
    const size = tag.size ?? 'hours'
    if (size === 'weekend' && tag.until && day(tag.until) - today < WEEKEND_JOB_MIN_DAYS) continue
    found.push({ project: p, size, tag })
  }
  // Quick ones first; then the one with the nearest end date.
  found.sort((a, b) =>
    (a.size === b.size ? 0 : a.size === 'hours' ? -1 : 1) ||
    (a.tag.until ?? '9999').localeCompare(b.tag.until ?? '9999'))
  return found[0] ? { project: found[0].project, size: found[0].size } : null
}

export function smallFinishMessage(title: string, size: 'hours' | 'weekend'): { title: string; body: string } {
  return { title, body: size === 'hours' ? "A few hours, and it's done." : 'A weekend job, and this one is free.' }
}

export function nudgeMessage(title: string, days: number): { title: string; body: string } {
  const weeks = Math.floor(days / 7)
  const wait = weeks >= 8 ? `${Math.round(days / 30)} months` : `${weeks} weeks`
  return { title, body: `Waiting ${wait}. Here's where you got to.` }
}

/** Saturday, on or after SEND_FROM_HOUR, in their own clock. */
export function isSendTime(now: Date, timezone: string): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', hour: 'numeric', hour12: false,
  }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24
  return weekday === 'Sat' && hour >= SEND_FROM_HOUR
}

export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

type SendPush = (sub: { endpoint: string; p256dh: string; auth: string }, payload: string) => Promise<void>

/**
 * Runs from the 2-hourly voice-reminder job. Missing table (migration not
 * run yet) is reported, not thrown: the voice reminder must still go.
 */
export async function runWeekendNudges(
  supabase: SupabaseClient,
  sendPush: SendPush,
  now = new Date(),
): Promise<{ sent: number; skipped: number; error?: string }> {
  const { data: settings, error } = await supabase
    .from('weekend_nudge_settings')
    .select('user_id, timezone, last_sent_date, last_project_id')
    .eq('enabled', true)
  if (error) return { sent: 0, skipped: 0, error: error.message }

  let sent = 0
  let skipped = 0
  for (const s of settings ?? []) {
    const tz = s.timezone || 'UTC'
    const today = localDate(now, tz)
    if (!isSendTime(now, tz) || s.last_sent_date === today) { skipped++; continue }

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, title, status, state, is_priority, last_active, last_session_ended_at, metadata')
      .eq('user_id', s.user_id)
    if (projErr) {
      console.error('[weekend-nudge] projects failed:', projErr.message)
      continue
    }
    const list = (projects ?? []) as NudgeProject[]
    // A small thing from this season comes first: finishing one gives
    // energy for the big one. Otherwise the usual pick-up.
    const small = pickSmallFinish(list, s.last_project_id ?? null, now)
    const pick = small
      ? { project: small.project, days: 0 }
      : pickWeekendProject(list, s.last_project_id ?? null, now)
    // Nothing waiting is a fine answer: stamp the day so we don't re-check
    // every two hours, and send nothing.
    if (!pick) {
      await supabase.from('weekend_nudge_settings').update({ last_sent_date: today }).eq('user_id', s.user_id)
      skipped++
      continue
    }

    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', s.user_id)
    if (subErr) {
      console.error('[weekend-nudge] subscriptions failed:', subErr.message)
      continue
    }
    const msg = small ? smallFinishMessage(small.project.title, small.size) : nudgeMessage(pick.project.title, pick.days)
    const payload = JSON.stringify({ ...msg, url: `/projects/${pick.project.id}` })
    for (const sub of subs ?? []) {
      try {
        await sendPush(sub, payload)
        sent++
      } catch (e: any) {
        console.error('[weekend-nudge] push failed:', e?.message ?? e)
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
    // Stamped whether or not a push landed, so notifications-off doesn't
    // mean a retry every two hours all Saturday.
    await supabase.from('weekend_nudge_settings')
      .update({ last_sent_date: today, last_project_id: pick.project.id })
      .eq('user_id', s.user_id)
  }
  return { sent, skipped }
}
