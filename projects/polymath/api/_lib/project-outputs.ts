/**
 * What you made — photos, screenshots and audio clips attached to a
 * project (`project_outputs`, served as `utilities?resource=outputs`).
 *
 * The mirror counts hours; this keeps the things. Files are uploaded
 * straight to the public `thought-images` bucket by the client (the same
 * signed-URL path thought photos use), and only the object name is stored
 * here, so a row can never point anywhere else.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'

export const OUTPUTS_BUCKET = 'thought-images'
export const NOTE_MAX_CHARS = 200

export type OutputKind = 'image' | 'audio'

export interface OutputInput {
  project_id: string
  session_id: string | null
  path: string
  kind: OutputKind
  note: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Object names the upload route mints: `<timestamp>_<random>.<ext>`. No
// slashes, so a row can't reach outside the bucket's top level.
const OBJECT_NAME = /^[\w.-]{1,120}$/

export function outputKind(value: unknown): OutputKind | null {
  return value === 'image' || value === 'audio' ? value : null
}

/**
 * The bucket object name inside a public URL for it, or null when the URL
 * isn't one of ours. `publicPrefix` is the bucket's public URL with a
 * trailing slash.
 */
export function pathFromPublicUrl(url: unknown, publicPrefix: string): string | null {
  if (typeof url !== 'string' || !url.startsWith(publicPrefix)) return null
  const rest = url.slice(publicPrefix.length)
  return OBJECT_NAME.test(rest) ? rest : null
}

/** Reads a POST body into a row, or says in plain words what was wrong. */
export function parseOutputInput(
  body: unknown,
  publicPrefix: string,
): { ok: true; value: OutputInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (typeof b.project_id !== 'string' || !UUID.test(b.project_id)) {
    return { ok: false, error: 'project_id required' }
  }
  const path = pathFromPublicUrl(b.url, publicPrefix)
  if (!path) return { ok: false, error: 'url must be an uploaded file' }
  const kind = outputKind(b.kind)
  if (!kind) return { ok: false, error: 'kind must be image or audio' }
  const session_id = typeof b.session_id === 'string' && UUID.test(b.session_id) ? b.session_id : null
  const rawNote = typeof b.note === 'string' ? b.note.trim() : ''
  const note = rawNote ? rawNote.slice(0, NOTE_MAX_CHARS) : null
  return { ok: true, value: { project_id: b.project_id, session_id, path, kind, note } }
}

/** The table hasn't been created yet (migration not run). */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function handleProjectOutputs(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  userId: string,
) {
  const storage = supabase.storage.from(OUTPUTS_BUCKET)
  const publicPrefix = storage.getPublicUrl('').data.publicUrl.replace(/\/?$/, '/')
  const toItem = (row: any) => ({
    id: row.id,
    project_id: row.project_id,
    session_id: row.session_id,
    kind: row.kind,
    note: row.note,
    created_at: row.created_at,
    url: publicPrefix + row.path,
  })

  if (req.method === 'GET') {
    const projectId = req.query.project_id
    if (typeof projectId !== 'string' || !UUID.test(projectId)) {
      return res.status(400).json({ error: 'project_id required' })
    }
    const { data, error } = await supabase
      .from('project_outputs')
      .select('id, project_id, session_id, path, kind, note, created_at')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (isMissingTable(error)) return res.status(200).json({ items: [], available: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ items: (data ?? []).map(toItem), available: true })
  }

  if (req.method === 'POST') {
    const parsed = parseOutputInput(req.body, publicPrefix)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })

    // The project has to be theirs. RLS doesn't apply to the service key.
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', parsed.value.project_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (projectErr) return res.status(500).json({ error: projectErr.message })
    if (!project) return res.status(404).json({ error: 'project not found' })

    const { data, error } = await supabase
      .from('project_outputs')
      .insert({ ...parsed.value, user_id: userId })
      .select('id, project_id, session_id, path, kind, note, created_at')
      .single()
    if (isMissingTable(error)) {
      return res.status(503).json({ error: "Saving what you made isn't set up yet." })
    }
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ item: toItem(data) })
  }

  if (req.method === 'DELETE') {
    const id = req.query.id
    if (typeof id !== 'string' || !UUID.test(id)) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase
      .from('project_outputs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('path')
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    // The file goes too. Best effort: a leftover file costs nothing anyone sees.
    if (data?.path) {
      const { error: rmErr } = await storage.remove([data.path])
      if (rmErr) console.warn('[outputs] could not remove file:', rmErr.message)
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'GET, POST or DELETE' })
}
