/**
 * Generator — synthesises 3 ranked project ideas from a GatherResult.
 *
 * Single Gemini Pro call (deeper reasoning than Flash for cross-domain
 * synthesis), JSON-mode response. Pro is slower but the cost of a bland
 * homepage is the user not trusting the surface — much more expensive
 * than $0.20/run.
 *
 * Time budget on a 60s Vercel function: ~5s gather + ~40-50s Pro call +
 * ~3s insert. No retry loop — a retry would push us past the ceiling and
 * Pro at temperature 0.85 doesn't need it. Truncated JSON gets a salvage
 * pass before we give up.
 *
 * Quality moves baked in (research-driven):
 *   - Enumerate 15-20 candidate seeds first, then critique each, then
 *     select 3. Single biggest evidence-backed lever for non-obvious
 *     output (Wharton paper on AI idea diversity).
 *   - Anti-pattern banlist on modal-mediocre tech-Twitter side projects
 *     (newsletter, podcast, course, tracker app, "directory of", etc.).
 *     Forces the model to NAME the cliché before allowing the candidate.
 *   - Each rank slot has a different JOB: rank-1 is evidence-strongest,
 *     rank-2 is highest cross-domain distance, rank-3 is highest novelty
 *     vs prior surfaced ideas. So #2 and #3 aren't "slightly worse #1s".
 *   - Rejection *reasons* (not just titles) are surfaced to the prompt
 *     so the next batch is conditioned on why prior ideas missed.
 *   - Evidence excerpts are verified server-side to substring-match the
 *     real source body; LLM-fabricated quotes are replaced with the
 *     actual text. This is the trust premise of the surface.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import type { GatherResult, GenerationResult, IdeaEvidence, ProjectIdea } from './types.js'

const MIN_SIGNALS = 8

export async function generateProjectIdeas(gathered: GatherResult): Promise<GenerationResult> {
  if (gathered.total_signal_count < MIN_SIGNALS) {
    console.log(`[project-ideas] insufficient_data: ${gathered.total_signal_count} signals (min ${MIN_SIGNALS})`)
    return { ideas: [], reason: 'insufficient_data', attempts: 0 }
  }

  const prompt = buildPrompt(gathered)
  console.log(`[project-ideas] gather: ${gathered.total_signal_count} signals; prompt: ${prompt.length} chars`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      // Flash is cheap; give the 3-phase prompt enough headroom that 15
      // drafts + 15 reviews + 3 full ideas all fit comfortably. Earlier
      // 8000-token budget was running out before the `ideas` array even
      // started, leaving us with parseable drafts but no actual output.
      maxTokens: 32000,
      temperature: 0.85,
      responseFormat: 'json',
    })
  } catch (err) {
    console.error(`[project-ideas] Flash call threw after ${Date.now() - t0}ms:`, err)
    return { ideas: [], reason: 'parse_failure', attempts: 1 }
  }
  console.log(`[project-ideas] Flash responded in ${Date.now() - t0}ms (${raw.length} chars)`)

  const ideas = parseAndValidate(raw, gathered)
  if (ideas.length === 0) {
    // Log a preview so the next failure is debuggable from Vercel logs.
    // Long preview so we can see whether the JSON truncated, the ideas
    // array was empty, or every idea got dropped by validation. Log in
    // chunks because Vercel truncates very long single log lines.
    console.warn(`[project-ideas] no valid ideas after parse. raw length: ${raw.length}`)
    for (let i = 0; i < raw.length; i += 1500) {
      console.warn(`[project-ideas] raw[${i}..]: ${raw.slice(i, i + 1500)}`)
    }
    return { ideas: [], reason: 'parse_failure', attempts: 1 }
  }

  console.log(`[project-ideas] produced ${ideas.length} valid ideas`)
  return { ideas, attempts: 1 }
}

function buildPrompt(g: GatherResult): string {
  const memBlock = g.memories.slice(0, 35).map(m => {
    const date = isoDate(m.created_at)
    const themeStr = m.themes.length ? ` · themes: ${m.themes.slice(0, 4).join(', ')}` : ''
    const typeStr = m.memory_type ? ` [${m.memory_type}]` : ''
    return `  memory#${m.id} (${date})${typeStr}${themeStr}\n    "${truncate(m.body, 280)}"`
  }).join('\n')

  const listsByType = groupBy(g.list_items, li => li.list_type)
  const listBlock = Array.from(listsByType.entries()).map(([type, items]) =>
    `  ${type} (${items.length}):\n${items.slice(0, 12).map(li =>
      `    list_item#${li.id} (${isoDate(li.created_at)}, ${li.status}) — ${truncate(li.content, 140)}`
    ).join('\n')}`
  ).join('\n')

  const activeProjBlock = g.active_projects.map(p =>
    `  project#${p.id} [${p.status}] "${p.title}"${p.description ? `\n    ${truncate(p.description, 240)}` : ''}${p.tags.length ? `\n    tags: ${p.tags.slice(0, 6).join(', ')}` : ''}`
  ).join('\n')

  const dormantProjBlock = g.dormant_projects.map(p =>
    `  project_dormant#${p.id} [${p.status}, last touched ${isoDate(p.updated_at)}] "${p.title}"${p.description ? `\n    ${truncate(p.description, 200)}` : ''}`
  ).join('\n')

  const readingBlock = g.reading.map(r =>
    `  reading#${r.id} (${isoDate(r.created_at)}) "${r.title ?? '(untitled)'}"${r.source ? ` · ${r.source}` : ''}${r.excerpt ? `\n    ${truncate(r.excerpt, 200)}` : ''}`
  ).join('\n')

  const highlightBlock = g.highlights.map(h =>
    `  highlight#${h.id} (${isoDate(h.created_at)}, from "${h.article_title ?? 'article'}") — "${truncate(h.quote, 220)}"`
  ).join('\n')

  const todoBlock = g.todos.map(t =>
    `  todo#${t.id} (${isoDate(t.created_at)}) — ${truncate(t.text, 180)}${t.notes ? ` :: ${truncate(t.notes, 120)}` : ''}`
  ).join('\n')

  const ieBlock = g.ie_ideas.slice(0, 10).map(i =>
    `  idea_engine#${i.id} [${i.status}] "${i.title}" — ${truncate(i.description, 160)}`
  ).join('\n')

  const suggestionBlock = g.prior_suggestions.slice(0, 10).map(s =>
    `  suggestion#${s.id} [${s.status}] "${s.title}"`
  ).join('\n')

  const seenBlock = [
    ...g.prior_ideas.built.map(t => `  · BUILT: "${t.title}"${t.feedback ? ` — note: ${truncate(t.feedback, 120)}` : ''}`),
    ...g.prior_ideas.saved.map(t => `  · saved: "${t.title}"${t.feedback ? ` — note: ${truncate(t.feedback, 120)}` : ''}`),
    ...g.prior_ideas.rejected.map(t => `  · rejected: "${t.title}"${t.feedback ? ` — reason: ${truncate(t.feedback, 120)}` : ''}`),
  ].join('\n')

  return `You are a curator with taste — a friend who has watched this person capture and abandon many things, and is allergic to the obvious side-project clichés. You are looking at the data below and your job is to surface THREE project ideas that this specific person should be working on but probably hasn't thought of themselves. Three ideas only they could uniquely make, with evidence in their own captures.

══════ THE DATA ══════

VOICE NOTES (recent, in order):
${memBlock || '  (none)'}

LIST ITEMS (films/books/places/etc — what they're consuming and queuing up):
${listBlock || '  (none)'}

CURRENTLY ACTIVE PROJECTS:
${activeProjBlock || '  (none)'}

DORMANT / ON-HOLD / ARCHIVED / ABANDONED PROJECTS (unfinished bets — fertile ground for revival or remix):
${dormantProjBlock || '  (none)'}

READING QUEUE (articles they cared enough to save):
${readingBlock || '  (none)'}

ARTICLE HIGHLIGHTS (sentences they pulled out — high-signal):
${highlightBlock || '  (none)'}

OPEN TODOS (current friction):
${todoBlock || '  (none)'}

EXISTING IDEA-ENGINE OUTPUT (already-generated ideas — use as context, don't repeat):
${ieBlock || '  (none)'}

PRIOR PROJECT SUGGESTIONS:
${suggestionBlock || '  (none)'}

PREVIOUSLY SURFACED PROJECT IDEAS (do NOT repeat any of these — and especially honour rejection reasons):
${seenBlock || '  (none)'}

══════ HOW TO THINK ══════

Work in three phases. Output a JSON object with keys "drafts", "review", "ideas".

PHASE 1 — DRAFTS (15 candidates).
Brainstorm 15 distinct candidate ideas. Each candidate is one line: a punchy title plus the 2-3 source ids it draws on. Lean into cross-domain intersections — the interesting ideas live where two unrelated captures meet (a voice note about X plus a film queued plus a dormant project about Y produces an idea none alone would suggest). Force yourself to range widely; don't just list 15 variations of the strongest signal. Repetition or near-duplicates within the 15 wastes your own budget.

PHASE 2 — REVIEW (15 critiques).
For EACH of the 15 candidates, write one short critique line that says:
  - what cliché it pattern-matches (or "none" if genuinely original), AND
  - whether the evidence actually supports it (not just "they like X" — does the evidence point at THIS specific project?), AND
  - one sentence on why it would or would not surprise the user.
A candidate fails the cliché check if it pattern-matches any of: a newsletter, a podcast, an online course, a tracker app, a year-of-X challenge, a book club, a curated list, a "directory of", a Substack, an essay series, a personal-website redesign, a digital garden, a tools-i-use page, a 30-day project, a Notion template, a "second brain" tool. UNLESS the evidence specifically demands it AND you can name three reasons it's not the cliché version, mark cliché candidates as failed.

PHASE 3 — IDEAS (the final 3).
Pick exactly 3 from the 15. Each rank slot has a DIFFERENT JOB:
  - rank 1 — EVIDENCE-STRONGEST. The idea where the evidence in their own data is the most undeniable. The "you'll agree this is in your data" pick. Most concrete.
  - rank 2 — HIGHEST CROSS-DOMAIN DISTANCE. The idea drawn from the most unrelated captures (a film + a voice note + a dormant project from different worlds). The "huh, those things go together" pick.
  - rank 3 — HIGHEST NOVELTY VS PRIOR. The idea that is most unlike anything in PREVIOUSLY SURFACED PROJECT IDEAS or the IDEA-ENGINE OUTPUT. The "where did that come from" pick.

The 3 picks must NOT share a lead evidence item, and must NOT both pattern-match the same artefact noun. If your initial 3 violate this, swap.

For each of the 3 final ideas, output:
- title: punchy, ≤ 8 words. Concrete, not abstract.
- pitch: 2-3 sentences. Specific scope; implies what "done" looks like.
- why_now: ONE sentence naming the exact pattern in the data that makes this ripe RIGHT NOW. Reference what they captured.
- next_step: ONE concrete first action doable in under an hour today. Not "research X" or "make a plan" — a real first move (a phone call to a specific kind of person, a 200-word draft, a 30-minute walk to a specific place, a list of N specific things).
- evidence: 3-5 source items. Each: { kind, source_id, label, date, excerpt }. excerpt MUST be verbatim text from the data above (will be checked).
- rank_role: one of "evidence_strongest" | "cross_domain" | "novelty"

══════ HARD CONSTRAINTS ══════
- Imperative verbs are FINE. Time estimates are FINE. Concrete artefact nouns are FINE (zine, walk, interview, shop, device, prototype, exhibition, etc.).
- Every idea must cite at least 2 different evidence items.
- excerpt fields will be substring-checked against the real source text. If you can't quote verbatim, put a short label there and we'll fill it in.
- If you genuinely cannot find 3 grounded ideas that pass cliché-check, return fewer (1 or 2). Padding is worse than silence.

══════ OUTPUT (strict JSON, no markdown fences) ══════
{
  "drafts": [
    "Title — uses memory#abc, list_item#xyz, project_dormant#qrs",
    ... (15 lines)
  ],
  "review": [
    "Title — cliché: none/<name>; evidence: yes/no because ...; surprise: ...",
    ... (15 lines)
  ],
  "ideas": [
    {
      "rank": 1,
      "rank_role": "evidence_strongest",
      "title": "...",
      "pitch": "...",
      "why_now": "...",
      "next_step": "...",
      "evidence": [
        { "kind": "memory", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "..." }
      ]
    },
    { "rank": 2, "rank_role": "cross_domain", ... },
    { "rank": 3, "rank_role": "novelty", ... }
  ]
}`
}

interface RawIdea {
  rank?: number
  rank_role?: string
  title?: string
  pitch?: string
  why_now?: string
  next_step?: string
  evidence?: Array<{ kind?: string; source_id?: string; label?: string; date?: string; excerpt?: string }>
}

const VALID_KINDS = new Set([
  'memory',
  'list_item',
  'project',
  'project_dormant',
  'reading',
  'highlight',
  'todo',
  'suggestion',
  'idea_engine',
])

function parseAndValidate(raw: string, gathered: GatherResult): ProjectIdea[] {
  const payload = robustJsonParse(raw)
  if (!payload || typeof payload !== 'object') return []
  const ideasRaw = (payload as { ideas?: RawIdea[] }).ideas
  if (!Array.isArray(ideasRaw)) return []

  // Build lookup tables of real source content for excerpt verification.
  // The validator replaces fabricated excerpts with the real text rather
  // than dropping the evidence — preserves the citation, kills the lie.
  const sourceLookup = buildSourceLookup(gathered)

  const out: ProjectIdea[] = []
  let nextRank = 1
  const usedLeadEvidence = new Set<string>()

  for (const item of ideasRaw) {
    if (!item.title || !item.pitch || !item.next_step || !item.why_now) continue
    if (!Array.isArray(item.evidence)) continue

    const evidence: IdeaEvidence[] = []
    const seenSources = new Set<string>()
    for (const e of item.evidence) {
      if (!e.kind || !e.source_id || !VALID_KINDS.has(e.kind)) continue
      // The prompt formats ids as `kind#uuid` so the model can keep types
      // and ids together visually. The model echoes that format back in
      // the source_id field, but our lookup is keyed on the bare uuid.
      // Accept either form so a `memory#9a2d…` and `9a2d…` both resolve.
      const rawId = e.source_id
      const bareId = rawId.includes('#') ? rawId.split('#').slice(-1)[0] : rawId
      const real = sourceLookup.get(bareId)
      if (!real) continue // fabricated id
      if (seenSources.has(bareId)) continue // dedupe within an idea
      seenSources.add(bareId)

      const labelOut = (e.label ?? '').slice(0, 120) || real.label
      const dateOut = real.date || (e.date ?? '').slice(0, 32)
      const excerptOut = verifyOrReplaceExcerpt(e.excerpt ?? '', real.body)
      evidence.push({
        kind: e.kind as IdeaEvidence['kind'],
        // Persist the bare uuid — the UI never shows source_id, but
        // storing the canonical form keeps later joins / debugging sane.
        source_id: bareId,
        label: labelOut,
        date: dateOut,
        excerpt: excerptOut,
      })
    }
    // Be lenient (≥2) — better to ship a slightly thin idea than 0 ideas
    // because of strict validation. The UI labels "from N signals" so
    // small N is visible and self-correcting.
    if (evidence.length < 2) continue

    out.push({
      rank: typeof item.rank === 'number' ? item.rank : nextRank,
      title: item.title.trim().slice(0, 140),
      pitch: item.pitch.trim().slice(0, 800),
      why_now: item.why_now.trim().slice(0, 400),
      next_step: item.next_step.trim().slice(0, 400),
      evidence,
    })
    nextRank++
    if (out.length >= 3) break
  }

  // Forced diversity: if two finalists share their lead evidence, demote
  // the later one. Cheap last-line defence beyond the prompt's own rule.
  const filtered: ProjectIdea[] = []
  for (const idea of out.sort((a, b) => a.rank - b.rank)) {
    const lead = idea.evidence[0]?.source_id
    if (lead && usedLeadEvidence.has(lead)) continue
    if (lead) usedLeadEvidence.add(lead)
    filtered.push(idea)
  }
  return filtered.map((idea, i) => ({ ...idea, rank: i + 1 }))
}

interface SourceRow {
  body: string
  date: string
  label: string
}

function buildSourceLookup(g: GatherResult): Map<string, SourceRow> {
  const m = new Map<string, SourceRow>()
  for (const r of g.memories) {
    m.set(r.id, { body: `${r.title ?? ''} ${r.body}`.trim(), date: isoDate(r.created_at), label: 'voice note' })
  }
  for (const li of g.list_items) {
    m.set(li.id, { body: li.content, date: isoDate(li.created_at), label: li.list_title ? `${li.list_type} list — ${li.list_title}` : `${li.list_type} list` })
  }
  for (const p of g.active_projects) {
    m.set(p.id, { body: `${p.title} ${p.description ?? ''}`.trim(), date: isoDate(p.updated_at), label: `project: ${p.title}` })
  }
  for (const p of g.dormant_projects) {
    m.set(p.id, { body: `${p.title} ${p.description ?? ''}`.trim(), date: isoDate(p.updated_at), label: `dormant project: ${p.title}` })
  }
  for (const r of g.reading) {
    m.set(r.id, { body: `${r.title ?? ''} ${r.excerpt ?? ''}`.trim(), date: isoDate(r.created_at), label: r.title ? `article: ${r.title}` : 'article' })
  }
  for (const h of g.highlights) {
    m.set(h.id, { body: h.quote, date: isoDate(h.created_at), label: h.article_title ? `highlight from ${h.article_title}` : 'highlight' })
  }
  for (const t of g.todos) {
    m.set(t.id, { body: `${t.text} ${t.notes ?? ''}`.trim(), date: isoDate(t.created_at), label: 'todo' })
  }
  for (const s of g.prior_suggestions) {
    m.set(s.id, { body: s.title, date: '', label: `suggestion: ${s.title}` })
  }
  for (const i of g.ie_ideas) {
    m.set(i.id, { body: `${i.title} ${i.description}`.trim(), date: '', label: `idea-engine: ${i.title}` })
  }
  return m
}

/**
 * If the LLM-supplied excerpt is a verbatim substring of the real source
 * body (whitespace-normalised), keep it. Otherwise fall back to the real
 * body, trimmed — the citation should never let the model put words in
 * the user's mouth.
 */
function verifyOrReplaceExcerpt(claimed: string, body: string): string {
  const normalisedBody = body.replace(/\s+/g, ' ').trim()
  const normalisedClaim = claimed.replace(/\s+/g, ' ').trim()
  if (normalisedClaim && normalisedClaim.length >= 8 && normalisedBody.toLowerCase().includes(normalisedClaim.toLowerCase())) {
    return normalisedClaim.slice(0, 220)
  }
  return truncate(normalisedBody, 220)
}

/**
 * Robust JSON parse with three salvage passes — Pro at 8000 tokens
 * shouldn't truncate often, but when it does we'd rather ship 2 ideas
 * than 0.
 */
function robustJsonParse(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
  // Pass 1: full parse
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  // Pass 2: find the last balanced `}` and try parsing through there
  const lastBrace = trimmed.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(trimmed.slice(0, lastBrace + 1)) } catch { /* fall through */ }
  }
  // Pass 3: extract just the "ideas" array if we can locate a clean
  // closing `]` after `"ideas":` — covers truncation in the trailing
  // metadata after the array.
  const ideasIdx = trimmed.indexOf('"ideas"')
  if (ideasIdx >= 0) {
    const arrStart = trimmed.indexOf('[', ideasIdx)
    const arrEnd = trimmed.lastIndexOf(']')
    if (arrStart > 0 && arrEnd > arrStart) {
      try {
        const arr = JSON.parse(trimmed.slice(arrStart, arrEnd + 1))
        return { ideas: arr }
      } catch { /* fall through */ }
    }
  }
  return null
}

function isoDate(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  const trimmed = s.trim().replace(/\s+/g, ' ')
  return trimmed.length <= n ? trimmed : trimmed.slice(0, n - 1) + '…'
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k) ?? []
    arr.push(it)
    m.set(k, arr)
  }
  return m
}
