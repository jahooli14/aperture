/**
 * Generator — synthesises 3 ranked project ideas from a GatherResult.
 *
 * One LLM call, JSON-mode response. The prompt is the heart of this surface
 * and is deliberately doing the *opposite* of the noticing pipeline: it
 * names projects, includes concrete next steps, and isn't afraid of
 * imperative verbs. The user wants ideas to act on, not literary witness.
 *
 * Each idea is grounded in real captures (3-5 evidence items) so the user
 * can verify the system isn't fabricating connections. Evidence is matched
 * to the gathered data by source-id; if the LLM invents an id, that
 * evidence is dropped silently — the idea still ships if it has at least
 * 2 surviving evidence rows.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import type { GatherResult, GenerationResult, IdeaEvidence, ProjectIdea } from './types.js'

const MIN_SIGNALS = 8
const MAX_RETRIES = 2

export async function generateProjectIdeas(gathered: GatherResult): Promise<GenerationResult> {
  if (gathered.total_signal_count < MIN_SIGNALS) {
    return { ideas: [], reason: 'insufficient_data', attempts: 0 }
  }

  const prompt = buildPrompt(gathered)

  let attempts = 0
  let lastError: unknown = null
  for (let i = 0; i <= MAX_RETRIES; i++) {
    attempts++
    try {
      const raw = await generateText(prompt, {
        model: MODELS.FLASH_CHAT,
        maxTokens: 3500,
        temperature: 0.85,
        responseFormat: 'json',
      })
      const parsed = parseAndValidate(raw, gathered)
      if (parsed.length > 0) return { ideas: parsed, attempts }
    } catch (err) {
      lastError = err
      console.warn(`[project-ideas] generation attempt ${attempts} failed:`, err)
    }
  }

  console.error('[project-ideas] all attempts failed:', lastError)
  return { ideas: [], reason: 'parse_failure', attempts }
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

  const seenTitles = [
    ...g.prior_idea_titles.saved.map(t => `  · saved: "${t}"`),
    ...g.prior_idea_titles.rejected.map(t => `  · rejected: "${t}"`),
    ...g.prior_idea_titles.built.map(t => `  · built: "${t}"`),
  ].slice(0, 30).join('\n')

  return `You are surfacing project ideas for a polymath who captures voice notes, list items, articles, and projects across many domains. The system has gathered everything they've recently touched. Your job: read across all of it and propose THREE distinct project ideas they should be working on — ideas they probably haven't had themselves, that only this specific person could uniquely make.

Each idea must be grounded in real evidence from the data below (cite specific source ids), have a concrete first step, and earn its place in the top 3 by being non-obvious. Do not propose ideas that are restatements of what they're already doing, or that they have already considered (see "previously surfaced ideas" — never repeat those).

══════ THE DATA ══════

VOICE NOTES (recent, in order):
${memBlock || '  (none)'}

LIST ITEMS (films/books/places/etc — what they're consuming and queuing up):
${listBlock || '  (none)'}

CURRENTLY ACTIVE PROJECTS:
${activeProjBlock || '  (none)'}

DORMANT / PAUSED / GRAVEYARD PROJECTS (these are unfinished bets — fertile ground for revival or remix):
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

PREVIOUSLY SURFACED PROJECT IDEAS (do not repeat any of these):
${seenTitles || '  (none)'}

══════ YOUR TASK ══════

Generate exactly 3 project ideas, ranked 1-3 by how strongly the evidence supports them and how surprised the user might be that this idea exists in their data.

For each idea, output:
- title: punchy, ≤ 8 words. Concrete, not abstract. ("A field guide to disused cinemas in your borough" beats "A photography project")
- pitch: 2-3 sentences explaining what the project is. Specific scope. Implies what "done" might look like.
- why_now: ONE sentence naming the specific pattern in the data that makes this idea ripe right now. Reference what they captured, not generic statements about their interests.
- next_step: ONE concrete first action they could do today or this week. Not "research X" or "make a plan" — a real first move (a phone call, a draft, a walk, a list of N specific things, an email to a specific kind of person).
- evidence: an array of 3-5 source items from the data above. Each item: { kind, source_id, label, date, excerpt }
   - kind ∈ ["memory", "list_item", "project", "project_dormant", "reading", "highlight", "todo", "suggestion", "idea_engine"]
   - source_id MUST match one of the ids you saw above (the bit after #)
   - label: a short human label ("voice note", "film list item", "dormant project: X", "highlight from Y")
   - date: the date shown above for that item
   - excerpt: the actual content text from the data (≤ 180 chars), verbatim where possible

RULES:
- Lean into cross-domain intersections. The interesting ideas live where two unrelated captures meet — a voice note about X plus a film they queued plus a dormant project about Y produces an idea none of those alone would suggest.
- A dormant project is a clue, not a constraint. The new idea can pick up its thread, remix it, or use its leftovers — but should not just re-propose finishing it as-is.
- The next_step must be doable in under an hour with no special equipment. If you can't picture them physically doing it, rewrite it.
- Every idea must cite at least 3 different evidence items, ideally spanning at least 2 different kinds (e.g. memory + list_item, not 3 memories).
- Imperative verbs are FINE. Time estimates are FINE. Concrete artefact nouns ("zine", "newsletter", "playlist", "walk", "interview", "shop", "device") are FINE.
- If you genuinely cannot find 3 grounded ideas, return fewer (1 or 2). Do not pad with weak ideas.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "ideas": [
    {
      "rank": 1,
      "title": "...",
      "pitch": "...",
      "why_now": "...",
      "next_step": "...",
      "evidence": [
        { "kind": "memory", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "..." }
      ]
    }
  ]
}`
}

interface RawIdea {
  rank?: number
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
  let payload: { ideas?: RawIdea[] }
  try {
    payload = JSON.parse(raw)
  } catch {
    // Sometimes the model wraps JSON in a fenced block despite the
    // response_mime_type. Strip and retry once.
    const stripped = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
    payload = JSON.parse(stripped)
  }
  if (!payload?.ideas || !Array.isArray(payload.ideas)) return []

  const knownIds = collectKnownIds(gathered)

  const out: ProjectIdea[] = []
  let nextRank = 1
  for (const item of payload.ideas) {
    if (!item.title || !item.pitch || !item.next_step || !item.why_now) continue
    if (!Array.isArray(item.evidence)) continue

    const evidence: IdeaEvidence[] = []
    for (const e of item.evidence) {
      if (!e.kind || !e.source_id || !VALID_KINDS.has(e.kind)) continue
      // Drop fabricated ids — only keep evidence whose source_id matches
      // something we actually showed the model.
      if (!knownIds.has(e.source_id)) continue
      evidence.push({
        kind: e.kind as IdeaEvidence['kind'],
        source_id: e.source_id,
        label: (e.label ?? '').slice(0, 120) || labelForKind(e.kind),
        date: (e.date ?? '').slice(0, 32),
        excerpt: (e.excerpt ?? '').slice(0, 220),
      })
    }
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

  // Sort by rank then renumber 1..N to keep ranks contiguous.
  out.sort((a, b) => a.rank - b.rank)
  return out.map((idea, i) => ({ ...idea, rank: i + 1 }))
}

function collectKnownIds(g: GatherResult): Set<string> {
  const ids = new Set<string>()
  for (const m of g.memories) ids.add(m.id)
  for (const li of g.list_items) ids.add(li.id)
  for (const p of g.active_projects) ids.add(p.id)
  for (const p of g.dormant_projects) ids.add(p.id)
  for (const r of g.reading) ids.add(r.id)
  for (const h of g.highlights) ids.add(h.id)
  for (const t of g.todos) ids.add(t.id)
  for (const s of g.prior_suggestions) ids.add(s.id)
  for (const i of g.ie_ideas) ids.add(i.id)
  return ids
}

function labelForKind(kind: string): string {
  switch (kind) {
    case 'memory': return 'voice note'
    case 'list_item': return 'list item'
    case 'project': return 'project'
    case 'project_dormant': return 'dormant project'
    case 'reading': return 'article'
    case 'highlight': return 'highlight'
    case 'todo': return 'todo'
    case 'suggestion': return 'suggestion'
    case 'idea_engine': return 'idea-engine entry'
    default: return kind
  }
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
