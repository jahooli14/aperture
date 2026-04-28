/**
 * Historian — the longitudinal agent.
 *
 * Builds a small structured identity sketch for the user from their voice
 * notes, list items, and project notes. Cached weekly per user — the sketch
 * doesn't change much day to day, and re-scanning every refresh would be
 * expensive and noisy.
 *
 * The sketch is descriptive, not prescriptive. It does NOT compile a list
 * of "your skills" or "your strengths" — those readings are productivity
 * fluff and lead the downstream agents into the cringe register. Instead it
 * tracks what *shapes* keep returning in the user's own captures, which
 * projects are dormant-but-live, who keeps being mentioned, and which
 * life-stage facts they've stated.
 */

import { generateText } from '../gemini-chat.js'
import { getSupabaseClient } from '../supabase.js'
import { MODELS } from '../models.js'
import type { HistorianSketch } from './types.js'

const SKETCH_TTL_DAYS = 7
const HISTORY_WINDOW_DAYS = 365

interface SignalRow {
  kind: 'memory' | 'list_item' | 'project'
  id: string
  text: string
  title: string | null
  date: string
  status: string | null
}

export async function getOrBuildSketch(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<HistorianSketch | null> {
  if (!opts.force) {
    const cached = await readCached(supabase, userId)
    if (cached) return cached
  }
  const built = await buildSketch(supabase, userId)
  if (built) await writeCached(supabase, userId, built.sketch, built.signal_count)
  return built?.sketch ?? null
}

async function readCached(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<HistorianSketch | null> {
  const cutoff = new Date(Date.now() - SKETCH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('noticing_sketches')
    .select('sketch, generated_at')
    .eq('user_id', userId)
    .gte('generated_at', cutoff)
    .maybeSingle()
  if (!data?.sketch) return null
  return data.sketch as HistorianSketch
}

async function writeCached(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  sketch: HistorianSketch,
  signal_count: number,
) {
  await supabase
    .from('noticing_sketches')
    .upsert(
      { user_id: userId, sketch, signal_count, generated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
}

async function buildSketch(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<{ sketch: HistorianSketch; signal_count: number } | null> {
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [memRes, listRes, projRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .not('body', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('list_items')
      .select('id, content, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('projects')
      .select('id, title, description, status, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(60),
  ])

  const signals: SignalRow[] = []
  for (const m of (memRes.data ?? []) as Array<{ id: string; title: string | null; body: string | null; created_at: string }>) {
    if (!m.body || m.body.trim().length < 20) continue
    signals.push({ kind: 'memory', id: m.id, text: m.body, title: m.title, date: m.created_at, status: null })
  }
  for (const li of (listRes.data ?? []) as Array<{ id: string; content: string | null; status: string | null; created_at: string }>) {
    if (!li.content || li.content.trim().length < 4) continue
    signals.push({ kind: 'list_item', id: li.id, text: li.content, title: null, date: li.created_at, status: li.status })
  }
  for (const p of (projRes.data ?? []) as Array<{ id: string; title: string | null; description: string | null; status: string | null; created_at: string; updated_at: string | null }>) {
    const text = (p.description && p.description.trim().length > 10) ? p.description : (p.title ?? '')
    if (!text.trim()) continue
    const eff = p.updated_at && new Date(p.updated_at).getTime() > new Date(p.created_at).getTime() ? p.updated_at : p.created_at
    signals.push({ kind: 'project', id: p.id, text, title: p.title, date: eff, status: p.status })
  }

  if (signals.length < 5) return null

  const prompt = buildHistorianPrompt(signals)
  let raw: string
  try {
    raw = await generateText(prompt, {
      maxTokens: 3000,
      temperature: 0.3,
      responseFormat: 'json',
      model: MODELS.FLASH_CHAT,
    })
  } catch (err) {
    console.warn('[noticing/historian] generation failed:', err)
    return null
  }

  const parsed = parseSketch(raw)
  if (!parsed) return null
  return { sketch: parsed, signal_count: signals.length }
}

function buildHistorianPrompt(signals: SignalRow[]): string {
  // Newest first, capped — most LLMs do better with curation than dump.
  const lines = signals.slice(0, 220).map(s => {
    const days = daysAgo(s.date)
    const label = s.kind === 'memory' ? 'voice note' : s.kind === 'list_item' ? `list (${s.status ?? '?'})` : `project (${s.status ?? '?'})`
    const titleBit = s.title ? ` "${s.title}"` : ''
    const body = s.text.replace(/\s+/g, ' ').slice(0, 360).trim()
    return `[${days}d] ${label}${titleBit} :: ${body}`
  }).join('\n')

  return `You're reading someone's captured thoughts — voice notes, list items, project descriptions — over the last year, newest first. Your job is to write a small descriptive sketch of who this person seems to be RIGHT NOW. Not their CV. Not their strengths. Not advice. Just patterns that are visibly in the data.

You will fill four lists. Be specific. Use the user's own words where you can. If a category has nothing real, return an empty array for it — never invent.

1. recurring_shapes — themes the user has returned to AT LEAST THREE TIMES across different days. A theme that appears once or twice is not a shape. The "name" should be in the user's own vocabulary, not yours. Each shape needs at least three pieces of evidence (source label, date, and a short verbatim excerpt).

2. dormant_projects — projects with status 'paused' or 'upcoming', or projects with status 'active' that haven't been updated in 30+ days. Note when last touched and one short sentence on what's distinctive about it. Skip generic projects with no specific angle.

3. returning_people — people mentioned by name or unmistakable role (e.g. "my mum", "Tilly", "the friend who lost her mum") in TWO OR MORE captures. Use the same name the user uses. Include a one-line context. Skip throwaway mentions.

4. life_stage_facts — short factual sentences the user has stated about their life: relationships, location moves, career changes, kids' ages, recent events. Five at most. Stated facts only — never inferred.

Output JSON only, no prose, with this exact shape:
{
  "recurring_shapes": [{ "name": "...", "evidence": [{ "source_key": "memory:abc-... or list_item:... or project:...", "date": "ISO", "excerpt": "..." }, ...], "first_seen": "ISO", "last_seen": "ISO" }, ...],
  "dormant_projects": [{ "title": "...", "project_id": "...", "last_touched": "ISO", "note": "..." }, ...],
  "returning_people": [{ "name": "...", "times_mentioned": 0, "last_mentioned": "ISO", "context": "..." }, ...],
  "life_stage_facts": ["..."]
}

DO NOT include strengths, skills, productivity tips, or recommendations. This sketch is descriptive only — it is read by a separate writer who needs a clean view of what's actually there.

=== CAPTURES (newest first) ===
${lines}

Return the JSON now.`
}

function parseSketch(raw: string): HistorianSketch | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const obj = JSON.parse(cleaned) as Partial<HistorianSketch>
    return {
      recurring_shapes: Array.isArray(obj.recurring_shapes) ? obj.recurring_shapes : [],
      dormant_projects: Array.isArray(obj.dormant_projects) ? obj.dormant_projects : [],
      returning_people: Array.isArray(obj.returning_people) ? obj.returning_people : [],
      life_stage_facts: Array.isArray(obj.life_stage_facts) ? obj.life_stage_facts : [],
    }
  } catch (err) {
    console.warn('[noticing/historian] parse failed:', err, 'head:', raw.slice(0, 200))
    return null
  }
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)))
}
