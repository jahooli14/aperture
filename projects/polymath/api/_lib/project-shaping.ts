/**
 * Turning what someone said into a shaped project, in one pass.
 *
 * The old flow was an interview: the chat asked, the user answered, the
 * chat asked something adjacent, and at the end it created a project with
 * `tasks: []` and threw the entire conversation away. So the app asked the
 * same things again next session -- not because it was badly prompted, but
 * because nothing it had learned was ever written down. Repetition was a
 * storage bug wearing an interview's clothes.
 *
 * The replacement is EXTRACT, THEN ASK AT MOST ONE THING:
 *   1. The user says everything they know, in one go, however messy.
 *   2. This pulls the structure out of it -- title, what done looks like,
 *      the labels, and what's genuinely missing.
 *   3. Only a field that is both absent AND load-bearing gets asked about,
 *      and only one of them.
 *
 * Comprehensiveness comes from extraction, not from interrogation. That's
 * the whole trick to "low friction yet thorough": the friction of a good
 * project is one voice note, and the app does the filing.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { normalizeTag } from './project-tags.js'

/** Fields worth asking about when they're missing, in priority order.
 *  `end_goal` first because the task spine works backwards from it -- with
 *  no finish line there is nothing to plan against. */
export type MissingField = 'end_goal' | 'nothing'

export interface ShapedProject {
  title: string
  /** What done looks like, in their words where possible. */
  endGoal: string | null
  /** One or two plain sentences on what this is. */
  summary: string
  tags: string[]
  /** The single thing to ask, or 'nothing' when the dump covered it. */
  missing: MissingField
  /** The question to ask, already written. Null when nothing's missing. */
  question: string | null
}

export function buildShapingPrompt(dump: string, existingTags: string[]): string {
  return `Someone just described a creative project they want to start. Pull the
structure out of what they said. Do not ask them anything; do not add
anything they didn't say.

WHAT THEY SAID:
"""
${dump.trim()}
"""

${existingTags.length ? `Labels they already use on other projects (strongly prefer reusing one of these over inventing a near-synonym):\n${existingTags.join(', ')}\n` : ''}
Pull out:
- title: short, concrete, what they'd call it themselves. Not a slogan.
- end_goal: what they'll have when it's finished, in their words. ONLY if
  they actually said or clearly implied it. If they didn't, use null —
  do not invent a finish line, because every step of the plan gets worked
  backwards from this and a guessed one poisons the lot.
- summary: one or two plain sentences saying what this is.
- tags: up to 3 lowercase single-word or hyphenated labels (music, woodwork,
  writing). Reuse theirs where one fits.

Say nothing they didn't. No gear, brands, formats, people or places unless
they named them.

${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{ "title": "...", "end_goal": "..." or null, "summary": "...", "tags": ["..."] }`
}

/** The one question worth asking, written out. Kept here rather than in a
 *  prompt so the app asks the same way every time. */
export function questionFor(missing: MissingField, title: string): string | null {
  if (missing === 'end_goal') {
    return `When ${title} is finished, what have you actually got?`
  }
  return null
}

export async function shapeProjectFromDump(
  dump: string,
  existingTags: string[] = [],
): Promise<ShapedProject | null> {
  if (!dump.trim()) return null

  try {
    const response = await generateText(buildShapingPrompt(dump, existingTags), {
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 900,
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

    const missing: MissingField = endGoal ? 'nothing' : 'end_goal'

    return {
      title,
      endGoal,
      summary: typeof parsed?.summary === 'string' ? parsed.summary.trim() : '',
      tags,
      missing,
      question: questionFor(missing, title),
    }
  } catch (e) {
    console.error('[project-shaping] extraction failed:', e)
    return null
  }
}
