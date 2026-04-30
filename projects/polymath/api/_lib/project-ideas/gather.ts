/**
 * Gather — pulls broad context from across the app for the project-ideas
 * generator. Where the noticing pipeline reads 3 tables, this reads ~9 so
 * the generator can ground a project idea in any signal the user has
 * captured: voice notes, list items (films/books/places/etc.), reading
 * highlights, todos, prior project suggestions, idea-engine output,
 * dormant projects.
 *
 * All queries are user-scoped and row-capped. Older signals matter — a
 * recurring interest from 6 months ago is exactly the kind of thing a good
 * project idea should surface — so windows are wider here than in noticing.
 */

import type { getSupabaseClient } from '../supabase.js'
import type { GatherResult } from './types.js'

const RECENT_DAYS = 120
const ANCHOR_DAYS = 365

type Supabase = ReturnType<typeof getSupabaseClient>

export async function gatherForIdeas(supabase: Supabase, userId: string): Promise<GatherResult> {
  const recentSince = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString()
  const anchorSince = new Date(Date.now() - ANCHOR_DAYS * 86_400_000).toISOString()

  const [
    memoriesRes,
    listItemsRes,
    activeProjectsRes,
    dormantProjectsRes,
    readingRes,
    todosRes,
    suggestionsRes,
    ieIdeasRes,
    priorIdeasRes,
  ] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, themes, memory_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', anchorSince)
      .not('body', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('list_items')
      .select('id, content, status, created_at, list_id, lists(title, type)')
      .eq('user_id', userId)
      .gte('created_at', anchorSince)
      .in('status', ['active', 'queued', 'completed'])
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('projects')
      .select('id, title, description, status, metadata, updated_at')
      .eq('user_id', userId)
      .in('status', ['active', 'upcoming'])
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase
      .from('projects')
      .select('id, title, description, status, updated_at')
      .eq('user_id', userId)
      .in('status', ['paused', 'dormant', 'graveyard'])
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, source, created_at, status')
      .eq('user_id', userId)
      .gte('created_at', recentSince)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('todos')
      .select('id, text, notes, tags, created_at')
      .eq('user_id', userId)
      .eq('done', false)
      .is('deleted_at', null)
      .gte('created_at', recentSince)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('project_suggestions')
      .select('id, title, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('ie_ideas')
      .select('id, title, description, status, rejection_reason')
      .eq('user_id', userId)
      .in('status', ['approved', 'pending', 'pending_review'])
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('project_ideas')
      .select('title, status')
      .eq('user_id', userId)
      .in('status', ['saved', 'rejected', 'built'])
      .order('generated_at', { ascending: false })
      .limit(60),
  ])

  const memories = (memoriesRes.data ?? [])
    .filter((m: any) => m.body && m.body.trim().length >= 20)
    .map((m: any) => ({
      id: m.id as string,
      title: m.title as string | null,
      body: (m.body as string).trim(),
      themes: Array.isArray(m.themes) ? (m.themes as string[]) : [],
      memory_type: m.memory_type as string | null,
      created_at: m.created_at as string,
    }))

  const list_items = (listItemsRes.data ?? [])
    .filter((li: any) => li.content && li.content.trim().length >= 4)
    .map((li: any) => ({
      id: li.id as string,
      content: (li.content as string).trim(),
      list_type: (li.lists?.type as string) ?? 'generic',
      list_title: (li.lists?.title as string | null) ?? null,
      status: li.status as string,
      created_at: li.created_at as string,
    }))

  const active_projects = (activeProjectsRes.data ?? []).map((p: any) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? '(untitled)',
    description: p.description as string | null,
    status: p.status as string,
    tags: Array.isArray(p.metadata?.tags) ? (p.metadata.tags as string[]) : [],
    updated_at: (p.updated_at as string) ?? '',
  }))

  const dormant_projects = (dormantProjectsRes.data ?? []).map((p: any) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? '(untitled)',
    description: p.description as string | null,
    status: p.status as string,
    updated_at: (p.updated_at as string) ?? '',
  }))

  const reading = (readingRes.data ?? []).map((r: any) => ({
    id: r.id as string,
    title: r.title as string | null,
    excerpt: r.excerpt as string | null,
    source: r.source as string | null,
    created_at: r.created_at as string,
  }))

  // Highlights are linked to reading_queue articles, so pull them in a
  // second step scoped to the user's articles. RLS on reading_queue keeps
  // this safe even if the highlights table itself only has article_id.
  const articleIds = reading.map(r => r.id)
  let highlights: GatherResult['highlights'] = []
  if (articleIds.length > 0) {
    const { data: highlightRows } = await supabase
      .from('article_highlights')
      .select('id, highlight_text, created_at, article_id, reading_queue!inner(title)')
      .in('article_id', articleIds)
      .order('created_at', { ascending: false })
      .limit(20)
    highlights = ((highlightRows ?? []) as any[])
      .filter(h => h.highlight_text && (h.highlight_text as string).trim().length >= 10)
      .map(h => ({
        id: h.id as string,
        quote: (h.highlight_text as string).trim(),
        article_title: (h.reading_queue?.title as string | null) ?? null,
        created_at: h.created_at as string,
      }))
  }

  const todos = (todosRes.data ?? [])
    .filter((t: any) => t.text && (t.text as string).trim().length >= 4)
    .map((t: any) => ({
      id: t.id as string,
      text: (t.text as string).trim(),
      notes: t.notes as string | null,
      tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
      created_at: t.created_at as string,
    }))

  const prior_suggestions = (suggestionsRes.data ?? []).map((s: any) => ({
    id: s.id as string,
    title: s.title as string,
    status: s.status as string,
  }))

  const ie_ideas = (ieIdeasRes.data ?? []).map((i: any) => ({
    id: i.id as string,
    title: i.title as string,
    description: i.description as string,
    status: i.status as string,
    rejection_reason: i.rejection_reason as string | null,
  }))

  const prior_idea_titles = {
    saved: [] as string[],
    rejected: [] as string[],
    built: [] as string[],
  }
  for (const row of (priorIdeasRes.data ?? []) as Array<{ title: string; status: string }>) {
    if (row.status === 'saved') prior_idea_titles.saved.push(row.title)
    else if (row.status === 'rejected') prior_idea_titles.rejected.push(row.title)
    else if (row.status === 'built') prior_idea_titles.built.push(row.title)
  }

  const total_signal_count =
    memories.length +
    list_items.length +
    active_projects.length +
    dormant_projects.length +
    reading.length +
    highlights.length +
    todos.length

  return {
    memories,
    list_items,
    active_projects,
    dormant_projects,
    reading,
    highlights,
    todos,
    prior_suggestions,
    ie_ideas,
    prior_idea_titles,
    total_signal_count,
  }
}
