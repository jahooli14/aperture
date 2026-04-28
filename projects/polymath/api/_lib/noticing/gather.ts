/**
 * Signal gathering — pulls the user's voice notes, list items, and project
 * notes from the last 180 days into a uniform Signal[] the noticing pipeline
 * can read against. Same shape the old self-model used; isolated here so the
 * noticing module is self-contained.
 */

import type { getSupabaseClient } from '../supabase.js'
import type { Signal } from './types.js'

const WINDOW_DAYS = 180

export async function gatherSignals(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<Signal[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [memRes, listRes, projRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, created_at, embedding')
      .eq('user_id', userId)
      .gte('created_at', since)
      .not('body', 'is', null)
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('list_items')
      .select('id, content, metadata, status, created_at, embedding')
      .eq('user_id', userId)
      .gte('created_at', since)
      .not('embedding', 'is', null)
      .in('status', ['active', 'queued', 'completed'])
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('projects')
      .select('id, title, description, status, created_at, updated_at, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .in('status', ['active', 'upcoming', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(40),
  ])

  const signals: Signal[] = []

  for (const m of (memRes.data ?? []) as Array<{
    id: string
    title: string | null
    body: string | null
    created_at: string
    embedding: number[] | string | null
  }>) {
    if (!m.embedding || !m.body || m.body.trim().length < 20) continue
    signals.push({
      id: m.id,
      kind: 'memory',
      text: m.body,
      title: m.title,
      source_label: 'voice note',
      created_at: m.created_at,
      effective_date: m.created_at,
      embedding: m.embedding,
    })
  }

  for (const li of (listRes.data ?? []) as Array<{
    id: string
    content: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    embedding: number[] | string | null
  }>) {
    if (!li.embedding || !li.content || li.content.trim().length < 6) continue
    const listName = typeof li.metadata?.list_name === 'string' ? (li.metadata.list_name as string) : null
    signals.push({
      id: li.id,
      kind: 'list_item',
      text: li.content,
      title: null,
      source_label: listName ? `list · ${listName}` : 'list item',
      created_at: li.created_at,
      effective_date: li.created_at,
      embedding: li.embedding,
    })
  }

  for (const p of (projRes.data ?? []) as Array<{
    id: string
    title: string | null
    description: string | null
    created_at: string
    updated_at: string | null
    embedding: number[] | string | null
  }>) {
    if (!p.embedding) continue
    const text = (p.description && p.description.trim().length > 10) ? p.description : (p.title ?? '')
    if (!text || text.trim().length < 10) continue
    const effective = p.updated_at && new Date(p.updated_at).getTime() > new Date(p.created_at).getTime()
      ? p.updated_at
      : p.created_at
    signals.push({
      id: p.id,
      kind: 'project',
      text,
      title: p.title,
      source_label: p.title ? `project · ${p.title}` : 'project',
      created_at: p.created_at,
      effective_date: effective,
      embedding: p.embedding,
    })
  }

  return signals
}
