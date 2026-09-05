/**
 * The briefing — your own exit note, turned into this session's path.
 *
 * The plain path takes the next open steps verbatim, in stored order. That
 * is honest, and it is also colder than it needs to be: the last thing you
 * said at the end of a session is almost always the most precise statement
 * of what comes next that exists anywhere in the corpus ("next up is the
 * verse two vocal, it's flat"), and it was being shown as a quote above a
 * list that had been built without reading it.
 *
 * So this is the reshape path with your own exit note as the instruction.
 * Every rule that makes reshape safe applies here unchanged:
 *
 *   - every item cites a step already on the project, resolved back to a
 *     REAL task id (filterGrounded + taskIdByEvidenceId), so a tick still
 *     marks the right task done however the wording moved
 *   - nothing may be invented -- no step that isn't already on the list,
 *     no tool, brand or number that isn't in the evidence
 *   - a step reworded rather than repeated verbatim is marked `partial`
 *     the same way reshape marks one, so ticking it records progress
 *     rather than claiming the whole step
 *
 * What it may do that the verbatim path cannot: order the session the way
 * the exit note says to, say the step in the words you used at the time,
 * and start on the piece of a step you actually stopped mid-way through.
 *
 * Null on any failure -- the caller then falls through to the verbatim
 * path, which is what ships today. A briefing is an improvement on a real
 * list, never a replacement for having one.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES, CLEAR_STEP_RULES } from './plain-english.js'
import { filterGrounded, evidenceHaystack, type Evidence, type GroundedItem } from './session-grounding.js'
import { sanitizeRawItems, dedupeSimilar } from './session-items.js'
import { reasoningLicence, type Confidence } from './session-confidence.js'
import { doneLineForSteps, sanitizeDoneLooksLike } from './session-split.js'
import type { FrictionLine } from './session-shaper.js'

/** Below this there isn't an exit note, there's an acknowledgement. "Done."
 *  and "good session" say nothing about what comes next, and building a
 *  whole session path on them would be inventing one. */
const MIN_USEFUL_EXIT_NOTE = 25

export function isUsableExitNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.trim().length >= MIN_USEFUL_EXIT_NOTE
}

export interface BriefingInput {
  title: string
  /** The last close-out, in the user's own words. The spine. */
  exitNote: string
  /** Open steps in plan order -- the closed set the briefing may draw on. */
  openSteps: { id: string; text: string }[]
  windowMinutes: number | null
  /** itemCountForWindow's ceiling for this window. */
  maxItems: number
  evidence: Evidence[]
  taskIdByEvidenceId: Record<string, string>
  confidence: Confidence
  /** What this project has already been observed to need before you can
   *  start and after you stop. Passed in when known so the model confirms
   *  rather than re-invents it every session. */
  knownSetup: FrictionLine | null
  knownPackdown: FrictionLine | null
}

export interface BriefingResult {
  items: GroundedItem[]
  doneLooksLike: string | null
  /** Raw, unsanitized -- the caller owns the evidence and the title, so it
   *  runs these through sanitizeFriction rather than this module
   *  reaching back into the shaper for them. */
  rawSetup: unknown
  rawPackdown: unknown
}

export function buildBriefingPrompt(input: BriefingInput): string {
  const { title, exitNote, windowMinutes, maxItems, evidence, confidence, knownSetup, knownPackdown } = input
  const windowText = windowMinutes
    ? `${windowMinutes} minutes`
    : 'an unknown amount of time — assume about an hour'

  return `Someone is sitting down to work on "${title}". They have ${windowText}.

EVERYTHING KNOWN ABOUT THIS PROJECT:
${evidence.map(e => `[${e.id}] ${e.text}`).join('\n')}

That list is the whole of it. Anything not in it, you do not know.
The entries marked "already on the project" are its steps, in the order
they're meant to be done.

${reasoningLicence(confidence)}

THE LAST THING THEY SAID, walking away from this project last time:
"${exitNote}"

That sentence is the most current, most precise thing anyone knows about
what comes next. Build this session around it.

At MOST ${maxItems} items, in the order they should be done. The first
item is what they start on the moment they sit down.

${maxItems} is a ceiling, not a target. Fewer is better. Two or three real
steps that genuinely fill ${windowText} beat five that were never going to
fit — under-reach when unsure. Stopping early having finished something is
a good session; running out of time three items in is not.

What you may do:
- Put the steps in the order the exit note says to do them, rather than
  the order they happen to be stored in.
- Say a step in the words they used in the exit note, when those words
  are more specific than the stored step ("re-record verse two" beats
  "work on the vocals").
- Start on the piece of a step they stopped part-way through, when the
  exit note says where they got to.
- Leave a step off this session when the exit note plainly points
  somewhere else first. It stays on the project.

What you may not do:
- Invent a step. Every item is one of the steps above, cited by its
  evidence id. If you can't cite it, you can't say it.
- Put a step before one it plainly depends on. "Peel the stencil off"
  cannot come before "cut the stencil".
- Name a tool, brand, format, setting, person or place that isn't word
  for word in the evidence above.
- Admin dressed as building: research, plan, outline, decide, list,
  consider, review, think about, set up, brainstorm, explore. If the exit
  note used one of those words, that's the INTENT -- turn it into the
  concrete action it implies ("plan the riff" -> "try a few ideas for the
  riff").
- Repeat something the evidence says is already finished.
- Two items that say the same thing in different words.
- One line each. No sub-bullets, no time estimates, no explanation.

Also say, in one plain sentence, what exists at the end of the session if
the list lands ("done_looks_like").

SETTING UP AND CLEARING AWAY. Some projects can't be started cold and
can't be walked away from: paint has to be got out and brushes have to be
washed. That time is spent inside ${windowText}, so it has to be named
rather than discovered at the end.
${knownSetup ? `\nThis project is already known to need: "${knownSetup.text}" (${knownSetup.minutes} min) before starting. Repeat it unless the evidence says otherwise.` : ''}${knownPackdown ? `\nAnd afterwards: "${knownPackdown.text}" (${knownPackdown.minutes} min). Repeat it unless the evidence says otherwise.` : ''}

Only name a setup ("setup") or a clearing-away ("packdown") that the
evidence above actually supports, with rough minutes. Most projects need
neither — null for both is the common answer, and an invented setup step
is worse than none. Never count thinking, deciding or "getting in the
zone" as setup: it has to be a physical thing with a physical result.

${PLAIN_ENGLISH_RULES}

${CLEAR_STEP_RULES}

Say the exit note is "got the uprights cut, need to glue them before the
split gets worse" and [e4] is "already on the project: glue and clamp the
uprights", [e5] is "already on the project: sand the front edges".
  BAD:  "Sand the front edges" first — the exit note is plainly telling
        you the glue is urgent, and this ignores it.
  BAD:  "Pick up a bottle of Titebond III" — no glue brand appears
        anywhere above.
  GOOD: "Glue and clamp the two uprights" citing [e4], then "Sand the
        front edges while the glue sets" citing [e5] — their own order,
        their own reason.

Respond with JSON only:
{
  "items": [ { "text": "...", "evidence": ["e4"] } ],
  "done_looks_like": "...",
  "setup": { "text": "...", "minutes": 10 } | null,
  "packdown": { "text": "...", "minutes": 10 } | null
}`
}

/**
 * Null rather than a half-built session: too few grounded items back means
 * the model didn't work from the real list, and the verbatim path is a
 * better answer than a thin one.
 */
export async function briefSession(input: BriefingInput): Promise<BriefingResult | null> {
  if (input.openSteps.length === 0 || !isUsableExitNote(input.exitNote)) return null
  try {
    const response = await generateText(buildBriefingPrompt(input), {
      model: MODELS.SESSION_SHAPE_CHAT,
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 1400,
      // Ordering and rewording against a closed list, not open-ended
      // prose. Uncapped, a thinking model can spend the whole token
      // budget reasoning and leave nothing to parse.
      thinkingLevel: 'low',
    })
    const parsed = JSON.parse(response)
    const cleaned = sanitizeRawItems(parsed?.items, input.maxItems)
    const { kept, rejected } = filterGrounded(cleaned, input.evidence, input.title, input.taskIdByEvidenceId)
    if (rejected.length > 0) {
      console.warn(`[session-briefing] dropped ${rejected.length} ungrounded item(s) for "${input.title}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }

    // An item with no taskId didn't come from a real step, whatever it
    // cited -- the briefing's whole promise is that it's the project's own
    // list, reordered and reworded. Anything else is the invention this
    // path exists to avoid.
    const stepText = new Map(input.openSteps.map(s => [s.id, s.text.toLowerCase().trim()]))
    const items = dedupeSimilar(kept)
      .filter(k => !!k.taskId && stepText.has(k.taskId))
      .map(k => ({
        ...k,
        partial: stepText.get(k.taskId as string) !== k.text.toLowerCase().trim(),
      }))

    if (items.length === 0) return null

    const haystack = evidenceHaystack(input.evidence, input.title)
    return {
      items,
      doneLooksLike: sanitizeDoneLooksLike(parsed?.done_looks_like, haystack) ?? doneLineForSteps(items),
      rawSetup: parsed?.setup ?? null,
      rawPackdown: parsed?.packdown ?? null,
    }
  } catch (e) {
    console.error('[session-briefing] failed, falling back to the plain list:', e)
    return null
  }
}
