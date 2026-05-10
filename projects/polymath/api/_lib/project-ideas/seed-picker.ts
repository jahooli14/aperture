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
 *   - Topical proxy: tokenised keyword overlap between centre text and
 *     arrival text. Rough but enough to surface ripe pairs first.
 *   - Recency × dormancy: arrivals score by recency (≤7d > ≤14d > ≤30d);
 *     centres score by dormancy depth (a 6-month dormant project beats a
 *     2-week dormant one, all else equal).
 *
 * The picker's output is *candidates*. The LLM still has the right to look
 * at a pair and say "this isn't actually a missing-piece match" — in which
 * case that slot is dropped. So a weak pair doesn't force a bad idea.
 */

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
  topical_overlap: number
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

      const overlap = topicalOverlap(c.tokens, a.tokens)
      const recencyScore = arrivalRecencyScore(a.date)
      const centreScore = c.score
      // Topical overlap matters but isn't the only thing — a recent arrival
      // can supply context (a tool, a skill) that doesn't share keywords
      // with the centre. Floor at 1.0 so zero-overlap pairs still rank by
      // recency × dormancy.
      const score = centreScore * recencyScore * (1 + overlap * 1.5)

      candidates.push({
        centre: { kind: c.kind, id: c.id, title: c.title, description: c.description, last_touched: c.last_touched },
        arrival: { kind: a.kind, id: a.id, label: a.label, date: a.date, excerpt: a.excerpt },
        pair: { centre_kind: c.kind, centre_id: c.id, arrival_kind: a.kind, arrival_id: a.id },
        score,
        topical_overlap: overlap,
      })
    }
  }

  candidates.sort((x, y) => y.score - x.score)

  // Greedy distinct-centre selection. The first time we see a centre we keep
  // the pair; later pairs sharing that centre are skipped. Two ideas leading
  // from the same dormant project are always two flavours of the same thing.
  const usedCentres = new Set<string>()
  const picked: SeedCandidate[] = []
  for (const cand of candidates) {
    if (usedCentres.has(cand.centre.id)) continue
    usedCentres.add(cand.centre.id)
    picked.push(cand)
    if (picked.length >= count) break
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

function tokenise(text: string): Set<string> {
  if (!text) return new Set()
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue
    if (STOP.has(raw)) continue
    out.add(raw)
  }
  return out
}

function topicalOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  if (inter === 0) return 0
  // Jaccard. Caps at 1.0 even when one side is much smaller than the other.
  const union = a.size + b.size - inter
  return inter / union
}
