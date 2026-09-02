/**
 * Is the project actually finished?
 *
 * "All tasks ticked" and "the finish line is reached" are different
 * things. A spine is 4-8 steps; most projects need more than one spine to
 * get from the first move to what the user said done looks like. The old
 * banner treated an empty task list as "mark this complete?", which pushed
 * people to call a project done because its plan ran out -- or to leave a
 * finished project open because nobody said so.
 *
 * So when the last open step is ticked, one cheap capped-thinking call
 * reads the finish line against what's actually been done and says which
 * it is. The answer is a fact the user can act on, never a nag: one line,
 * one action (mark it finished, or plan what comes next).
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'

export interface FinishLineInput {
  title: string
  endGoal: string
  /** Everything ticked off, oldest first. */
  doneTasks: string[]
  /** The user's own close-outs, newest first. */
  closeouts: string[]
}

export interface FinishLineVerdict {
  reached: boolean
  /** One plain sentence. What's there when reached; what's still missing
   *  when not. */
  reason: string
}

export function buildFinishLinePrompt(input: FinishLineInput): string {
  return `A project called "${input.title}" has just had the last step on its list ticked off.

WHAT THE USER SAID DONE LOOKS LIKE:
"${input.endGoal}"

WHAT HAS BEEN DONE (every finished step):
${input.doneTasks.length ? input.doneTasks.map(t => `- ${t}`).join('\n') : '(nothing recorded)'}

WHAT THEY SAID AT THE END OF SESSIONS, newest first:
${input.closeouts.length ? input.closeouts.map(c => `- "${c}"`).join('\n') : '(nothing recorded)'}

Question: going only on the above, does what's been done add up to what
they said done looks like?

- reached: true only if the finish line as THEY wrote it is now true. A
  list of finished steps that stops short of it is not done -- it's a plan
  that ran out.
- reason: one plain sentence. If reached, say what exists now. If not,
  name the specific thing the finish line asks for that nothing above
  shows was made, sent, or finished. Nothing else: no encouragement, no
  advice, no "consider".

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "reached": true | false, "reason": "..." }`
}

export function sanitizeFinishLine(raw: unknown): FinishLineVerdict | null {
  if (!raw || typeof raw !== 'object') return null
  const reached = (raw as any).reached
  const reason = typeof (raw as any).reason === 'string' ? (raw as any).reason.trim() : ''
  if (typeof reached !== 'boolean') return null
  if (!reason || reason.length > 200) return null
  return { reached, reason }
}

/**
 * Null on any failure. The caller treats null as "don't say anything" --
 * a wrong "you're done" costs more than saying nothing.
 */
export async function judgeFinishLine(input: FinishLineInput): Promise<FinishLineVerdict | null> {
  if (!input.endGoal.trim()) return null
  try {
    const response = await generateText(buildFinishLinePrompt(input), {
      responseFormat: 'json',
      temperature: 0.2,
      // Mechanical: comparing a stated condition against a list of facts.
      thinkingLevel: 'low',
      maxTokens: 300,
    })
    return sanitizeFinishLine(JSON.parse(response))
  } catch (e) {
    console.warn('[finish-line] judgement failed, staying quiet:', e instanceof Error ? e.message : e)
    return null
  }
}
