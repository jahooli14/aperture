/**
 * Noticer — proposes candidate noticings.
 *
 * Reads recent captures (last ~30 days) against the Historian's sketch, and
 * outputs 3–6 candidate noticings ranked by how strong the read is. The
 * Noticer is opinionated: it deliberately ignores the obvious. Three voice
 * notes that are explicitly about the same topic is a summary, not a
 * noticing — it earns nothing by being seen.
 *
 * Two valid candidate shapes:
 *   - observation: "you keep returning to X" / "the notes get longer each
 *     time" / "you said this on Tuesday and this yesterday and they're the
 *     same thing arriving"
 *   - commission: a project-shaped recognition. "There's a thing here. Only
 *     you could make it. It looks like this." Permitted only when the
 *     evidence genuinely names something (not a vague life-coaching prompt).
 *
 * The Noticer hands the Writer a *seed* (craft instructions) plus structured
 * evidence. The seed never reaches the user — the Writer rewrites in voice.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import type { HistorianSketch, NoticerCandidate, Signal } from './types.js'

interface NoticerInput {
  signals: Signal[]
  sketch: HistorianSketch | null
  excludeKeys: Set<string>
  critique?: string
}

const RECENT_DAYS = 30

export async function proposeCandidates({
  signals,
  sketch,
  excludeKeys,
  critique,
}: NoticerInput): Promise<NoticerCandidate[]> {
  const recent = signals
    .filter(s => daysAgo(s.effective_date) <= RECENT_DAYS)
    .filter(s => !excludeKeys.has(`${s.kind}:${s.id}`))
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
    .slice(0, 60)

  // Older anchors are useful for evolution / obsession reads.
  const older = signals
    .filter(s => daysAgo(s.effective_date) > RECENT_DAYS)
    .filter(s => !excludeKeys.has(`${s.kind}:${s.id}`))
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
    .slice(0, 30)

  if (recent.length === 0 && older.length === 0) return []

  const prompt = buildNoticerPrompt(recent, older, sketch, critique)

  let raw: string
  try {
    raw = await generateText(prompt, {
      maxTokens: 3000,
      temperature: 0.6,
      responseFormat: 'json',
      model: MODELS.FLASH_CHAT,
    })
  } catch (err) {
    console.warn('[noticing/noticer] generation failed:', err)
    return []
  }

  return parseCandidates(raw)
}

function buildNoticerPrompt(
  recent: Signal[],
  older: Signal[],
  sketch: HistorianSketch | null,
  critique?: string,
): string {
  const recentBlock = recent.map(s => formatSignal(s)).join('\n')
  const olderBlock = older.length > 0
    ? `\n\n=== EARLIER CAPTURES (over a month old — use as anchor for evolution / obsession reads only) ===\n${older.map(s => formatSignal(s)).join('\n')}`
    : ''

  const sketchBlock = sketch
    ? formatSketch(sketch)
    : '(no sketch — base your candidates on captures alone.)'

  const critiqueBlock = critique
    ? `\n\nUSER PUSHED BACK ON THE LAST READ: "${critique}"\nDon't repeat the same shape. Find a different angle, a different juxtaposition, or a different time window.`
    : ''

  return `You are the second of three agents on Polymath's witness surface. Your job: propose 3–6 candidate noticings.

A "noticing" is two or three short sentences a third agent (the Writer) will turn into prose for the user. The Writer's voice is short, factual, and never instructional. Your seed text is craft input for the Writer — it never reaches the user. Be honest and structural in your seed; don't write final copy.

## What makes a strong candidate

A strong noticing makes the user go "oh." It does this by holding a through-line they have not consciously put together themselves. There are TWO valid shapes:

OBSERVATION — pure pattern recognition. The system, having read everything, surfaces a pattern the user is too close to see. Examples in seed-form:
  - "User has mentioned wanting to make something with their hands FOUR times in six weeks; the notes get longer each time. The kiln-rental list item is 19 days old. Tuesday's walk note about AI feeling hollow without craft sits inside this same shape."
  - "User has said three different things about [friend's name]'s grief in the last three weeks, never to her, each note longer than the last. They are working something out on her behalf."
  - "Two unrelated voice notes from the last 9 days share a specific phrase the user keeps coming back to without realising."

COMMISSION — project-shaped recognition. The system names a thing only the user could make, given the specific intersection visible in their captures. NOT a generic productivity tip. Examples in seed-form:
  - "Three signals point to the same possible project: their friend's vintage camera collection + their dormant Pupils project + their list 'things to make for my daughter when she's older'. The unspoken project is a small physical book of camera images for the daughter, made with the friend. Only the user could make this — they have all three relationships."
  - "User keeps describing a tool that already exists in three different lights. They are not building a tool, they are writing an essay. The essay is the project."

A commission is permitted ONLY when the evidence genuinely converges on something specific and personal. "You should make a podcast about your interests" is a commission failure — it's a horoscope. "Your last three project descriptions all start by saying what's wrong with the existing thing — the project might be the critique itself, not the alternative" is a real commission.

## What to avoid

- Do NOT propose "spend 30 minutes on X" — the Writer is forbidden from action verbs. The seed should not even imply chores.
- Do NOT cluster things that explicitly say the same thing — that's a summary. Look for non-obvious juxtapositions, recurring shapes the user hasn't named, dormant strands acting on the present.
- Do NOT recommend things in the recurring-shapes list verbatim — those are inputs, not outputs. A good noticing puts a recurring shape next to a recent specific capture and says something more pointed than the shape alone.
- Do NOT invent. If you reference a person, project, or fact, it must be in the captures or the sketch. If you cannot ground a candidate in at least 2 evidence items, drop it.
- Skip if there is no real noticing to make. 0 candidates is acceptable. A weak noticing is worse than silence.

## Output

Output JSON only, no prose, this exact shape:
{
  "candidates": [
    {
      "shape": "observation" | "commission",
      "seed": "Plain factual paragraph for the Writer. Name the through-line. Quote 2–4 short fragments from the evidence verbatim. Say WHY this is interesting (e.g. 'recurring 4 times', 'spans 6 weeks', 'commission: only this user could make this because A + B + C'). 60–140 words.",
      "evidence": [
        { "kind": "memory|list_item|project", "source_id": "...", "label": "voice note | list item | project · X", "date": "ISO date from the capture", "excerpt": "verbatim 6–18 word fragment" }, ...
      ],
      "rank": 0.0
    }
  ]
}

Rank each candidate 0–1 on overall strength. Order by rank, strongest first.${critiqueBlock}

=== HISTORIAN SKETCH ===
${sketchBlock}

=== RECENT CAPTURES (last ~30 days, newest first) ===
${recentBlock}${olderBlock}

Return the JSON now.`
}

function formatSketch(sketch: HistorianSketch): string {
  const shapes = sketch.recurring_shapes.length === 0
    ? '(none)'
    : sketch.recurring_shapes.slice(0, 8).map(s =>
        `- "${s.name}" (${s.evidence.length} captures, ${formatRange(s.first_seen, s.last_seen)})`,
      ).join('\n')

  const dormant = sketch.dormant_projects.length === 0
    ? '(none)'
    : sketch.dormant_projects.slice(0, 8).map(p =>
        `- "${p.title}" — last touched ${daysAgo(p.last_touched)}d ago — ${p.note}`,
      ).join('\n')

  const people = sketch.returning_people.length === 0
    ? '(none)'
    : sketch.returning_people.slice(0, 8).map(p =>
        `- ${p.name} (×${p.times_mentioned}) — ${p.context}`,
      ).join('\n')

  const facts = sketch.life_stage_facts.length === 0
    ? '(none)'
    : sketch.life_stage_facts.slice(0, 8).map(f => `- ${f}`).join('\n')

  return `RECURRING SHAPES:
${shapes}

DORMANT PROJECTS:
${dormant}

RETURNING PEOPLE:
${people}

LIFE-STAGE FACTS:
${facts}`
}

function formatSignal(s: Signal): string {
  const days = daysAgo(s.effective_date)
  const body = s.text.replace(/\s+/g, ' ').slice(0, 360).trim()
  const head = `[${days}d] ${s.source_label} :: ${s.kind}:${s.id}`
  return `${head}\n  ${body}`
}

function formatRange(firstISO: string, lastISO: string): string {
  const first = daysAgo(firstISO)
  const last = daysAgo(lastISO)
  if (first === last) return `${first}d ago`
  return `${first}d → ${last}d ago`
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)))
}

function parseCandidates(raw: string): NoticerCandidate[] {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const obj = JSON.parse(cleaned) as { candidates?: unknown }
    if (!Array.isArray(obj.candidates)) return []
    const out: NoticerCandidate[] = []
    for (const c of obj.candidates) {
      const candidate = c as Partial<NoticerCandidate>
      if (!candidate || typeof candidate !== 'object') continue
      if (candidate.shape !== 'observation' && candidate.shape !== 'commission') continue
      if (typeof candidate.seed !== 'string' || candidate.seed.trim().length < 20) continue
      if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) continue
      const evidence = candidate.evidence
        .filter((e): e is NoticerCandidate['evidence'][number] =>
          !!e &&
          typeof (e as { kind?: string }).kind === 'string' &&
          typeof (e as { source_id?: string }).source_id === 'string' &&
          typeof (e as { excerpt?: string }).excerpt === 'string',
        )
      if (evidence.length === 0) continue
      out.push({
        shape: candidate.shape,
        seed: candidate.seed.trim(),
        evidence,
        rank: typeof candidate.rank === 'number' ? candidate.rank : 0.5,
      })
    }
    out.sort((a, b) => b.rank - a.rank)
    return out
  } catch (err) {
    console.warn('[noticing/noticer] parse failed:', err, 'head:', raw.slice(0, 200))
    return []
  }
}
