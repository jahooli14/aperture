/**
 * Turning what someone said into a whole project, in one call.
 *
 * The rule is EXTRACT, THEN ASK AT MOST ONE THING:
 *   1. The user says everything they know, in one go, however messy.
 *   2. This pulls the project out of it -- title, what it is, the labels,
 *      what done looks like IF they said, and the first steps in order.
 *   3. Only when there wasn't enough to plan a single step does it ask,
 *      and it asks one thing.
 *
 * One model call, not two. Extraction and the steps used to be separate
 * prompts (and the second only ran when a finish line had been found),
 * which made creation slow and left every open-ended project with an
 * empty list. The finish line is never asked for: an ongoing thing like
 * DJing has no "done", and forcing one meant rewriting it forever. When
 * done IS known the steps are planned backwards from it; when it isn't,
 * they're the first few moves forward from what the project is.
 *
 * Every step goes through the same grounding as a session item, against
 * the words the user actually said, and every stored task gets an order.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { normalizeTag } from './project-tags.js'
import { filterGrounded, type Evidence } from './session-grounding.js'
import { ESTIMATE_MINUTES } from './session-estimate.js'
import { sanitizeSteps, assembleSteps, MAX_SPINE_STEPS, FIRST_CUT_STEPS, type SpineStep } from './task-spine.js'

export interface ShapedProject {
  title: string
  /** What done looks like, in their words. Null unless they said. */
  endGoal: string | null
  /** One plain sentence on what this is. */
  summary: string
  tags: string[]
  /** The first steps, in the order they'd be done. Backwards from the
   *  finish line when there is one; the first moves forward when not. */
  steps: SpineStep[]
  /** The one question worth asking, only when no step could be made. */
  question: string | null
}

/**
 * The dump, cut into citable pieces. A voice note is one blob; the model
 * cites sentence ids, and the grounding pass checks each step against
 * the sentence it points at.
 */
export function evidenceFromDump(dump: string): Evidence[] {
  const pieces = dump
    .split(/\n+|(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 3)
    .slice(0, 40)
  return pieces.map((text, i) => ({ id: `e${i + 1}`, label: 'from what you said about it', text }))
}

export function buildShapingPrompt(dump: string, existingTags: string[], evidence: Evidence[] = evidenceFromDump(dump)): string {
  return `Someone just described a creative project they want to start. Pull the
project out of what they said, and give it its first steps. Do not ask
them anything; do not add anything they didn't say.

WHAT THEY SAID, numbered so you can cite it:
${evidence.map(e => `[${e.id}] ${e.text}`).join('\n')}

That is the whole of it. Anything not in it, you do not know.

${existingTags.length ? `Labels they already use on other projects (strongly prefer reusing one of these over inventing a near-synonym):\n${existingTags.join(', ')}\n` : ''}
Pull out:
- title: short, concrete, what they'd call it themselves. Not a slogan.
- summary: one plain sentence saying what this is.
- end_goal: what they'll have when it's finished, in their words. ONLY if
  they actually said or clearly implied it. If they didn't, use null --
  do not invent a finish line. An ongoing thing (DJing, a sketchbook
  habit) has none, and that's fine.
- tags: up to 3 lowercase single-word or hyphenated labels (music,
  woodwork, writing). Reuse theirs where one fits.
- steps: the first steps, in the order they'd be done.
    If end_goal is known: work BACKWARDS from it. Start at "done" and ask
    what had to be true just before it, and before that, until you reach
    something they could do in their next hour. Then write the chain out
    forwards. ${Math.min(4, MAX_SPINE_STEPS)}-${MAX_SPINE_STEPS} steps.
    If end_goal is null: ${FIRST_CUT_STEPS} broad first moves forward from what the
    project is. Coarse on purpose -- naming the wrong specifics now is
    worse than leaving them open.

WHAT EACH STEP MUST BE:
- A move against the work, with something existing afterwards that
  didn't before: cut, write, record, build, send, book, phone, drive.
- Roughly one sitting of work. "Record the vocals" not "make the album",
  and not "plug the mic in".
- Written so that in six weeks' time they'd still know what it meant.

WHAT NONE OF THEM MAY BE:
- Admin pretending to be building: research, plan, outline, decide, list,
  consider, review, think about, set up, brainstorm, explore.
- Anything naming a tool, brand, model number, file format, setting,
  instrument, person or place that does NOT appear verbatim above. If
  they never mentioned a guitar, this project has no guitar. Cite the
  sentence id each step comes from; a step that names nothing beyond the
  project itself needs no citation.

THE ORDER IS THE PLAN. Read your list top to bottom: could they do each
step with only the steps above it finished? If not, it's in the wrong
place.
  BAD:  1. Let the piece dry and peel the stencil off
        2. Design and cut the stencil
  GOOD: 1. Design and cut the stencil  2. Pour the paint  3. Let it dry and peel it off
For each step, list "after": the numbers of the steps that must be
finished before it can start. Empty means any time.

For each step, guess how long one sitting of it takes. Pick the closest
value from EXACTLY this list: ${ESTIMATE_MINUTES.join(', ')}.

${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{
  "title": "...",
  "summary": "...",
  "end_goal": "..." or null,
  "tags": ["..."],
  "steps": [ { "text": "...", "evidence": ["e1"], "after": [], "estimated_minutes": 20 } ]
}`
}

/** The one question, asked only when nothing could be planned. */
export function questionFor(title: string): string {
  return `What's the first thing that has to exist for ${title}?`
}

export async function shapeProjectFromDump(
  dump: string,
  existingTags: string[] = [],
): Promise<ShapedProject | null> {
  if (!dump.trim()) return null
  const evidence = evidenceFromDump(dump)

  try {
    const response = await generateText(buildShapingPrompt(dump, existingTags, evidence), {
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 2000,
    })
    const parsed = JSON.parse(response)

    const title = typeof parsed?.title === 'string' ? parsed.title.trim() : ''
    if (!title) return null

    const endGoalRaw = typeof parsed?.end_goal === 'string' ? parsed.end_goal.trim() : ''
    const endGoal = endGoalRaw && endGoalRaw.toLowerCase() !== 'null' ? endGoalRaw : null

    const tags = Array.isArray(parsed?.tags)
      ? parsed.tags
          .map((t: unknown) => (typeof t === 'string' ? normalizeTag(t) : null))
          .filter((t: string | null): t is string => !!t)
          .slice(0, 3)
      : []

    const cleaned = sanitizeSteps(parsed?.steps, endGoal ? MAX_SPINE_STEPS : FIRST_CUT_STEPS)
    const { kept, rejected } = filterGrounded(cleaned, evidence, title)
    if (rejected.length > 0) {
      console.warn(`[project-shaping] dropped ${rejected.length} ungrounded step(s) for "${title}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }
    const steps = assembleSteps(cleaned, kept)

    return {
      title,
      endGoal,
      summary: typeof parsed?.summary === 'string' ? parsed.summary.trim() : '',
      tags,
      steps,
      question: steps.length === 0 ? questionFor(title) : null,
    }
  } catch (e) {
    console.error('[project-shaping] extraction failed:', e)
    return null
  }
}
