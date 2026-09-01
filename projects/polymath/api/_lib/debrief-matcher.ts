/**
 * Debrief matcher — turning "I did A, B, C; next session D, E, F" into
 * task-list updates that can be trusted.
 *
 * The old mechanism only caught a single "Next: X" sentence via regex, and
 * only ever matched "done" against whatever was ticked on screen. Voice
 * debriefs say more than that: things done that weren't on today's plan at
 * all, several next-steps in one breath. But reconciling free text against
 * the WHOLE open task list is exactly the situation session-grounding.ts
 * was built to police on session items -- an ungrounded match here doesn't
 * just show a wrong line for two minutes, it silently rewrites the
 * project's permanent record. So every claim here carries the same bar:
 * a "done" match cites a real, closed-list task id (never fuzzy text
 * similarity), and every new task must quote a real phrase from what the
 * user actually said. No quote, no citation, no task.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { sharesSubstantialWording } from './session-grounding.js'
import { isAdminItem } from './session-shaper.js'

export interface DebriefOpenTask {
  id: string
  text: string
}

export interface DebriefResult {
  /** Ids of existing open tasks the text says got finished. */
  doneTaskIds: string[]
  /** Something the text says was done that wasn't already an open task --
   *  created and marked done immediately, so progress still shows. */
  newDone: string[]
  /** Something the text says should happen next session, that isn't
   *  already effectively on the list. */
  next: string[]
}

const EMPTY: DebriefResult = { doneTaskIds: [], newDone: [], next: [] }

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** True when `quote` genuinely appears in the source text -- the same
 *  verbatim-anchor bar the rest of this codebase already uses (filterGrounded
 *  on session items, the onboarding-observe phrase check) to stop a model
 *  claim from being trusted just because it sounds plausible. */
export function quoteVerified(quote: unknown, sourceText: string): boolean {
  if (typeof quote !== 'string' || !quote.trim()) return false
  const q = normalize(quote)
  if (q.length < 4) return false
  return normalize(sourceText).includes(q)
}

export function buildDebriefPrompt(closeoutText: string, openTasks: DebriefOpenTask[], title: string): string {
  return `Someone just finished a work session on "${title}" and said what happened:

"${closeoutText}"

THE PROJECT'S CURRENTLY OPEN TASKS:
${openTasks.length
  ? openTasks.map(t => `[${t.id}] ${t.text}`).join('\n')
  : '(none open right now)'}

Read what they said and sort it into three things:

1. DONE, MATCHING AN OPEN TASK -- they described finishing one of the tasks
   above. Cite its id. Only cite a task id when what they said is genuinely
   the same piece of work, not just a loose theme in common.

2. DONE, NOT ON THE LIST -- they described finishing something that ISN'T
   one of the open tasks above (they went off-plan, or the project had no
   tasks queued). Give it as a short line, in their own words as much as
   possible, plus the exact phrase from what they said that supports it.

3. NEXT SESSION -- they said what should happen next time. Only include
   something that ISN'T already effectively one of the open tasks above
   (don't repeat the list back). Give each as a short line, plus the exact
   phrase from what they said that supports it.

If they only mentioned one or two of these things, the others are empty
lists -- don't invent content to fill a category. A close-out that's just
"got nowhere, distracted the whole time" has nothing in any of the three.

Every line in categories 2 and 3 must carry a "quote" -- an exact,
verbatim phrase copied from what they said above. If you can't quote it,
you can't include it.

Category 3 lines must be real moves against the work, not admin: never
"decide", "plan", "think about", "research" -- if what they said next was
a decision to make, that's not a task yet.

${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{
  "done": [ { "task_id": "..." } ],
  "new_done": [ { "text": "...", "quote": "..." } ],
  "next": [ { "text": "...", "quote": "..." } ]
}`
}

/**
 * Model output -> a result the app can act on. Every claim is checked
 * mechanically here, not trusted because the JSON parsed -- a task id has
 * to be one that was actually offered, and a quote has to actually appear
 * in what the user said.
 */
export function sanitizeDebrief(
  raw: unknown,
  closeoutText: string,
  openTasks: DebriefOpenTask[],
): DebriefResult {
  if (!raw || typeof raw !== 'object') return EMPTY
  const parsed = raw as { done?: unknown; new_done?: unknown; next?: unknown }
  const openIds = new Set(openTasks.map(t => t.id))

  const doneTaskIds = Array.isArray(parsed.done)
    ? [...new Set(
        parsed.done
          .map((d: any) => (d && typeof d === 'object' ? d.task_id : null))
          .filter((id: unknown): id is string => typeof id === 'string' && openIds.has(id)),
      )]
    : []

  const cleanClaim = (entry: unknown): string | null => {
    if (!entry || typeof entry !== 'object') return null
    const text = typeof (entry as any).text === 'string' ? (entry as any).text.trim() : ''
    if (!text || text.length > 140) return null
    if (!quoteVerified((entry as any).quote, closeoutText)) return null
    return text
  }

  const newDoneSeen = new Set<string>()
  const newDone: string[] = Array.isArray(parsed.new_done)
    ? parsed.new_done
        .map(cleanClaim)
        .filter((t: string | null): t is string => {
          if (!t) return false
          const key = normalize(t)
          if (newDoneSeen.has(key)) return false
          newDoneSeen.add(key)
          return true
        })
    : []

  const nextSeen = new Set<string>()
  const next: string[] = Array.isArray(parsed.next)
    ? parsed.next
        .map(cleanClaim)
        .filter((t: string | null): t is string => {
          if (!t || isAdminItem(t)) return false
          const key = normalize(t)
          if (nextSeen.has(key)) return false
          // Mechanical backstop against the model repeating the list back
          // to itself: drop anything that's substantially the same wording
          // as an already-open task. Deliberately NOT citationSupports --
          // that accepts a single shared word, which would wrongly treat
          // "record a vocal take" as a duplicate of an open task about
          // recording a guitar solo just because they share "record".
          if (openTasks.some(ot => sharesSubstantialWording(t, ot.text))) return false
          nextSeen.add(key)
          return true
        })
    : []

  return { doneTaskIds, newDone, next }
}

/**
 * Reconciles a close-out against the project's real task list. Best-effort:
 * any failure returns the empty result rather than blocking the close, and
 * an empty close-out text never even makes the call -- "nothing to report"
 * is a valid, free outcome.
 */
export async function debriefSession(closeoutText: string, openTasks: DebriefOpenTask[], title: string): Promise<DebriefResult> {
  const text = closeoutText.trim()
  if (!text) return EMPTY

  try {
    const response = await generateText(buildDebriefPrompt(text, openTasks, title), {
      responseFormat: 'json',
      temperature: 0.2,
      // Mechanical: sorting stated facts into three buckets, not composing.
      thinkingLevel: 'minimal',
    })
    return sanitizeDebrief(JSON.parse(response), text, openTasks)
  } catch (e) {
    console.error('[debrief-matcher] failed, continuing with ticks only:', e)
    return EMPTY
  }
}
