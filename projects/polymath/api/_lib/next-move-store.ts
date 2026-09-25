/**
 * Reading what the move-writer needs from the database, and saving what it
 * wrote. The writing itself is next-move.ts (pure, tested); this is the
 * plumbing, kept apart so the prompt can be tested without a database.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  stageFor, readMove, readFeedback, writeNextMove,
  type MoveInput, type NextMove, type MoveFeedback,
} from './next-move.js'

export interface MoveContext {
  input: MoveInput
  metadata: Record<string, unknown>
  current: NextMove | null
}

interface Overrides {
  note?: string | null
  did?: string[]
  said?: string | null
  answering?: string | null
  /** Treat the project as this far from its last session (close passes 0). */
  daysAway?: number
}

export async function loadMoveContext(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  overrides: Overrides = {},
): Promise<MoveContext | null> {
  const [projectRes, sessionsRes, fragmentsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('title, description, metadata, last_closeout_text, last_session_ended_at, created_at')
      .eq('id', projectId).eq('user_id', userId).single(),
    supabase
      .from('sessions')
      .select('closeout_text, ended_at')
      .eq('project_id', projectId).eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(6),
    supabase
      .from('fragments')
      .select('text')
      .eq('project_id', projectId).eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])
  if (projectRes.error || !projectRes.data) {
    console.error('[next-move] project load failed:', projectRes.error?.message)
    return null
  }
  if (sessionsRes.error) console.warn('[next-move] sessions load failed:', sessionsRes.error.message)
  if (fragmentsRes.error) console.warn('[next-move] fragments load failed:', fragmentsRes.error.message)

  const project = projectRes.data
  const metadata: Record<string, unknown> = (project.metadata as Record<string, unknown>) ?? {}
  const tasks: any[] = Array.isArray(metadata.tasks) ? (metadata.tasks as any[]) : []
  const done = tasks
    .filter(t => t?.done && typeof t.text === 'string')
    .sort((a, b) => String(b.completed_at ?? '').localeCompare(String(a.completed_at ?? '')))
  const sessions = sessionsRes.data ?? []
  const note = overrides.note !== undefined ? overrides.note : (project.last_closeout_text ?? null)
  const pastNotes = sessions
    .map(s => s.closeout_text as string | null)
    .filter((t): t is string => !!t && t.trim() !== (note ?? '').trim())
    .slice(0, 4)

  const lastWorked = project.last_session_ended_at || project.created_at
  const daysAway = overrides.daysAway ?? (lastWorked
    ? Math.floor((Date.now() - new Date(lastWorked).getTime()) / 86_400_000)
    : 0)
  const current = readMove(metadata)
  const endGoal = typeof metadata.end_goal === 'string' && metadata.end_goal.trim() ? metadata.end_goal.trim() : null

  const input: MoveInput = {
    title: project.title,
    description: project.description ?? null,
    endGoal,
    stage: stageFor({ sessionsEver: sessions.length, doneCount: done.length, daysAway }),
    daysAway,
    note: note?.trim() || null,
    did: overrides.did ?? [],
    lastMove: current?.kind === 'move' ? current.text : null,
    log: done.slice(0, 8).map(t => t.text as string),
    pastNotes,
    heading: tasks
      .filter(t => t && !t.done && typeof t.text === 'string')
      .sort((a, b) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0))
      .slice(0, 5)
      .map(t => t.text as string),
    captures: (fragmentsRes.data ?? []).map(f => f.text as string).filter(Boolean),
    feedback: readFeedback(metadata),
    said: overrides.said ?? null,
    answering: overrides.answering ?? null,
  }
  return { input, metadata, current }
}

/**
 * One write. Reads metadata fresh first, so a move saved on the back of a
 * slow model call can't wipe a task list that changed in the meantime.
 */
export async function saveMove(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  move: NextMove,
  feedback?: MoveFeedback[],
): Promise<void> {
  const { data, error } = await supabase
    .from('projects').select('metadata').eq('id', projectId).eq('user_id', userId).single()
  if (error) {
    console.error('[next-move] could not re-read the project before saving:', error.message)
    return
  }
  const metadata = (data?.metadata as Record<string, unknown>) ?? {}
  const { error: saveErr } = await supabase
    .from('projects')
    .update({ metadata: { ...metadata, next_move: move, ...(feedback ? { move_feedback: feedback } : {}) } })
    .eq('id', projectId).eq('user_id', userId)
  if (saveErr) console.error('[next-move] save failed:', saveErr.message)
}

/** How many projects the nightly pass looks at: the ones most likely to be
 *  opened tomorrow. A move for every project nobody opens is spend for
 *  nothing. */
export const NIGHTLY_MOVE_LIMIT = 4

/**
 * Nightly, so the morning open is instant: projects most likely to be
 * opened get a move if they have none (a new project, or one from before
 * moves existed), and a move that's sat a month becomes a way back in --
 * the plan it was written against is cold by now.
 */
export async function ensureMovesForUser(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<{ considered: number; written: number }> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, metadata, is_priority, up_next_position, last_active, status')
    .eq('user_id', userId)
    .not('status', 'in', '(completed,graveyard)')
    .order('is_priority', { ascending: false })
    .order('last_active', { ascending: false })
    .limit(20)
  if (error) {
    console.error('[next-move] nightly project load failed:', error.message)
    return { considered: 0, written: 0 }
  }
  const candidates = (data ?? [])
    .sort((a, b) => Number(!!b.is_priority) - Number(!!a.is_priority)
      || (a.up_next_position ?? 99) - (b.up_next_position ?? 99))
    .slice(0, NIGHTLY_MOVE_LIMIT)

  let written = 0
  for (const p of candidates) {
    const current = readMove(p.metadata)
    const age = current ? (now.getTime() - new Date(current.written_at).getTime()) / 86_400_000 : Infinity
    if (current && age < 28) continue
    const ctx = await loadMoveContext(supabase, userId, p.id)
    if (!ctx) continue
    const { move } = await writeNextMove(ctx.input, 'start')
    await saveMove(supabase, userId, p.id, move)
    written++
  }
  return { considered: candidates.length, written }
}
