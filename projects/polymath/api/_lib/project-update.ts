/**
 * "Update": the one thing you do about a project. Say where you got to (or
 * type it). It is kept as a note on THAT project, with no guessing which, then
 * the project's lines are re-read against it and the line under the title
 * ("You stopped with...") becomes your own words.
 *
 * It replaces the Go timer: nobody presses start and stop, but everybody can
 * say a sentence, and a sentence feeds everything: the lines, the catch-up,
 * the days you touched it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { processMemory } from './process-memory.js'
import { refreshThemes } from './project-catchup-routes.js'
import { moveFromUpdate } from './move-say.js'

export const MAX_UPDATE_CHARS = 2000

export async function saveProjectUpdate(
  supabase: SupabaseClient, userId: string, projectId: string, text: string,
): Promise<
  | {
      ok: true
      themes: { text: string; at: string }[]
      changed: boolean
      previous?: string[]
      /** A project with a stored move: the next one, and what it logged as done. */
      move?: { text: string; kind: 'move' | 'fork' }
      logged?: string
      project_done?: boolean
    }
  | { ok: false; status: number; error: string }
> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_UPDATE_CHARS)
  if (!clean) return { ok: false, status: 400, error: 'Say or type something first.' }

  const { data: project, error: projErr } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('user_id', userId).single()
  if (projErr || !project) return { ok: false, status: 404, error: 'project not found' }

  const now = new Date().toISOString()
  const { data: memory, error: insertErr } = await supabase
    .from('memories')
    .insert({
      user_id: userId,
      audiopen_id: `update_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      title: clean.slice(0, 60),
      body: clean,
      orig_transcript: clean,
      tags: [],
      audiopen_created_at: now,
      memory_type: 'quick-note',
      // Pins the note to this project (explicit-project.ts), whatever the
      // model would have guessed.
      source_reference: `project:${projectId}`,
      processed: false,
    })
    .select('id')
    .single()
  if (insertErr || !memory) {
    console.error('[project-update] could not save the note:', insertErr?.message)
    return { ok: false, status: 500, error: "Couldn't save that. What you wrote is still here." }
  }

  // Inside the request: a note that is only "saved" and not yet read changes
  // nothing the person can see. A failed read is retried by the daily job.
  try { await processMemory(memory.id as string) } catch (e) {
    console.warn('[project-update] processing failed, the daily job will retry:', e instanceof Error ? e.message : e)
  }

  await supabase
    .from('projects')
    .update({ last_active: now, last_closeout_text: clean.slice(0, 1000) })
    .eq('id', projectId).eq('user_id', userId)

  // One after the other: both read-then-write the project's metadata, and
  // run together the second write would wipe the first.
  const refreshed = await refreshThemes(supabase, userId, projectId, true)
  const moved = await moveFromUpdate(supabase, userId, projectId, clean)
  return {
    ok: true,
    themes: refreshed?.themes ?? [],
    changed: !!refreshed?.changed,
    previous: refreshed?.previous,
    ...(moved ? { move: { text: moved.move.text, kind: moved.move.kind }, ...(moved.logged ? { logged: moved.logged } : {}), ...(moved.projectDone ? { project_done: true } : {}) } : {}),
  }
}
