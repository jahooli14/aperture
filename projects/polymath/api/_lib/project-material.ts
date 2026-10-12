/**
 * Everything the user has actually said about one project, dated and in one
 * list: what the themes draft and "bring me up to speed" read from.
 *
 * Four places hold it, and none of them alone is enough:
 *   - fragments        — captures attached to the project (strict: most
 *                        notes never attach, see fragments.ts)
 *   - memories         — notes the capture triage named this project in
 *                        (triage.project_id), which catches the ones the
 *                        fragment margin rejects
 *   - sessions         — what they wrote when a session ended
 *   - metadata.tasks   — moves they ticked, as a log of done work
 * plus the project's own notes doc, cut short.
 *
 * App-authored notes (spark answers and corrections) are left out, same
 * rule as every other corpus read: they're the app's poke, not a capture.
 * Every query reports its own error; an empty table and a failed query
 * must not look the same.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isAppAuthored } from './corpus-provenance.js'
import type { Evidence } from './session-grounding.js'

export interface MaterialRow {
  kind: 'note' | 'session' | 'done'
  text: string
  at: string
}

export interface ProjectMaterial {
  title: string
  description: string | null
  endGoal: string | null
  status: string | null
  lastSessionAt: string | null
  lastActive: string | null
  notesDoc: string | null
  /** Newest first. */
  rows: MaterialRow[]
  metadata: Record<string, unknown>
}

const PER_SOURCE = 8
const NOTES_DOC_CHARS = 1500
const ROW_CHARS = 600

export async function loadProjectMaterial(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<ProjectMaterial | null> {
  const [projectRes, fragRes, memRes, sessRes] = await Promise.all([
    supabase.from('projects')
      .select('title, description, status, metadata, notes_doc, last_active, last_session_ended_at')
      .eq('id', projectId).eq('user_id', userId).single(),
    supabase.from('fragments')
      .select('text, created_at')
      .eq('project_id', projectId).eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabase.from('memories')
      .select('title, body, tags, created_at')
      .eq('user_id', userId)
      .filter('triage->>project_id', 'eq', projectId)
      .order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabase.from('sessions')
      .select('closeout_text, ended_at')
      .eq('project_id', projectId).eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false }).limit(PER_SOURCE),
  ])
  if (projectRes.error || !projectRes.data) {
    console.error('[project-material] project load failed:', projectRes.error?.message)
    return null
  }
  if (fragRes.error) console.warn('[project-material] fragments failed:', fragRes.error.message)
  if (memRes.error) console.warn('[project-material] memories failed:', memRes.error.message)
  if (sessRes.error) console.warn('[project-material] sessions failed:', sessRes.error.message)

  const p = projectRes.data
  const metadata = (p.metadata as Record<string, unknown>) ?? {}
  const rows: MaterialRow[] = []

  for (const f of fragRes.data ?? []) {
    if (typeof f.text === 'string' && f.text.trim()) rows.push({ kind: 'note', text: f.text.trim(), at: f.created_at })
  }
  for (const m of (memRes.data ?? []).filter(m => !isAppAuthored(m))) {
    const text = [m.title, m.body].filter((t: unknown) => typeof t === 'string' && t.trim()).join(' — ')
    if (text) rows.push({ kind: 'note', text, at: m.created_at })
  }
  for (const s of sessRes.data ?? []) {
    if (typeof s.closeout_text === 'string' && s.closeout_text.trim()) {
      rows.push({ kind: 'session', text: s.closeout_text.trim(), at: s.ended_at })
    }
  }
  const tasks = Array.isArray(metadata.tasks) ? (metadata.tasks as any[]) : []
  for (const t of tasks) {
    if (t?.done && typeof t.text === 'string' && t.text.trim()) {
      rows.push({ kind: 'done', text: t.text.trim(), at: t.completed_at || t.created_at || '' })
    }
  }

  // The same thought can arrive twice (a note that was also attached as a
  // fragment). Keep the first, newest-first.
  const seen = new Set<string>()
  const deduped = rows
    .filter(r => r.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter(r => {
      const key = r.text.slice(0, 80).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(r => ({ ...r, text: r.text.slice(0, ROW_CHARS) }))
    .slice(0, PER_SOURCE * 2)

  const notesDoc = typeof p.notes_doc === 'string'
    ? p.notes_doc.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, NOTES_DOC_CHARS) || null
    : null

  return {
    title: p.title,
    description: p.description ?? null,
    endGoal: typeof metadata.end_goal === 'string' && metadata.end_goal.trim() ? metadata.end_goal.trim() : null,
    status: p.status ?? null,
    lastSessionAt: p.last_session_ended_at ?? null,
    lastActive: p.last_active ?? null,
    notesDoc,
    rows: deduped,
    metadata,
  }
}

/** Read as "from your <label>" under a cited line, so keep them nouns. */
const KIND_LABEL: Record<MaterialRow['kind'], string> = {
  note: 'note',
  session: 'session note',
  done: 'done list',
}

/** Rows as cited evidence, ids N1.. in newest-first order. The notes doc
 *  and description count too, so a theme can come from either. */
export function materialEvidence(m: ProjectMaterial): Evidence[] {
  const ev: Evidence[] = m.rows.map((r, i) => ({
    id: `N${i + 1}`,
    label: `${KIND_LABEL[r.kind]}, ${shortDate(r.at)}`,
    text: r.text,
  }))
  if (m.description) ev.push({ id: 'ABOUT', label: 'project description', text: m.description })
  if (m.notesDoc) ev.push({ id: 'DOC', label: 'project notes', text: m.notesDoc })
  return ev
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'undated'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
