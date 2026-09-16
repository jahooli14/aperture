/**
 * The one follow-up, and the correction it exists to catch.
 *
 * A question is written from a computed fact, and the fact is true — but
 * true is not the same as current. "You gave up on custom t-shirts in
 * January" is arithmetic; whether that still describes how the person
 * thinks about it today is something only they know, and until now there
 * was nowhere to say it. The answer went in as a note and the app's model
 * of them stayed exactly as wrong as it was.
 *
 * So: they answer, the app asks ONE thing back, they reply, done. Not a
 * chat. Two turns is enough to catch a wrong premise and short enough to
 * finish on a walk, which is the only time these get answered at all.
 *
 * ONLY THE USER'S TURNS ARE EVER SAVED. The app's follow-up is scaffolding
 * — it exists to get a second sentence out of them and then gets thrown
 * away. Storing it would put model prose into the corpus as "their own
 * words", where the grounding gates would later check the model against
 * itself and `loadResonance` would few-shot on it.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { thinkingFragment } from './gemini-thinking.js'

/** Long enough to have said something, short enough to be worth a follow-up. */
export const MIN_ANSWER_CHARS = 25

export interface FollowUpInput {
  question: string
  answer: string
}

/**
 * Is this answer worth following up at all?
 *
 * "Yeah" and "not sure" get nothing back — a follow-up to a shrug is the
 * app being needy, and the point is one question a day, not a conversation
 * the person did not ask for.
 */
export function worthFollowingUp(answer: string): boolean {
  return answer.trim().length >= MIN_ANSWER_CHARS
}

export function buildFollowUpPrompt({ question, answer }: FollowUpInput): string {
  return `They were asked this:
"${question}"

They said:
"${answer}"

Ask ONE short thing back. Under twenty words.

You are looking for the part of their answer that changes what the app
thinks it knows. Two things earn a follow-up:

  THE PREMISE WAS OFF. They have said, in passing, that the question got
  something wrong — the project is not what it was, they did finish it,
  they stopped caring in March. Ask them to say the true version straight
  out. This is the most valuable thing you can get and the easiest to miss,
  because people correct you politely and move on.

  THEY STOPPED ONE STEP SHORT. They named a feeling but not the thing they
  would do about it. Ask what the next actual move is.

If their answer already settles it, reply with exactly: NONE

Never summarise what they said back to them. Never say "it sounds like".
Never ask two things. Never ask how they feel about it.

${PLAIN_ENGLISH_RULES}

Reply with the question alone, or NONE.`
}

/** The follow-up, or null when there is nothing worth asking. */
export function readFollowUp(raw: string): string | null {
  const t = (raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!t || /^none$/i.test(t)) return null
  // A follow-up that isn't a question is the model narrating.
  if (!t.includes('?')) return null
  // The prompt asks for under twenty words. A little slack, then it is a
  // speech rather than a question, and a speech on a walk goes unanswered.
  if (t.split(/\s+/).length > 24) return null
  return t
}

export async function askFollowUp(input: FollowUpInput): Promise<string | null> {
  if (!worthFollowingUp(input.answer)) return null
  try {
    const raw = await generateText(buildFollowUpPrompt(input), {
      ...thinkingFragment('low'),
    })
    return readFollowUp(raw)
  } catch (e) {
    // No follow-up is a fine outcome. Their answer is already saved.
    console.warn('[spark-followup] failed:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * The note their turns become.
 *
 * Joined plainly, no labels, no "Q:"/"A:" — it has to read as something
 * they said, because that is what every downstream surface treats it as.
 */
export function joinTurns(turns: string[]): string {
  return turns.map(t => t.trim()).filter(Boolean).join('\n\n')
}
