/**
 * Writer — turns one Noticer candidate into 2–3 short user-facing sentences.
 *
 * The voice is the whole job. Bad writing kills magical insight, no matter
 * how strong the read is. The Writer is short, factual, and never
 * instructional. The shape that earns its keep:
 *
 *   fact. fact. third sentence that makes the first two mean something
 *   together.
 *
 * Sometimes a question. Never an instruction. Dates carry weight.
 *
 * The Writer has a veto loop: if its output trips the deterministic
 * forbidden-shapes filter, the orchestrator asks for another draft (up to
 * a cap), then moves to the next candidate. Silence is acceptable.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import { findForbiddenShape, forbiddenShapesPromptBlock } from './forbidden-shapes.js'
import type { NoticerCandidate } from './types.js'

const MAX_WRITER_RETRIES = 2

export interface WriterResult {
  lines: string[]
  attempts: number
  rejected: Array<{ lines: string[]; reason: string }>
}

export async function writeNoticing(
  candidate: NoticerCandidate,
): Promise<WriterResult | null> {
  const rejected: Array<{ lines: string[]; reason: string }> = []
  let lastDraft: string[] | null = null

  for (let attempt = 0; attempt <= MAX_WRITER_RETRIES; attempt++) {
    const prompt = buildWriterPrompt(candidate, rejected, attempt)
    let raw: string
    try {
      raw = await generateText(prompt, {
        maxTokens: 600,
        // Slightly lower on retry — push toward the safe register.
        temperature: attempt === 0 ? 0.6 : 0.4,
        responseFormat: 'json',
        model: MODELS.FLASH_CHAT,
      })
    } catch (err) {
      console.warn('[noticing/writer] generation failed:', err)
      return null
    }

    const lines = parseLines(raw)
    if (!lines) {
      rejected.push({ lines: [], reason: 'unparseable JSON' })
      continue
    }
    lastDraft = lines

    if (lines.length < 2 || lines.length > 3) {
      rejected.push({ lines, reason: `wrong line count: ${lines.length}` })
      continue
    }
    if (lines.some(l => l.trim().length === 0)) {
      rejected.push({ lines, reason: 'empty line' })
      continue
    }
    if (lines.some(l => l.trim().length > 180)) {
      rejected.push({ lines, reason: 'line too long' })
      continue
    }

    const violation = findForbiddenShape(lines)
    if (violation) {
      console.warn(`[noticing/writer] rejected (${violation.rule}: "${violation.hit}"): "${violation.line}"`)
      rejected.push({ lines, reason: `${violation.rule}: ${violation.hit}` })
      continue
    }

    return { lines, attempts: attempt + 1, rejected }
  }

  console.warn('[noticing/writer] exhausted retries; last draft:', lastDraft)
  return null
}

function buildWriterPrompt(
  candidate: NoticerCandidate,
  rejected: Array<{ lines: string[]; reason: string }>,
  attempt: number,
): string {
  const evidenceBlock = candidate.evidence
    .map(e => `- ${e.label} · ${formatDateLine(e.date)} :: "${e.excerpt}"`)
    .join('\n')

  const rejectedBlock = rejected.length > 0
    ? `\n\n=== REJECTED DRAFTS ===\nThese previous drafts were rejected. Do not repeat the same shape.\n${rejected.map((r, i) => `${i + 1}. (${r.reason})\n   ${r.lines.map(l => `> ${l}`).join('\n   ')}`).join('\n\n')}\n`
    : ''

  // First-attempt prompt is the full register lesson; retry prompts get
  // tighter and call out the specific failure mode.
  const retryNudge = attempt === 0
    ? ''
    : `\n\nThis is retry #${attempt}. The previous draft drifted. Cut every word that smells of an instruction or a deliverable. Shorter is better. If you cannot avoid the forbidden shapes, return null.`

  return `You are the third agent on Polymath's witness surface. Your only job is voice. Take the seed below and turn it into 2 or 3 short sentences for the user. The user reads them on their home screen. There is no CTA. There is no follow-up. The sentences sit there.

## The voice

The voice is a witness, not an advisor. A friend who has been listening, holding your through-line for a moment, handing it back. A great therapist noticing what you have been circling without naming. A grandparent saying "I always thought you'd end up doing X."

Three properties:
1. RIGHT ALTITUDE. Calling, not chore. The user is the agent — you observe and offer, never instruct.
2. TEMPORAL DEPTH. Dates earn their place. "Three weeks ago", "the Tuesday walk note", "nineteen days old" — these are the kinds of references that carry weight. Use them when the seed mentions them. Do not invent dates.
3. UNDER-CLAIM. State the facts. Let the juxtaposition do the work. Trust the reader. The third sentence is the whole craft — it makes the first two mean something together, OR it asks a question that survives being printed on a postcard.

## The shape

Two or three sentences. Each sentence stands alone — no semicolons stitching half-thoughts. The shape that almost always works:

  Fact. Fact. Third sentence that connects them.

Or:

  Long-running pattern. Recent specific capture. The rearrangement.

Examples of the right voice (NOT to copy, just to feel):

> Your friend collects vintage cameras. You haven't asked her about them. Pupils is a camera project.

> Four times in the last six weeks you've said you want to make something with your hands. On Tuesday you said the AI tools feel hollow without craft. The kiln-rental note has been sitting in your list for nineteen days.

> You started "things to make for my daughter when she's older" in February. The kiln, the camera friend, the hollow-without-craft note — these belong on that list.

> The Tuesday walk note about AI feeling hollow without craft is the same thought as the kiln note from three weeks ago. You arrived at it twice, from different angles. That usually means it's real.

## Constraints

${forbiddenShapesPromptBlock()}

If you cannot write the noticing without one of these shapes, output { "lines": null }. Silence is correct. Bad writing is wrong.

Use the user's own words from the evidence where possible. Do not paraphrase a quoted excerpt — quote it or don't.${retryNudge}

## Output

JSON only, this exact shape:
{ "lines": ["...", "...", "..."] }     // 2 or 3 sentences
or { "lines": null }                    // if you cannot write it cleanly

=== SEED FROM THE NOTICER (craft input — do NOT pass through verbatim) ===
${candidate.seed}

=== EVIDENCE (verbatim — quote or don't, don't paraphrase) ===
${evidenceBlock}${rejectedBlock}

Return the JSON now.`
}

function parseLines(raw: string): string[] | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const obj = JSON.parse(cleaned) as { lines?: unknown }
    if (obj.lines === null) return null
    if (!Array.isArray(obj.lines)) return null
    const lines = obj.lines.filter((l): l is string => typeof l === 'string').map(l => l.trim())
    return lines.length > 0 ? lines : null
  } catch {
    return null
  }
}

function formatDateLine(iso: string): string {
  try {
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)))
    if (days <= 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 14) return 'last week'
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`
    const months = Math.floor(days / 30)
    return months === 1 ? 'a month ago' : `${months} months ago`
  } catch {
    return 'recently'
  }
}
