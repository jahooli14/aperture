/**
 * Portrait generator — single Gemini Flash call. Pulls the weekly corpus,
 * writes the "this week" prose, returns evidence refs and a falsifiable
 * prediction for next week.
 *
 * The slice-1 contract (see docs/PORTRAIT_SPEC.md): one body, one
 * prediction, evidence flat at the bottom. Sentence-level tap-targets
 * come in slice 2 once the prediction loop has earned its place.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import { PLAIN_ENGLISH_RULES, findVoiceViolations } from '../plain-english.js'
import { countSignals, type WeeklyCorpus } from './gather-week.js'
import type { GeneratorOutput, EvidenceRef, EvidenceKind } from './types.js'

const MIN_SIGNALS = 3

export interface GenerateOptions {
  /** The prior un-reckoned prediction, if any. Folded into the prompt so
   *  the model can quietly write toward whether it landed — without
   *  scoring it (the reckoner does that, separately, after the week is
   *  over). */
  prior_prediction?: string | null
}

/**
 * Writes the portrait for "this week" against the gathered corpus.
 * Returns null when there isn't enough signal — the caller surfaces an
 * empty state ("capture a few thoughts and try again").
 */
export async function generatePortrait(
  corpus: WeeklyCorpus,
  opts: GenerateOptions = {},
): Promise<GeneratorOutput | null> {
  if (countSignals(corpus) < MIN_SIGNALS) {
    return null
  }

  const prompt = buildPrompt(corpus, opts.prior_prediction ?? null)
  const raw = await generateText(prompt, {
    model: MODELS.FLASH_CHAT,
    temperature: 0.55,
    maxTokens: 1600,
    responseFormat: 'json',
  })

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[portrait/generator] non-JSON response:', raw.slice(0, 200))
    return null
  }

  const body = typeof parsed?.body === 'string' ? parsed.body.trim() : ''
  const next_prediction = typeof parsed?.next_prediction === 'string' ? parsed.next_prediction.trim() : ''

  if (!body || !next_prediction) {
    console.warn('[portrait/generator] missing body or next_prediction in:', Object.keys(parsed ?? {}))
    return null
  }

  // Voice gate. The model drifts to analyst-speak under load; one retry
  // with a sharper reminder is cheaper than shipping a bad portrait.
  const violations = findVoiceViolations(body)
  if (violations.length > 0) {
    console.warn('[portrait/generator] voice violations on first pass:', violations)
    const sharpened = `${prompt}\n\nYour previous output used banned voice. Specifically: ${violations.join(', ')}. Rewrite. Plain English. Concrete nouns. No analyst gloss.`
    const retry = await generateText(sharpened, {
      model: MODELS.FLASH_CHAT,
      temperature: 0.4,
      maxTokens: 1600,
      responseFormat: 'json',
    })
    try {
      const reparsed = JSON.parse(retry)
      if (reparsed?.body && reparsed?.next_prediction) {
        return shapeOutput(reparsed, corpus)
      }
    } catch {
      // fall through with the original
    }
  }

  return shapeOutput(parsed, corpus)
}

/**
 * Validates and reshapes the model's evidence_refs to the canonical
 * EvidenceRef shape — the model emits source ids and labels, we
 * cross-check against the gathered corpus to fill in snippets the
 * model truncated and to drop refs whose source_id doesn't exist.
 */
function shapeOutput(parsed: any, corpus: WeeklyCorpus): GeneratorOutput {
  const sources = buildSourceIndex(corpus)
  const refs: EvidenceRef[] = []

  for (const raw of (parsed.evidence_refs ?? []) as any[]) {
    const kind = String(raw?.kind ?? '') as EvidenceKind
    const source_id = String(raw?.source_id ?? '')
    const source = sources.get(`${kind}:${source_id}`)
    if (!source) continue  // drop hallucinated refs
    refs.push({
      kind,
      source_id,
      label: source.label,
      snippet: source.snippet,
      occurred_at: source.occurred_at,
    })
  }

  return {
    body: String(parsed.body).trim(),
    evidence_refs: refs,
    next_prediction: String(parsed.next_prediction).trim(),
  }
}

interface SourceRecord {
  label: string
  snippet: string
  occurred_at: string | null
}

function buildSourceIndex(corpus: WeeklyCorpus): Map<string, SourceRecord> {
  const m = new Map<string, SourceRecord>()
  for (const x of corpus.memories) {
    m.set(`memory:${x.id}`, {
      label: x.title ? `voice note · ${x.title}` : 'voice note',
      snippet: truncate(x.body, 220),
      occurred_at: x.created_at,
    })
  }
  for (const x of corpus.list_items) {
    m.set(`list_item:${x.id}`, {
      label: x.list_title ? `${x.list_type} · ${x.list_title}` : x.list_type,
      snippet: truncate(x.content, 180),
      occurred_at: x.created_at,
    })
  }
  for (const x of corpus.project_events) {
    m.set(`project_event:${x.id}`, {
      label: x.project_title,
      snippet: x.detail,
      occurred_at: x.occurred_at,
    })
    // Also accept the underlying project_id as a 'project' kind so the
    // model can refer to either consistently.
    m.set(`project:${x.project_id}`, {
      label: x.project_title,
      snippet: x.detail,
      occurred_at: x.occurred_at,
    })
  }
  for (const x of corpus.reading) {
    m.set(`reading:${x.id}`, {
      label: x.source ? `article · ${x.source}` : 'article',
      snippet: truncate(x.title || x.excerpt || '', 180),
      occurred_at: x.created_at,
    })
  }
  for (const x of corpus.highlights) {
    m.set(`highlight:${x.id}`, {
      label: x.article_title ? `highlight · ${x.article_title}` : 'highlight',
      snippet: truncate(x.quote, 220),
      occurred_at: x.created_at,
    })
  }
  return m
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

function buildPrompt(corpus: WeeklyCorpus, priorPrediction: string | null): string {
  const sections: string[] = []

  sections.push(serializeMemories(corpus))
  sections.push(serializeListItems(corpus))
  sections.push(serializeProjects(corpus))
  sections.push(serializeReading(corpus))
  sections.push(serializeHighlights(corpus))
  sections.push(serializeStatedPriorities(corpus))

  const corpusBlock = sections.filter(Boolean).join('\n\n')

  const priorBlock = priorPrediction
    ? `\nLAST WEEK, YOU PREDICTED:\n"${priorPrediction}"\n\nYou are NOT scoring this — that happens elsewhere. But your body should quietly reflect what actually happened versus what you said would.\n`
    : ''

  return `${PLAIN_ENGLISH_RULES}

You are writing a portrait of someone's creative week. They wrote everything below themselves. Your job is to look across it and tell them what you see — plainly, without flattery, without analyst voice.

VOICE RULES (non-negotiable):
- One idea per sentence.
- Concrete nouns over abstract ones. Name the project, name the film, name the day.
- No "this reveals", no "a recurring theme", no "what you couldn't see", no "narrative substrate".
- No "you've been on a journey toward…" — name the thing they did, not the arc.
- If you don't have enough to say plainly, write less.

BAD: "This week reveals a pattern of returning to longform work after a period of fragmentation, suggesting a deeper reconnection with the creative practice."
GOOD: "You opened Analogue twice and closed it both times inside ten minutes."

BAD: "Your engagement with cinema this week was meaningful and connected to your broader creative interests."
GOOD: "You queued Bicycle Thieves and La Notte. Neither sits on a recent capture. Both are slow."

THIS WEEK'S CORPUS:
${corpusBlock}
${priorBlock}
TASK:
1. Write the "this week" body. 150–350 words of prose. Honest, concrete, brief. Notice what they wrote, what they queued, what they touched in projects, what they highlighted, what they DIDN'T touch among their stated priorities. If the week was quiet, say so plainly.
2. Cite evidence: for each meaningful claim in the body, include an evidence_ref with the kind ("memory"|"list_item"|"project_event"|"project"|"reading"|"highlight") and the source_id from the corpus above. Don't invent ids.
3. Predict next week. One sentence. Falsifiable — name a behaviour, a count, or a project, with a timeframe inside next week. The reckoner needs to be able to mark this hit/partial/miss from next week's corpus alone. Examples:
   - "You'll capture at least one note about your father."
   - "You'll open Analogue once but not write."
   - "The Lisbon list will grow by at least two items."
   AVOID vague predictions like "you'll keep circling music" — those can't be reckoned.

Return ONLY JSON, no markdown, no preamble:
{
  "body": "string",
  "evidence_refs": [{"kind": "...", "source_id": "..."}, ...],
  "next_prediction": "string"
}`
}

// ── Corpus serialisers ────────────────────────────────────────────────
// Plain-text serialisation per surface. IDs are exposed so the model can
// cite them in evidence_refs; the wrapper passes them through to the UI.

function serializeMemories(c: WeeklyCorpus): string {
  if (c.memories.length === 0) return 'VOICE NOTES THIS WEEK: (none)'
  const lines = c.memories.slice(0, 30).map(m => {
    const body = m.body.length > 280 ? m.body.slice(0, 277) + '…' : m.body
    const themes = m.themes.length > 0 ? ` [themes: ${m.themes.slice(0, 4).join(', ')}]` : ''
    return `- id=${m.id} · ${dayLabel(m.created_at)}${themes}\n  ${body}`
  })
  return `VOICE NOTES THIS WEEK (${c.memories.length}):\n${lines.join('\n')}`
}

function serializeListItems(c: WeeklyCorpus): string {
  if (c.list_items.length === 0) return 'LIST ITEMS THIS WEEK: (none added)'
  const lines = c.list_items.slice(0, 40).map(li =>
    `- id=${li.id} · ${li.list_type}${li.list_title ? ` (${li.list_title})` : ''} · ${dayLabel(li.created_at)}: ${li.content}`
  )
  return `LIST ITEMS ADDED THIS WEEK:\n${lines.join('\n')}`
}

function serializeProjects(c: WeeklyCorpus): string {
  if (c.project_events.length === 0) return 'PROJECTS TOUCHED THIS WEEK: (none)'
  const lines = c.project_events.slice(0, 20).map(p =>
    `- id=${p.id} · project_id=${p.project_id} · ${p.project_title}: ${p.detail}`
  )
  return `PROJECTS TOUCHED THIS WEEK:\n${lines.join('\n')}`
}

function serializeReading(c: WeeklyCorpus): string {
  if (c.reading.length === 0) return 'READING ADDED THIS WEEK: (none)'
  const lines = c.reading.slice(0, 20).map(r =>
    `- id=${r.id} · ${r.source ?? 'unknown'} · ${r.title ?? '(untitled)'} [${r.status}]`
  )
  return `READING ADDED THIS WEEK:\n${lines.join('\n')}`
}

function serializeHighlights(c: WeeklyCorpus): string {
  if (c.highlights.length === 0) return 'HIGHLIGHTS THIS WEEK: (none)'
  const lines = c.highlights.slice(0, 15).map(h => {
    const q = h.quote.length > 200 ? h.quote.slice(0, 197) + '…' : h.quote
    return `- id=${h.id} · ${h.article_title ?? 'article'}: "${q}"`
  })
  return `HIGHLIGHTS THIS WEEK:\n${lines.join('\n')}`
}

function serializeStatedPriorities(c: WeeklyCorpus): string {
  if (c.stated_priorities.length === 0) return ''
  const lines = c.stated_priorities.map(p =>
    `- ${p.title} — ${p.touched_this_week ? 'touched this week' : 'NOT touched this week'}`
  )
  return `WHAT THEY SAID MATTERS (priority + favourites):\n${lines.join('\n')}`
}

function dayLabel(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
  } catch {
    return iso.slice(0, 10)
  }
}
