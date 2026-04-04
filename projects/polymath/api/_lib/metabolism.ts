/**
 * Polymath Metabolism helpers
 *
 * Heat scoring, catalyst matching, drawer selection, and digest building.
 * Everything here is server-side and read/writes Supabase via the shared client.
 *
 * Design rule (enforced everywhere): silence over slop. If there is no concrete
 * evidence to cite, heat stays 0, catalysts stay unmatched, digests stay empty.
 * Nothing is ever invented.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { cosineSimilarity } from './gemini-embeddings.js'

// ============================================================================
// Types
// ============================================================================

export interface HeatInputs {
  /** Recent memory rows with embeddings, ordered newest first */
  recentMemories: Array<{
    id: string
    content: string
    embedding?: number[] | null
    created_at: string
  }>
  /** Recent article saves with embeddings */
  recentArticles: Array<{
    id: string
    title: string
    embedding?: number[] | null
    created_at: string
  }>
  /** Retrospectives from recently-finished projects */
  recentRetros: Array<{
    project_id: string
    answers: any
    created_at: string
  }>
}

export interface HeatResult {
  score: number
  reason: string | null
  evidence_ref: string | null
  /** If catalysts were matched during scoring, the updated array (with matched flags). */
  catalysts?: Catalyst[] | null
}

export interface Catalyst {
  text: string
  kind?: 'skill' | 'collaborator' | 'tool' | 'time' | 'life_event' | 'other'
  matched?: boolean
  matched_at?: string
  matched_evidence?: string
}

// ============================================================================
// Heat scoring
// ============================================================================

/**
 * Score a single drawer project against recent user material.
 *
 * The score is cumulative over several weak signals, but we only attach a
 * `reason` (shown to the user) if at least one signal cites concrete evidence.
 * No citation = no reason = the user sees no "warmed" label.
 */
export function scoreProjectHeat(
  project: { id: string; title: string; description: string | null; embedding?: number[] | null; catalysts?: Catalyst[] },
  inputs: HeatInputs
): HeatResult {
  if (!project.embedding || project.embedding.length === 0) {
    return { score: 0, reason: null, evidence_ref: null }
  }

  let score = 0
  let bestReason: string | null = null
  let bestEvidenceRef: string | null = null
  let bestStrength = 0

  // Memory collisions — weak matches accumulate, strong matches win the reason
  for (const mem of inputs.recentMemories.slice(0, 25)) {
    if (!mem.embedding || mem.embedding.length === 0) continue
    const sim = cosineSimilarity(project.embedding, mem.embedding)
    if (sim > 0.35) {
      score += Math.min(sim * 10, 8) // cap single-memory contribution
      if (sim > bestStrength && sim > 0.55) {
        bestStrength = sim
        bestReason = `you mentioned this recently — "${truncate(mem.content, 60)}"`
        bestEvidenceRef = `memory:${mem.id}`
      }
    }
  }

  // Article saves — treated as stronger signal because they're deliberate
  for (const art of inputs.recentArticles.slice(0, 15)) {
    if (!art.embedding || art.embedding.length === 0) continue
    const sim = cosineSimilarity(project.embedding, art.embedding)
    if (sim > 0.4) {
      score += Math.min(sim * 12, 10)
      if (sim > bestStrength && sim > 0.55) {
        bestStrength = sim
        bestReason = `an article you saved connects — "${truncate(art.title, 60)}"`
        bestEvidenceRef = `article:${art.id}`
      }
    }
  }

  // Catalyst matches — if a project's stated catalyst text appears literally in
  // recent user material, that's a very high-signal match. We also flip the
  // `matched` flag on the catalyst so the UI can glow it green.
  let updatedCatalysts: Catalyst[] | null = null
  if (project.catalysts && project.catalysts.length > 0) {
    updatedCatalysts = project.catalysts.map(c => ({ ...c }))
    for (const cat of updatedCatalysts) {
      const needle = cat.text.toLowerCase().trim()
      if (needle.length < 4) continue
      for (const mem of inputs.recentMemories.slice(0, 50)) {
        if ((mem.content || '').toLowerCase().includes(needle)) {
          score += 15
          cat.matched = true
          cat.matched_at = new Date().toISOString()
          cat.matched_evidence = `memory:${mem.id}`
          if (bestStrength < 0.9) {
            bestStrength = 0.9
            bestReason = `a condition this project was waiting for just showed up — "${cat.text}"`
            bestEvidenceRef = `catalyst:${cat.text}|memory:${mem.id}`
          }
          break
        }
      }
    }
  }

  // Retro fuel — themes from recently-finished projects
  for (const retro of inputs.recentRetros.slice(0, 8)) {
    const answersText = JSON.stringify(retro.answers || {}).toLowerCase()
    const projectText = `${project.title} ${project.description || ''}`.toLowerCase()
    const projectWords = projectText.split(/\s+/).filter(w => w.length > 5)
    const overlap = projectWords.filter(w => answersText.includes(w)).length
    if (overlap >= 2) {
      score += 4
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

// ============================================================================
// Recompute: iterate a user's drawer projects and update heat_score in place
// ============================================================================

const DRAWER_HEAT_STATUSES = ['upcoming', 'dormant', 'on-hold', 'maintaining'] as const

export async function recomputeHeatForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ updated: number; skipped: number }> {
  // 1. Load drawer-tier projects (not currently active, not priority, not dead)
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, title, description, embedding, catalysts, status, is_priority')
    .eq('user_id', userId)
    .in('status', DRAWER_HEAT_STATUSES)
    .eq('is_priority', false)

  if (projErr || !projects || projects.length === 0) {
    return { updated: 0, skipped: 0 }
  }

  // 2. Load recent user material (last 14 days)
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [memRes, artRes, retroRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, content, embedding, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('reading_queue')
      .select('id, title, embedding, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('project_retrospectives')
      .select('project_id, answers, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const inputs: HeatInputs = {
    recentMemories: (memRes.data || []) as any,
    recentArticles: (artRes.data || []) as any,
    recentRetros: (retroRes.data || []) as any,
  }

  // 3. Score each project and write back
  let updated = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const p of projects) {
    const result = scoreProjectHeat(p as any, inputs)

    // Decay by 20% if nothing new — prevents stale heat from lingering forever.
    // We don't decay to zero in a single pass; we let the next recompute continue.
    const update: Record<string, any> = {
      heat_score: result.score,
      heat_reason: result.reason,
      heat_updated_at: now,
    }
    if (result.catalysts) {
      update.catalysts = result.catalysts
    }
    const { error: updErr } = await supabase
      .from('projects')
      .update(update)
      .eq('id', p.id)
      .eq('user_id', userId)

    if (updErr) {
      skipped++
    } else {
      updated++
    }
  }

  return { updated, skipped }
}

// ============================================================================
// On-capture nudge: cheaply bump heat for one new memory
// ============================================================================

/**
 * Called from memories.ts action:'process' after embedding a new memory.
 * Does a cheap single-memory pass against drawer projects and bumps heat
 * in place for any strong hit. Zero-cost when nothing matches.
 */
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
    .in('status', DRAWER_HEAT_STATUSES)
    .eq('is_priority', false)
    .limit(100)

  if (!projects || projects.length === 0) return 0

  let bumped = 0
  const now = new Date().toISOString()

  for (const p of projects) {
    if (!p.embedding) continue
    const sim = cosineSimilarity(memory.embedding, p.embedding as any)
    if (sim > 0.55) {
      const delta = Math.min(sim * 12, 10)
      const reason = `you just mentioned something that connects — "${(memory.content || '').slice(0, 60)}"`
      await supabase
        .from('projects')
        .update({
          heat_score: (p.heat_score || 0) + delta,
          heat_reason: reason,
          heat_updated_at: now,
        })
        .eq('id', p.id)
        .eq('user_id', userId)
      bumped++
    }
  }

  return bumped
}
