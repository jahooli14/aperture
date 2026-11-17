/**
 * What you made: the photos, recordings and links that are the actual output
 * of a project -- each painting, each mix on SoundCloud, the draft at each
 * stage -- with a title, a few words and the day it was made.
 *
 * Files live in the PRIVATE `made` bucket under the person's own folder and
 * are read through signed URLs that expire in an hour: paintings and photos
 * with other people in them don't belong behind public links. Rows from
 * before (the public `thought-images` bucket) still read. A link gets its
 * title and artwork from the site (oEmbed for SoundCloud, Mixcloud, YouTube,
 * Vimeo; Open Graph for anything else), fetched once when it's saved.
 *
 * Pure rules: made.ts. Needs 20260923_project_outputs.sql and
 * 20261117_what_you_made.sql; until the second is run, GET says
 * available: false and the app hides the shelf.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cleanLink, oembedUrl, readOembed, readOpenGraph, madeOn, numberPieces, TITLE_MAX, NOTE_MAX, type LinkMeta, type MadeKind } from './made.js'
import { detectBotWallText } from './bot-wall.js'

export const MADE_BUCKET = 'made'
const LEGACY_BUCKET = 'thought-images'
const SIGNED_FOR_S = 3600
const META_TIMEOUT_MS = 5_000
const COLS = 'id, project_id, path, bucket, kind, title, note, link, link_meta, made_on, created_at'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OBJECT = /^[0-9a-f-]{36}\/[\w.-]{1,120}$/i
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/webm': 'webm' }

/** The table or the new columns aren't there yet (a migration not run). */
export function isNotSetUp(error: { code?: string } | null | undefined): boolean {
  return ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error?.code ?? '')
}

interface Row {
  id: string; project_id: string; path: string | null; bucket: string | null; kind: MadeKind
  title: string | null; note: string | null; link: string | null; link_meta: LinkMeta | null
  made_on: string | null; created_at: string
}

async function withUrls(supabase: SupabaseClient, rows: Row[]) {
  const priv = rows.filter(r => r.path && (r.bucket ?? LEGACY_BUCKET) === MADE_BUCKET).map(r => r.path!)
  const signed = new Map<string, string>()
  if (priv.length) {
    const { data } = await supabase.storage.from(MADE_BUCKET).createSignedUrls(priv, SIGNED_FOR_S)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  const legacy = supabase.storage.from(LEGACY_BUCKET)
  // Numbered within each project by the day made, counting every piece on
  // it, not just the ones in this response.
  const numbers = new Map<string, number>()
  const projectIds = [...new Set(rows.map(r => r.project_id))]
  const { data: all } = await supabase.from('project_outputs').select('id, project_id, made_on, created_at').in('project_id', projectIds)
  const byProject = new Map<string, { id: string; made_on: string | null; created_at: string }[]>()
  for (const r of (all ?? rows) as Row[]) byProject.set(r.project_id, [...(byProject.get(r.project_id) ?? []), r])
  for (const list of byProject.values()) for (const [id, n] of numberPieces(list)) numbers.set(id, n)
  return rows.map(r => ({
    id: r.id, project_id: r.project_id, kind: r.kind, title: r.title, note: r.note,
    link: r.link, link_meta: r.link_meta, made_on: r.made_on ?? r.created_at.slice(0, 10), created_at: r.created_at,
    number: numbers.get(r.id) ?? null,
    url: r.path ? ((r.bucket ?? LEGACY_BUCKET) === MADE_BUCKET ? signed.get(r.path) ?? null : legacy.getPublicUrl(r.path).data.publicUrl) : null,
  }))
}

/** Title and artwork for a link. Never throws: no preview is fine. */
export async function fetchLinkMeta(link: string): Promise<LinkMeta | null> {
  try {
    const oe = oembedUrl(link)
    if (oe) {
      const r = await fetch(oe, { signal: AbortSignal.timeout(META_TIMEOUT_MS) })
      if (r.ok) return readOembed(await r.json())
    }
    const r = await fetch(link, {
      redirect: 'follow', signal: AbortSignal.timeout(META_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Polymath/1.0)', Accept: 'text/html,*/*' },
    })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('html')) return null
    const meta = readOpenGraph((await r.text()).slice(0, 300_000))
    // A bot wall's title is not the page's.
    return meta.title && detectBotWallText(meta.title, meta.title) ? { ...meta, title: undefined } : meta
  } catch {
    return null
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function handleProjectOutputs(req: VercelRequest, res: VercelResponse, supabase: SupabaseClient, userId: string) {
  const owns = async (projectId: unknown) => {
    if (typeof projectId !== 'string' || !UUID.test(projectId)) return false
    const { data } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle()
    return !!data
  }

  if (req.method === 'GET') {
    const projectId = req.query.project_id
    let q = supabase.from('project_outputs').select(COLS).eq('user_id', userId)
    if (typeof projectId === 'string') {
      if (!UUID.test(projectId)) return res.status(400).json({ error: 'project_id required' })
      q = q.eq('project_id', projectId)
    }
    const { data, error } = await q.order('made_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(500)
    if (isNotSetUp(error)) return res.status(200).json({ items: [], available: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ items: await withUrls(supabase, (data ?? []) as Row[]), available: true })
  }

  if (req.method === 'POST' && req.body?.action === 'upload-url') {
    const type = typeof req.body.fileType === 'string' ? req.body.fileType : ''
    const ext = EXT[type]
    if (!ext) return res.status(400).json({ error: 'Photos and audio only.' })
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`
    const { data, error } = await supabase.storage.from(MADE_BUCKET).createSignedUploadUrl(path)
    if (error || !data?.signedUrl) return res.status(503).json({ error: "Saving what you made isn't set up yet." })
    return res.status(200).json({ path, signedUrl: data.signedUrl })
  }

  if (req.method === 'POST') {
    const b = (req.body ?? {}) as Record<string, unknown>
    if (!(await owns(b.project_id))) return res.status(404).json({ error: 'project not found' })
    const row: Record<string, unknown> = {
      user_id: userId, project_id: b.project_id,
      title: str(b.title, TITLE_MAX), note: str(b.note, NOTE_MAX), made_on: madeOn(b.made_on),
    }
    if (b.kind === 'link') {
      const link = cleanLink(b.link)
      if (!link) return res.status(400).json({ error: 'That needs to be a full https:// link.' })
      Object.assign(row, { kind: 'link', link, link_meta: await fetchLinkMeta(link) })
    } else if (b.kind === 'image' || b.kind === 'audio') {
      if (typeof b.path !== 'string' || !OBJECT.test(b.path) || !b.path.startsWith(`${userId}/`)) {
        return res.status(400).json({ error: 'That file was not uploaded here.' })
      }
      Object.assign(row, { kind: b.kind, path: b.path, bucket: MADE_BUCKET })
    } else {
      return res.status(400).json({ error: 'kind must be image, audio or link' })
    }
    const { data, error } = await supabase.from('project_outputs').insert(row).select(COLS).single()
    if (isNotSetUp(error)) return res.status(503).json({ error: "Saving what you made isn't set up yet." })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ item: (await withUrls(supabase, [data as Row]))[0] })
  }

  const id = req.query.id
  if (typeof id !== 'string' || !UUID.test(id)) return res.status(400).json({ error: 'id required' })

  if (req.method === 'PATCH') {
    const b = (req.body ?? {}) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    if ('title' in b) patch.title = str(b.title, TITLE_MAX)
    if ('note' in b) patch.note = str(b.note, NOTE_MAX)
    if ('made_on' in b) patch.made_on = madeOn(b.made_on)
    const { data, error } = await supabase.from('project_outputs').update(patch).eq('id', id).eq('user_id', userId).select(COLS).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'not found' })
    return res.status(200).json({ item: (await withUrls(supabase, [data as Row]))[0] })
  }

  if (req.method === 'DELETE') {
    const { data, error } = await supabase.from('project_outputs').delete().eq('id', id).eq('user_id', userId).select('path, bucket').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (data?.path) {
      const { error: rmErr } = await supabase.storage.from((data.bucket as string | null) ?? LEGACY_BUCKET).remove([data.path as string])
      if (rmErr) console.warn('[outputs] could not remove file:', rmErr.message)
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'GET, POST, PATCH or DELETE' })
}
