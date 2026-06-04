/**
 * Seed picker — chooses (centre × arrival) pairs in code so the LLM never
 * picks the idea, only writes it up. Same data → different pair → different
 * idea. This is the fix for "two runs gave the same idea in different
 * wording." The picker enforces:
 *
 *   - Cooldown: a pair used in the last ~12 weeks (status != rejected) is
 *     excluded. Rejected pairs are dead via prior-titles, not cooldown.
 *   - Distinct centres: top picks must lead from different project-centres
 *     so two ideas can't both be variations on the same dormant project.
 *   - Relatedness: how much the arrival is "about" the centre. Cosine over
 *     the two stored embeddings when both exist (real semantic match — a
 *     synth project and a note about "sound that decays slowly" converge
 *     even with no shared words); Jaccard token overlap as the fallback when
 *     either side hasn't been embedded yet. Strict upgrade where vectors
 *     exist, exactly the old behaviour where they don't.
 *   - Recency × dormancy: arrivals score by recency (≤7d > ≤14d > ≤30d);
 *     centres score by dormancy depth (a 6-month dormant project beats a
 *     2-week dormant one, all else equal).
 *
 * The picker's output is *candidates*. The LLM still has the right to look
 * at a pair and say "this isn't actually a missing-piece match" — in which
 * case that slot is dropped. So a weak pair doesn't force a bad idea.
 */

import { cosineSimilarity } from '../gemini-embeddings.js'
import type { ArrivalKind, CentreKind, GatherResult, SeedPair } from './types.js'

export interface SeedCandidate {
  centre: {
    kind: CentreKind
    id: string
    title: string
    description: string
    last_touched: string
  }
  arrival: {
    kind: ArrivalKind
    id: string
    label: string
    date: string
    excerpt: string
  }
  pair: SeedPair
  score: number
  /** Centre↔arrival relatedness in [0,1]: cosine (rescaled) when both rows
   *  are embedded, Jaccard token overlap otherwise. Drives the score's
   *  topical multiplier; surfaced for logging. */
  relatedness: number
  /** True when `relatedness` came from embeddings, false when it fell back
   *  to token overlap. Logged so a sudden drop in semantic coverage (e.g.
   *  embeddings not yet computed) is visible. */
  semantic: boolean
}

export interface PickOptions {
  /** Max number of pairs to return. Default 3 (matches the 3-card home). */
  count?: number
  /** Days into the past that count as a "recent arrival." */
  arrivalWindowDays?: number
}

export function pickSeedPairs(g: GatherResult, opts: PickOptions = {}): SeedCandidate[] {
  const count = opts.count ?? 3
  const arrivalWindowDays = opts.arrivalWindowDays ?? 30

  const cooldown = new Set(g.recent_seed_pairs.map(p => `${p.centre_id}::${p.arrival_id}`))
  const recentCentres = new Set(g.recent_centre_ids ?? [])

  const centres = enumerateCentres(g)
  const arrivals = enumerateArrivals(g, arrivalWindowDays)
  if (centres.length === 0 || arrivals.length === 0) return []

  const candidates: SeedCandidate[] = []
  for (const c of centres) {
    for (const a of arrivals) {
      // Don't pair a memory-as-centre with itself as an arrival.
      if (c.id === a.id) continue

      const key = `${c.id}::${a.id}`
      if (cooldown.has(key)) continue

      const rel = relatedness(c, a)
      const recencyScore = arrivalRecencyScore(a.date)
      const centreScore = c.score
      // Relatedness matters but isn't the only thing — a recent arrival can
      // supply context (a tool, a skill) that's only loosely about the
      // centre. Floor at 1.0 so unrelated pairs still rank by recency ×
      // dormancy. Same multiplier the Jaccard version used, so the rest of
      // the tuning is untouched; the input is just smarter now.
      const score = centreScore * recencyScore * (1 + rel.value * 1.5)

      candidates.push({
        centre: { kind: c.kind, id: c.id, title: c.title, description: c.description, last_touched: c.last_touched },
        arrival: { kind: a.kind, id: a.id, label: a.label, date: a.date, excerpt: a.excerpt },
        pair: { centre_kind: c.kind, centre_id: c.id, arrival_kind: a.kind, arrival_id: a.id },
        score,
        relatedness: rel.value,
        semantic: rel.semantic,
      })
    }
  }

  candidates.sort((x, y) => y.score - x.score)

  // Greedy distinct-centre selection. The first time we see a centre we keep
  // the pair; later pairs sharing that centre are skipped. Two ideas leading
  // from the same dormant project are always two flavours of the same thing.
  //
  // Two passes so a back-to-back regen can't reach for the just-used centre
  // with a different arrival: pass 1 skips centres in recent_centre_ids;
  // pass 2 fills any remaining slots from those skipped centres if we'd
  // otherwise return fewer than `count`.
  const usedCentres = new Set<string>()
  const picked: SeedCandidate[] = []
  const deferred: SeedCandidate[] = []
  for (const cand of candidates) {
    if (usedCentres.has(cand.centre.id)) continue
    if (recentCentres.has(cand.centre.id)) {
      deferred.push(cand)
      continue
    }
    usedCentres.add(cand.centre.id)
    picked.push(cand)
    if (picked.length >= count) break
  }
  if (picked.length < count) {
    for (const cand of deferred) {
      if (usedCentres.has(cand.centre.id)) continue
      usedCentres.add(cand.centre.id)
      picked.push(cand)
      if (picked.length >= count) break
    }
  }
  return picked
}

interface CentreRow {
  kind: CentreKind
  id: string
  title: string
  description: string
  last_touched: string
  tokens: Set<string>
  embedding: number[] | null
  score: number
}

function enumerateCentres(g: GatherResult): CentreRow[] {
  const out: CentreRow[] = []
  const now = Date.now()

  for (const p of g.dormant_projects) {
    const text = `${p.title} ${p.description ?? ''}`.trim()
    const dormancyDays = ageDays(p.updated_at, now)
    // Dormant 4+ months is the sweet spot for the long-dormant reshape mode.
    // Score by depth, capped — a 5-year-old project shouldn't dominate.
    const dormancyScore = Math.min(2.0, 1.0 + dormancyDays / 180)
    out.push({
      kind: 'project_dormant',
      id: p.id,
      title: p.title,
      description: p.description ?? '',
      last_touched: p.updated_at,
      tokens: tokenise(text),
      embedding: parseEmbedding(p.embedding),
      score: dormancyScore,
    })
  }

  for (const p of g.active_projects) {
    const text = `${p.title} ${p.description ?? ''} ${p.tags.join(' ')}`.trim()
    // Active projects are eligible only for Mode 3 EXTEND. Lower base score
    // so dormant revivals sort first, but they can still surface when a
    // recent arrival genuinely points at a new direction.
    out.push({
      kind: 'project_active',
      id: p.id,
      title: p.title,
      description: p.description ?? '',
      last_touched: p.updated_at,
      tokens: tokenise(text),
      embedding: parseEmbedding(p.embedding),
      score: 0.6,
    })
  }

  return out
}

interface ArrivalRow {
  kind: ArrivalKind
  id: string
  label: string
  date: string
  excerpt: string
  tokens: Set<string>
  embedding: number[] | null
}

function enumerateArrivals(g: GatherResult, windowDays: number): ArrivalRow[] {
  const out: ArrivalRow[] = []
  const now = Date.now()
  const cutoff = now - windowDays * 86_400_000

  for (const m of g.memories) {
    const t = new Date(m.created_at).getTime()
    if (Number.isNaN(t) || t < cutoff) continue
    out.push({
      kind: 'memory',
      id: m.id,
      label: m.title || 'voice note',
      date: m.created_at,
      excerpt: m.body,
      tokens: tokenise(`${m.title ?? ''} ${m.body} ${m.themes.join(' ')}`),
      embedding: parseEmbedding(m.embedding),
    })
  }

  for (const r of g.reading) {
    const t = new Date(r.created_at).getTime()
    if (Number.isNaN(t) || t < cutoff) continue
    out.push({
      kind: 'reading',
      id: r.id,
      label: r.title ?? 'article',
      date: r.created_at,
      excerpt: r.excerpt ?? r.title ?? '',
      tokens: tokenise(`${r.title ?? ''} ${r.excerpt ?? ''}`),
      embedding: parseEmbedding(r.embedding),
    })
  }

  for (const h of g.highlights) {
    const t = new Date(h.created_at).getTime()
    if (Number.isNaN(t) || t < cutoff) continue
    out.push({
      kind: 'highlight',
      id: h.id,
      label: h.article_title ? `highlight from ${h.article_title}` : 'highlight',
      date: h.created_at,
      excerpt: h.quote,
      tokens: tokenise(`${h.article_title ?? ''} ${h.quote}`),
      // article_highlights has no embedding column → always token-fallback.
      embedding: null,
    })
  }

  return out
}

function arrivalRecencyScore(dateStr: string): number {
  const days = ageDays(dateStr, Date.now())
  if (days <= 7) return 1.0
  if (days <= 14) return 0.75
  if (days <= 30) return 0.5
  if (days <= 60) return 0.3
  return 0.15
}

function ageDays(dateStr: string, now: number): number {
  if (!dateStr) return 9999
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 9999
  return Math.max(0, (now - t) / 86_400_000)
}

const STOP = new Set([
  'the','and','for','with','from','that','this','have','has','was','were','will','would',
  'about','into','your','their','there','where','when','what','which','than','then','also',
  'just','like','some','more','only','very','each','its','our','out','off','too','can','any',
  'all','one','two','three','not','but','are','you','they','them','his','her','him','she','he',
  'a','i','to','of','in','on','at','by','as','is','it','an','or','if','be','do','so','my','me','we','us',
])

export function tokenise(text: string): Set<string> {
  if (!text) return new Set()
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue
    if (STOP.has(raw)) continue
    out.add(raw)
  }
  return out
}

export function topicalOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  if (inter === 0) return 0
  // Jaccard. Caps at 1.0 even when one side is much smaller than the other.
  const union = a.size + b.size - inter
  return inter / union
}

/** Parse a stored embedding into a number[] once, so the picker isn't
 *  re-parsing the same JSON string on every pair. Supabase returns pgvector
 *  as a JSON string; we also accept an already-parsed array. Anything else
 *  (null, malformed, empty) → null, which routes the pair to the token
 *  fallback. */
export function parseEmbedding(v: unknown): number[] | null {
  if (!v) return null
  if (Array.isArray(v)) return v.length ? (v as number[]) : null
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) && parsed.length ? (parsed as number[]) : null
    } catch {
      return null
    }
  }
  return null
}

// Cosine band → relatedness. gemini-embedding-001 cosines don't sit near 0
// for unrelated text — same-corpus pairs cluster well above it — so raw
// cosine can't drop straight into the old `(1 + x * 1.5)` multiplier that
// expected a [0,1] Jaccard input. We rescale: at/below FLOOR → 0 (treat as
// unrelated, rank on recency × dormancy alone), at/above CEIL → 1 (a real
// "this is about that" hit), linear between. Conservative band; tune against
// observed cosine distributions if semantic ranking feels too flat or too
// hot. Monotonic, so ordering is preserved within the band either way.
export const SEMANTIC_FLOOR = 0.5
export const SEMANTIC_CEIL = 0.82

export function cosineToRelatedness(cos: number): number {
  if (!Number.isFinite(cos) || cos <= SEMANTIC_FLOOR) return 0
  if (cos >= SEMANTIC_CEIL) return 1
  return (cos - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR)
}

/** Centre↔arrival relatedness in [0,1]. Cosine over embeddings when BOTH
 *  sides are embedded (the real semantic signal — finds pairs about the same
 *  thing in different words); Jaccard token overlap when either embedding is
 *  missing (a just-captured note may not be embedded yet; highlights have no
 *  embedding column at all). Strict upgrade where vectors exist, exactly the
 *  prior behaviour where they don't. `semantic` reports which path ran. */
export function relatedness(
  centre: { embedding: number[] | null; tokens: Set<string> },
  arrival: { embedding: number[] | null; tokens: Set<string> },
): { value: number; semantic: boolean } {
  if (centre.embedding && arrival.embedding) {
    return { value: cosineToRelatedness(cosineSimilarity(centre.embedding, arrival.embedding)), semantic: true }
  }
  return { value: topicalOverlap(centre.tokens, arrival.tokens), semantic: false }
}
