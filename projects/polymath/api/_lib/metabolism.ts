import type { SupabaseClient } from '@supabase/supabase-js'
import { cosineSimilarity } from './gemini-embeddings.js'
import { generateText } from './gemini-chat.js'

// Drawer-tier project statuses (not active, not priority, not dead).
export const DRAWER_STATUSES = ['upcoming', 'dormant', 'on-hold', 'maintaining'] as const
export type DrawerStatus = typeof DRAWER_STATUSES[number]

export const MUTATION_MODES = ['shrink', 'merge', 'split', 'reframe', 'snapshot', 'handoff'] as const
export type MutationMode = typeof MUTATION_MODES[number]

// Modes where the parent project is retired once the child is created.
export const MODES_THAT_RETIRE_PARENT: ReadonlySet<MutationMode> = new Set(['snapshot', 'shrink', 'reframe'])

export const DIGEST_STATUSES = ['unread', 'read', 'acted'] as const
export type DigestStatus = typeof DIGEST_STATUSES[number]

export const CATALYST_KINDS = ['skill', 'collaborator', 'tool', 'time', 'life_event', 'other'] as const
export type CatalystKind = typeof CATALYST_KINDS[number]

// The entire tuning surface of the metabolism engine lives here. Adjusting
// these changes how aggressively heat bubbles up.
export const HEAT_TUNING = {
  // Lookback windows
  LOOKBACK_DAYS: 14,
  MEMORY_LOOKBACK_LIMIT: 30,
  ARTICLE_LOOKBACK_LIMIT: 20,
  RETRO_LOOKBACK_LIMIT: 10,
  BUMP_DRAWER_SCAN_LIMIT: 100,

  // Per-scoring-pass caps (how many items we compare a single project against)
  MEMORY_SCORE_WINDOW: 25,
  ARTICLE_SCORE_WINDOW: 15,
  CATALYST_SCAN_WINDOW: 50,
  RETRO_SCORE_WINDOW: 8,

  // Similarity thresholds
  MEMORY_SIM_ACCUMULATE: 0.35,
  MEMORY_SIM_REASON: 0.55,
  ARTICLE_SIM_ACCUMULATE: 0.4,
  ARTICLE_SIM_REASON: 0.55,
  BUMP_SIM_MIN: 0.55,

  // Score weights
  MEMORY_WEIGHT_MAX: 8,
  MEMORY_MULTIPLIER: 10,
  ARTICLE_WEIGHT_MAX: 10,
  ARTICLE_MULTIPLIER: 12,
  CATALYST_BONUS: 15,
  CATALYST_STRENGTH: 0.9,
  RETRO_BONUS: 4,
  RETRO_OVERLAP_MIN: 2,
  RETRO_WORD_MIN_LENGTH: 5,

  // Catalyst word-length minimum (avoids matching "AI" against random text)
  CATALYST_MIN_NEEDLE: 4,
} as const

export interface HeatInputs {
  recentMemories: Array<{ id: string; content: string; embedding?: number[] | null; created_at: string }>
  recentArticles: Array<{ id: string; title: string; embedding?: number[] | null; created_at: string }>
  recentRetros: Array<{ project_id: string; answers: unknown; created_at: string }>
}

export interface HeatResult {
  score: number
  reason: string | null
  evidence_ref: string | null
  catalysts?: Catalyst[] | null
}

export interface Catalyst {
  text: string
  kind?: CatalystKind
  matched?: boolean
  matched_at?: string
  matched_evidence?: string
}

interface ScoringProject {
  id: string
  title: string
  description: string | null
  embedding?: number[] | null
  catalysts?: Catalyst[]
}

export function scoreProjectHeat(project: ScoringProject, inputs: HeatInputs): HeatResult {
  if (!project.embedding || project.embedding.length === 0) {
    return { score: 0, reason: null, evidence_ref: null }
  }

  const T = HEAT_TUNING
  let score = 0
  let bestReason: string | null = null
  let bestEvidenceRef: string | null = null
  let bestStrength = 0

  for (const mem of inputs.recentMemories.slice(0, T.MEMORY_SCORE_WINDOW)) {
    if (!mem.embedding || mem.embedding.length === 0) continue
    const sim = cosineSimilarity(project.embedding, mem.embedding)
    if (sim > T.MEMORY_SIM_ACCUMULATE) {
      score += Math.min(sim * T.MEMORY_MULTIPLIER, T.MEMORY_WEIGHT_MAX)
      if (sim > bestStrength && sim > T.MEMORY_SIM_REASON) {
        bestStrength = sim
        bestReason = `you mentioned this recently — "${truncate(mem.content, 60)}"`
        bestEvidenceRef = `memory:${mem.id}`
      }
    }
  }

  for (const art of inputs.recentArticles.slice(0, T.ARTICLE_SCORE_WINDOW)) {
    if (!art.embedding || art.embedding.length === 0) continue
    const sim = cosineSimilarity(project.embedding, art.embedding)
    if (sim > T.ARTICLE_SIM_ACCUMULATE) {
      score += Math.min(sim * T.ARTICLE_MULTIPLIER, T.ARTICLE_WEIGHT_MAX)
      if (sim > bestStrength && sim > T.ARTICLE_SIM_REASON) {
        bestStrength = sim
        bestReason = `an article you saved connects — "${truncate(art.title, 60)}"`
        bestEvidenceRef = `article:${art.id}`
      }
    }
  }

  let updatedCatalysts: Catalyst[] | null = null
  if (project.catalysts && project.catalysts.length > 0) {
    updatedCatalysts = project.catalysts.map(c => ({ ...c }))
    for (const cat of updatedCatalysts) {
      const needle = cat.text.toLowerCase().trim()
      if (needle.length < T.CATALYST_MIN_NEEDLE) continue
      for (const mem of inputs.recentMemories.slice(0, T.CATALYST_SCAN_WINDOW)) {
        if ((mem.content || '').toLowerCase().includes(needle)) {
          score += T.CATALYST_BONUS
          cat.matched = true
          cat.matched_at = new Date().toISOString()
          cat.matched_evidence = `memory:${mem.id}`
          if (bestStrength < T.CATALYST_STRENGTH) {
            bestStrength = T.CATALYST_STRENGTH
            bestReason = `a condition this project was waiting for just showed up — "${cat.text}"`
            bestEvidenceRef = `catalyst:${cat.text}|memory:${mem.id}`
          }
          break
        }
      }
    }
  }

  for (const retro of inputs.recentRetros.slice(0, T.RETRO_SCORE_WINDOW)) {
    const answersText = JSON.stringify(retro.answers || {}).toLowerCase()
    const projectText = `${project.title} ${project.description || ''}`.toLowerCase()
    const projectWords = projectText.split(/\s+/).filter(w => w.length > T.RETRO_WORD_MIN_LENGTH)
    const overlap = projectWords.filter(w => answersText.includes(w)).length
    if (overlap >= T.RETRO_OVERLAP_MIN) {
      score += T.RETRO_BONUS
    }
  }

  return {
    score: Math.round(score * 10) / 10,
    reason: bestReason,
    evidence_ref: bestEvidenceRef,
    catalysts: updatedCatalysts,
  }
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

export async function recomputeHeatForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ updated: number; skipped: number }> {
  const T = HEAT_TUNING
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, title, description, embedding, catalysts, status, is_priority')
    .eq('user_id', userId)
    .in('status', DRAWER_STATUSES)
    .eq('is_priority', false)

  if (projErr || !projects || projects.length === 0) {
    return { updated: 0, skipped: 0 }
  }

  const since = new Date(Date.now() - T.LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [memRes, artRes, retroRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, content, embedding, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(T.MEMORY_LOOKBACK_LIMIT),
    supabase
      .from('reading_queue')
      .select('id, title, embedding, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(T.ARTICLE_LOOKBACK_LIMIT),
    supabase
      .from('project_retrospectives')
      .select('project_id, answers, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(T.RETRO_LOOKBACK_LIMIT),
  ])

  const inputs: HeatInputs = {
    recentMemories: memRes.data || [],
    recentArticles: artRes.data || [],
    recentRetros: retroRes.data || [],
  }

  const now = new Date().toISOString()

  const results = await Promise.all(projects.map(async p => {
    const result = scoreProjectHeat(p as ScoringProject, inputs)
    const update: Record<string, unknown> = {
      heat_score: result.score,
      heat_reason: result.reason,
      heat_updated_at: now,
    }
    if (result.catalysts) update.catalysts = result.catalysts
    const { error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', p.id)
      .eq('user_id', userId)
    return !error
  }))

  return {
    updated: results.filter(ok => ok).length,
    skipped: results.filter(ok => !ok).length,
  }
}

// Called fire-and-forget from memories.ts after embedding a new memory. Does
// a single-memory pass against drawer projects and bumps heat for strong hits.
export async function bumpHeatFromNewMemory(
  supabase: SupabaseClient,
  userId: string,
  memory: { id: string; content: string; embedding: number[] | null }
): Promise<number> {
  if (!memory.embedding || memory.embedding.length === 0) return 0

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, embedding, heat_score, catalysts')
    .eq('user_id', userId)
    .in('status', DRAWER_STATUSES)
    .eq('is_priority', false)
    .limit(HEAT_TUNING.BUMP_DRAWER_SCAN_LIMIT)

  if (!projects || projects.length === 0) return 0

  const now = new Date().toISOString()
  const reason = `you just mentioned something that connects — "${(memory.content || '').slice(0, 60)}"`

  const results = await Promise.all(projects.map(async p => {
    if (!p.embedding) return false
    const sim = cosineSimilarity(memory.embedding as number[], p.embedding as number[])
    if (sim <= HEAT_TUNING.BUMP_SIM_MIN) return false
    const delta = Math.min(sim * HEAT_TUNING.ARTICLE_MULTIPLIER, HEAT_TUNING.ARTICLE_WEIGHT_MAX)
    await supabase
      .from('projects')
      .update({
        heat_score: (p.heat_score || 0) + delta,
        heat_reason: reason,
        heat_updated_at: now,
      })
      .eq('id', p.id)
      .eq('user_id', userId)
    return true
  }))

  return results.filter(Boolean).length
}

// Shared catalyst inference. Both brainstorm.ts (via the infer-catalysts step)
// and projects.ts (fire-and-forget on project create) call this single helper.
export async function inferCatalysts(
  title: string,
  description: string
): Promise<Catalyst[]> {
  const t = title.trim()
  const d = description.trim()
  if (!t && !d) return []

  const prompt = `You are analyzing a project to infer its catalysts — the external conditions that, if they showed up, would meaningfully unlock or accelerate this project. Think: a new skill, a specific kind of collaborator, a tool becoming cheap/available, a life event, a window of free time, a piece of information.

PROJECT
title: ${t}
description: ${d || '(none)'}

RULES
- Return 2 to 5 catalysts, or an empty array if nothing concrete comes to mind.
- Each catalyst must be specific enough that we could later spot it appearing in the user's voice notes or saved articles. "more time" is too vague. "a free Saturday morning" is concrete.
- Do not invent generic platitudes. If unsure, return fewer or empty.
- Pick a kind for each: ${CATALYST_KINDS.map(k => `'${k}'`).join(' | ')}.

Return JSON only:
{ "catalysts": [ { "text": "...", "kind": "..." }, ... ] }`

  try {
    const raw = await generateText(prompt, { temperature: 0.4, maxTokens: 400, responseFormat: 'json' })
    const parsed = JSON.parse(raw) as { catalysts?: Array<{ text?: unknown; kind?: unknown }> }
    const list = Array.isArray(parsed.catalysts) ? parsed.catalysts : []
    return list
      .filter(c => c && typeof c.text === 'string' && (c.text as string).trim().length >= HEAT_TUNING.CATALYST_MIN_NEEDLE)
      .slice(0, 5)
      .map<Catalyst>(c => ({
        text: String(c.text).trim(),
        kind: (CATALYST_KINDS as readonly string[]).includes(c.kind as string) ? (c.kind as CatalystKind) : 'other',
        matched: false,
      }))
  } catch {
    return []
  }
}
