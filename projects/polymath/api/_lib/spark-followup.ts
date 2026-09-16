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
import { offersAChoice } from './mull.js'
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

Pick your reason from what is ALREADY in their answer.

  "correction" — they said, usually in passing, that the question got
  something wrong. "I never actually gave up on it, I just moved it off the
  main list." "That finished in March." Ask for the true version straight
  out: "So where did it move to?" This is the most valuable thing you can
  get and the easiest to miss, because people correct you politely and
  carry on. When it is there, take it.

  "next_step" — they named something they still want and stopped before the
  thing they would do about it. "I do still want to do the memory palace
  one, it keeps coming back." Ask what would start it: "What needs to
  happen to start it?" When it is there, take it.

  "none" — everything else, and especially when they have already answered
  concretely. Live failure: they said "Ben's. I'll print his this weekend,
  the design is done" — settled, nothing missing — and the follow-up was
  "Wait, you didn't give up on custom t-shirts in January?", disputing a
  premise they had never disputed. Never argue with the question on their
  behalf.

NEVER OFFER A CHOICE. Not "is it X, or is it Y?", not "are you going to do
it, or is it just a thought?" — a question they answer by picking one of two
things you supplied tells you nothing you did not already write. Both of
these came out of a live run and both are wrong:
  "So is it the exact same design, or did restarting change the file?"
  "Are you actually going to build it, or is it just a thought experiment?"
Ask it open. "What changed about the design?" "What would make you start it?"

Never summarise what they said back to them. Never say "it sounds like".
Never ask two things. Never ask how they feel about it.

${PLAIN_ENGLISH_RULES}

Answer with JSON only:
{ "reason": "correction" | "next_step" | "none", "question": "..." or null }

"reason" is what is ALREADY in their answer, not what you would like to ask
about. If neither is there, "none" with a null question — and that is the
common case, not a failure.`
}

/**
 * The follow-up, or null when there is nothing worth asking.
 *
 * The model has to name its REASON before it gets to ask, and a reason of
 * "none" ends it there. Asked in prose instead, it invented a reason: on a
 * fully settled answer — "Ben's, I'll print his this weekend, the design is
 * done" — it came back with "Wait, you didn't give up on custom t-shirts in
 * January?", disputing a premise the user had not disputed. Twice, after
 * the prompt was told in plain words that none is the normal answer.
 * Declaring the reason as data is the difference between asking and hoping.
 */
export function readFollowUp(raw: string): string | null {
  const t = (raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!t || /^none$/i.test(t)) return null

  const block = t.match(/\{[\s\S]*\}/)
  if (block) {
    try {
      const parsed = JSON.parse(block[0]) as { reason?: string; question?: string | null }
      if (parsed.reason !== 'correction' && parsed.reason !== 'next_step') return null
      return readQuestion(parsed.question ?? '')
    } catch {
      return null
    }
  }
  return readQuestion(t)
}

function readQuestion(raw: string): string | null {
  const t = (raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!t || /^none$/i.test(t)) return null
  // A follow-up that isn't a question is the model narrating.
  if (!t.includes('?')) return null
  // The prompt asks for under twenty words. A little slack, then it is a
  // speech rather than a question, and a speech on a walk goes unanswered.
  if (t.split(/\s+/).length > 24) return null
  // The same ban the questions themselves are held to (mull.ts). The prompt
  // says it and the model does it anyway — two of four live follow-ups were
  // binaries — so it is checked, not just asked for.
  if (offersAChoice(t)) return null
  return t
}

export async function askFollowUp(input: FollowUpInput): Promise<string | null> {
  if (!worthFollowingUp(input.answer)) return null
  try {
    const raw = await generateText(buildFollowUpPrompt(input), {
      responseFormat: 'json',
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
