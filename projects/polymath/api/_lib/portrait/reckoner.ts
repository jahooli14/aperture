/**
 * Portrait reckoner — grades a sealed prediction against the week of
 * corpus that followed it. Cron-only (06:00 UTC daily); the result lands
 * in `portrait_reckonings` and feeds the calibration badge.
 *
 * The prediction is plain-language and may be partially true. The
 * reckoner returns hit/partial/miss + one-line evidence drawn from the
 * actual corpus, never invented. Score is derived server-side from the
 * verdict (hit=1, partial=0.5, miss=0).
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import { PLAIN_ENGLISH_RULES } from '../plain-english.js'
import type { WeeklyCorpus } from './gather-week.js'
import type { ReckonerOutput, ReckonCall } from './types.js'

export async function reckonPrediction(
  prediction: string,
  corpus: WeeklyCorpus,
): Promise<ReckonerOutput | null> {
  const prompt = buildPrompt(prediction, corpus)
  const raw = await generateText(prompt, {
    model: MODELS.FLASH_CHAT,
    temperature: 0.2,  // low — this is judgement, not voice
    maxTokens: 400,
    responseFormat: 'json',
  })

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[portrait/reckoner] non-JSON response:', raw.slice(0, 200))
    return null
  }

  const called = String(parsed?.called ?? '').toLowerCase() as ReckonCall
  if (called !== 'hit' && called !== 'partial' && called !== 'miss') {
    console.warn('[portrait/reckoner] invalid called value:', parsed?.called)
    return null
  }
  const evidence = typeof parsed?.evidence === 'string' ? parsed.evidence.trim() : ''
  if (!evidence) {
    console.warn('[portrait/reckoner] missing evidence string')
    return null
  }

  return { called, evidence }
}

export function scoreForCall(called: ReckonCall): number {
  switch (called) {
    case 'hit': return 1
    case 'partial': return 0.5
    case 'miss': return 0
  }
}

function buildPrompt(prediction: string, corpus: WeeklyCorpus): string {
  return `${PLAIN_ENGLISH_RULES}

You're grading a prediction the harness made last week, against what actually happened in the user's corpus this week. Be strict but fair. If a prediction was multi-part and some parts landed, mark it "partial". Only "hit" if everything in the prediction actually happened.

THE PREDICTION (made last week):
"${prediction}"

WHAT ACTUALLY HAPPENED THIS WEEK:

${serializeForReckon(corpus)}

TASK:
1. Decide: hit, partial, or miss.
   - "hit": every claim in the prediction is borne out by the corpus.
   - "partial": some claims landed, some didn't, or the right thing happened in a different form.
   - "miss": nothing in the prediction matches what actually happened.
2. Write one short sentence of evidence drawn from the corpus above. Concrete. Cite what you saw (or didn't see). Don't editorialise.

GOOD evidence: "Analogue opened Tuesday and Friday, no writing either time. Playlist abandoned by Wednesday. Mother not mentioned."
BAD evidence: "The user partially fulfilled the prediction's intent."

Return ONLY JSON, no markdown:
{
  "called": "hit" | "partial" | "miss",
  "evidence": "string"
}`
}

function serializeForReckon(c: WeeklyCorpus): string {
  const blocks: string[] = []

  if (c.memories.length > 0) {
    const lines = c.memories.slice(0, 25).map(m => {
      const body = m.body.length > 200 ? m.body.slice(0, 197) + '…' : m.body
      return `- ${dayLabel(m.created_at)}: ${body}`
    })
    blocks.push(`VOICE NOTES (${c.memories.length}):\n${lines.join('\n')}`)
  } else {
    blocks.push('VOICE NOTES: (none captured this week)')
  }

  if (c.list_items.length > 0) {
    const lines = c.list_items.slice(0, 30).map(li =>
      `- ${li.list_type}${li.list_title ? ` (${li.list_title})` : ''} · ${dayLabel(li.created_at)}: ${li.content}`
    )
    blocks.push(`LIST ITEMS ADDED:\n${lines.join('\n')}`)
  } else {
    blocks.push('LIST ITEMS: (none added)')
  }

  if (c.project_events.length > 0) {
    const lines = c.project_events.slice(0, 15).map(p => `- ${p.project_title}: ${p.detail}`)
    blocks.push(`PROJECTS TOUCHED:\n${lines.join('\n')}`)
  } else {
    blocks.push('PROJECTS: (none touched)')
  }

  if (c.reading.length > 0) {
    const lines = c.reading.slice(0, 15).map(r => `- ${r.source ?? 'unknown'}: ${r.title ?? '(untitled)'}`)
    blocks.push(`READING ADDED:\n${lines.join('\n')}`)
  }

  if (c.highlights.length > 0) {
    const lines = c.highlights.slice(0, 10).map(h => {
      const q = h.quote.length > 160 ? h.quote.slice(0, 157) + '…' : h.quote
      return `- "${q}"`
    })
    blocks.push(`HIGHLIGHTS:\n${lines.join('\n')}`)
  }

  return blocks.join('\n\n')
}

function dayLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
  } catch {
    return iso.slice(0, 10)
  }
}
