/**
 * The review rotation.
 *
 * The problem this solves: a handful of priority projects live in the user's
 * head just fine. Everything else is forgotten — not dead, just out of sight,
 * and therefore unable to do the one job a dormant project is good for, which
 * is sparking the next one. A flat list on another page doesn't fix that,
 * because nobody opens a list of forty things on purpose.
 *
 * So instead of a list: a rotation. Two or three forgotten projects at a time,
 * surfaced where the user already looks, each acted on in one tap. Reviewing
 * one stamps it and drops it to the back of the queue.
 *
 * Labels are what make it more than a shuffle. A project sharing a label with
 * whatever the user is currently pushing on is a building block, not a random
 * resurfacing — that's the "you're on a music thing, these two are also music"
 * prompt, and it's why the tag backfill comes first.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeTags } from './project-tags.js'

/** How long a project rests after a review before it's eligible again. */
export const REVIEW_COOLDOWN_DAYS = 21

/** Projects per review batch. Small enough to actually do, not a chore list. */
export const REVIEW_BATCH_SIZE = 3

/** Statuses that can enter the rotation. Completed and buried never do. */
export const REVIEWABLE_STATUSES = ['upcoming', 'active', 'dormant', 'on-hold', 'maintaining'] as const

export type ReviewAction = 'keep' | 'park' | 'promote'

export interface ReviewCandidate {
  id: string
  title: string
  description: string | null
  tags: string[]
  status: string
  last_active: string | null
  /** Why this one surfaced now — a shared label, or simply time. */
  reason: string
  /** Labels it shares with the project the user is currently pushing on. */
  shared_tags: string[]
  days_since_touched: number
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Number.MAX_SAFE_INTEGER
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return Number.MAX_SAFE_INTEGER
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Phrase why this project is in front of the user right now.
 *
 * Cite or stay vague-but-honest: a shared label is a real reason and gets
 * named; otherwise we say plainly that it's been sitting. No invented causal
 * story about what the user's recent notes "mean" — that's the narrative
 * why_now anti-pattern.
 */
function buildReason(sharedTags: string[], days: number, anchorTitle: string | null): string {
  if (sharedTags.length > 0 && anchorTitle) {
    const label = sharedTags[0]
    return `Also ${label}, like ${anchorTitle}.`
  }
  if (sharedTags.length > 0) {
    return `Tagged ${sharedTags[0]}.`
  }
  if (days === Number.MAX_SAFE_INTEGER) return 'Never started.'
  if (days < 60) return `Untouched ${Math.floor(days / 7)} weeks.`
  const months = Math.floor(days / 30)
  return `Untouched ${months} months.`
}

/**
 * Pick the next few projects to put in front of the user.
 *
 * Ordering: projects sharing a label with the current priority project come
 * first (they're building blocks for what's already in motion), then by how
 * long they've been out of sight. Anything reviewed inside the cooldown is
 * held back so the rotation actually rotates.
 *
 * Pure — the IO lives in getReviewQueue. Keeping the selection separable is
 * what makes the ordering testable without a database.
 */
export function selectReviewCandidates(
  projects: Array<Record<string, any>>,
  limit: number = REVIEW_BATCH_SIZE
): { candidates: ReviewCandidate[]; anchor: { title: string; tags: string[] } | null } {
  // The anchor is whatever the user is currently pushing on. Its labels are
  // what make a resurfaced project a building block rather than a random pick.
  const priority = projects.find(p => p.is_priority) || null
  const anchor = priority
    ? { title: priority.title as string, tags: normalizeTags(priority.metadata?.tags) }
    : null
  const anchorTags = new Set(anchor?.tags || [])

  const eligible = projects.filter(p => {
    if (p.is_priority) return false              // already in the user's head
    if (p.up_next_position != null) return false // already queued and visible
    if (p.metadata?.is_shaped === false) return false // half-captured, not a real project yet
    if (!REVIEWABLE_STATUSES.includes(p.status)) return false
    return daysSince(p.metadata?.last_reviewed_at) >= REVIEW_COOLDOWN_DAYS
  })

  const scored: ReviewCandidate[] = eligible.map(p => {
    const tags = normalizeTags(p.metadata?.tags)
    const sharedTags = tags.filter(t => anchorTags.has(t))
    const touched = daysSince(p.last_active || p.updated_at || p.created_at)
    return {
      id: p.id as string,
      title: p.title as string,
      description: (p.description ?? null) as string | null,
      tags,
      status: p.status as string,
      last_active: (p.last_active ?? null) as string | null,
      shared_tags: sharedTags,
      days_since_touched: touched === Number.MAX_SAFE_INTEGER ? 0 : touched,
      reason: buildReason(sharedTags, touched, anchor?.title || null),
    }
  })

  scored.sort((a, b) => {
    if (a.shared_tags.length !== b.shared_tags.length) {
      return b.shared_tags.length - a.shared_tags.length
    }
    return b.days_since_touched - a.days_since_touched
  })

  return { candidates: scored.slice(0, limit), anchor }
}

export async function getReviewQueue(
  supabase: SupabaseClient,
  userId: string,
  limit: number = REVIEW_BATCH_SIZE
): Promise<{ candidates: ReviewCandidate[]; anchor: { title: string; tags: string[] } | null }> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, status, last_active, updated_at, created_at, is_priority, up_next_position, metadata')
    .eq('user_id', userId)
    .in('status', REVIEWABLE_STATUSES as unknown as string[])

  if (error) throw new Error(`Failed to load projects for review: ${error.message}`)

  return selectReviewCandidates(projects || [], limit)
}

/**
 * Record a review decision.
 *
 * Every action stamps `last_reviewed_at`, which is what pushes the project to
 * the back of the rotation — including `keep`, whose whole meaning is "I've
 * seen this, it's still mine, stop asking for now".
 */
export async function actOnReview(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  action: ReviewAction
): Promise<{ success: true; action: ReviewAction }> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, metadata, status')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load project: ${error.message}`)
  if (!project) throw new Error('Project not found')

  const metadata = {
    ...(project.metadata || {}),
    last_reviewed_at: new Date().toISOString(),
  }

  const patch: Record<string, unknown> = { metadata }

  if (action === 'park') {
    // Out of the rotation, not destroyed. Dormant still shows on the projects
    // page and still feeds the idea generator — it just stops asking.
    patch.status = 'dormant'
  } else if (action === 'promote') {
    // "This one, now." Becomes active and freshly touched so the rest of the
    // home stack treats it as live.
    patch.status = 'active'
    patch.last_active = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (updateError) throw new Error(`Failed to save review: ${updateError.message}`)

  return { success: true, action }
}
