/**
 * The next move — written at the end of the last session, not the start
 * of this one.
 *
 * In creative work you only know the next step once you've done the
 * current one. A list written up front is out of date by item two, so the
 * app keeps ONE move per project (metadata.next_move) and rewrites it from
 * the freshest thing there is: the note you left when you stopped ("stopped
 * halfway through verse two, the hiss is bugging me"). Hemingway's trick --
 * stop knowing where you'll pick up -- done for you.
 *
 * So the next session starts instantly: the move is already on the card,
 * made from your own words. No planning call at the moment you have least
 * patience, no list to read.
 *
 * Three shapes of project, three openings:
 *   - new       -- nothing done yet. If the notes hold a real fork ("the
 *                  pole or the wires?"), ask it; the answer writes the
 *                  first move. A decision beats a step when nothing's
 *                  decided.
 *   - going     -- the move comes out of the last note.
 *   - returning -- a month or more away. Meet the work again first: play,
 *                  read or look at the last thing that exists.
 *
 * Rejections stick (metadata.move_feedback): "too big" three times means
 * the next move is written smaller, and a move already turned down isn't
 * offered again.
 *
 * Pure except `writeNextMove`. Grounded like every other generated line:
 * nothing named that the evidence doesn't name.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES, CLEAR_STEP_RULES, CREATIVE_MOVE_RULES, FIRST_MOVE_RULES } from './plain-english.js'
import { evidenceHaystack, hasOnlyKnownSpecifics } from './session-grounding.js'
import { isAdminItem, stripDoneWhen } from './session-items.js'

export const RETURNING_AFTER_DAYS = 28
export const FEEDBACK_LIMIT = 12

export type MoveStage = 'new' | 'going' | 'returning'
export type MoveFrom = 'closeout' | 'start' | 'reshape' | 'answer' | 'user' | 'fallback'
export type FeedbackReason = 'too_big' | 'wrong_thing'

export interface NextMove {
  /** For a move: the move, then " Done when …". For a fork: the question. */
  text: string
  kind: 'move' | 'fork'
  from: MoveFrom
  written_at: string
}

export interface MoveFeedback {
  reason: FeedbackReason
  move: string
  at: string
}

export interface MoveInput {
  title: string
  description: string | null
  endGoal: string | null
  stage: MoveStage
  daysAway: number
  /** The note they left when they stopped. The main input. */
  note: string | null
  /** What they ticked in the session that just ended. */
  did: string[]
  /** The move they were last given. */
  lastMove: string | null
  /** Recently finished work, newest first. */
  log: string[]
  /** Earlier notes, newest first. */
  pastNotes: string[]
  /** Open steps from the old plan: where it was heading, not orders. */
  heading: string[]
  /** Notes they've captured about the project. */
  captures: string[]
  feedback: MoveFeedback[]
  /** What they just said about the move on screen, or their answer to a
   *  fork. The most current thing there is. */
  said: string | null
  /** Asked while a fork is open, so this is its answer. */
  answering: string | null
}

// ── Stage ──────────────────────────────────────────────────────────────

export function stageFor(opts: { sessionsEver: number; doneCount: number; daysAway: number }): MoveStage {
  if (opts.sessionsEver === 0 && opts.doneCount === 0) return 'new'
  if (opts.daysAway >= RETURNING_AFTER_DAYS) return 'returning'
  return 'going'
}

// ── Feedback ───────────────────────────────────────────────────────────

export function readMove(metadata: unknown): NextMove | null {
  const raw = (metadata as { next_move?: unknown } | null)?.next_move as Partial<NextMove> | undefined
  if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) return null
  return {
    text: raw.text.trim(),
    kind: raw.kind === 'fork' ? 'fork' : 'move',
    from: (raw.from as MoveFrom) ?? 'fallback',
    written_at: typeof raw.written_at === 'string' ? raw.written_at : new Date(0).toISOString(),
  }
}

export function readFeedback(metadata: unknown): MoveFeedback[] {
  const raw = (metadata as { move_feedback?: unknown } | null)?.move_feedback
  if (!Array.isArray(raw)) return []
  return raw.filter((f): f is MoveFeedback =>
    !!f && (f.reason === 'too_big' || f.reason === 'wrong_thing') && typeof f.move === 'string' && typeof f.at === 'string')
}

export function addFeedback(existing: MoveFeedback[], reason: FeedbackReason, move: string, at = new Date()): MoveFeedback[] {
  return [...existing, { reason, move, at: at.toISOString() }].slice(-FEEDBACK_LIMIT)
}

/** What past rejections say, as instructions the model can act on. */
export function feedbackLines(feedback: MoveFeedback[]): string[] {
  const lines: string[] = []
  const tooBig = feedback.filter(f => f.reason === 'too_big').length
  if (tooBig >= 2) lines.push(`They've said a move was too big ${tooBig} times. Go smaller than feels useful: five minutes, one thing.`)
  else if (tooBig === 1) lines.push('They said a recent move was too big. Keep it small.')
  const turnedDown = feedback.slice(-4).map(f => f.move)
  if (turnedDown.length) {
    lines.push(`Moves they turned down. Don't offer these or anything that's the same move in new words:\n${turnedDown.map(m => `- ${stripDoneWhen(m)}`).join('\n')}`)
  }
  return lines
}

// ── Prompt ─────────────────────────────────────────────────────────────

interface Ev { id: string; label: string; text: string }

export function buildEvidence(input: MoveInput): Ev[] {
  const ev: Ev[] = []
  const add = (label: string, text: string | null | undefined) => {
    if (text && text.trim()) ev.push({ id: `e${ev.length + 1}`, label, text: text.trim() })
  }
  add('what they just said', input.said)
  add('the question they are answering', input.answering)
  add('the note they left when they stopped', input.note)
  input.did.forEach(d => add('done in the session that just ended', stripDoneWhen(d)))
  add('the move they were last given', input.lastMove ? stripDoneWhen(input.lastMove) : null)
  input.pastNotes.forEach(n => add('an earlier note', n))
  input.log.forEach(l => add('finished earlier', l))
  add('what the project is', input.description)
  add('where they said it ends', input.endGoal)
  input.heading.forEach(h => add('on the old plan (where it was heading)', h))
  input.captures.forEach(c => add('something they captured about it', c))
  return ev
}

export function buildMovePrompt(input: MoveInput, evidence: Ev[]): string {
  const canFork = input.stage === 'new' && !input.said && !input.answering
  const situation = input.answering
    ? `They were asked "${input.answering}" and answered (see "what they just said"). Write the first move from that answer.`
    : input.said
      ? 'They looked at the move on screen and said what was off with it (see "what they just said"). Write a different move that answers that.'
      : input.stage === 'returning'
        ? `Nobody has worked on this for about ${Math.round(input.daysAway / 7)} weeks. The old plan is cold. The move meets the work again first: play, read, look at or run the last thing that exists, then say one sentence about what it needs.`
        : input.stage === 'new'
          ? 'Nothing has been made yet.'
          : 'They just stopped a session. The next move comes out of where they stopped.'

  return `Write the ONE next move for "${input.title}".

${situation}

EVERYTHING KNOWN, freshest first:
${evidence.length ? evidence.map(e => `[${e.id}] (${e.label}) ${e.text}`).join('\n') : '(nothing beyond the title)'}

That list is the whole of it. Anything not in it, you do not know.

HOW TO FIND THE MOVE:
- Their own note comes first. If it says what's next, that IS the move: make it concrete and small, in their words.
- If something is bugging them, the move can go straight at it.
- If they stopped part way through something, the move picks it up exactly there.
- The old plan is background. Use a step from it only if nothing fresher says what's next.
- One move. Not a list, not a plan, not advice.
${feedbackLines(input.feedback).map(l => `- ${l}`).join('\n')}
${canFork ? `
IF NOTHING IS DECIDED YET: when the notes show the project hasn't settled what it's about, and there's a real fork in them, ask it instead of giving a move. One short question with two concrete sides from their notes, answerable in a sentence.
  GOOD: "Is it about the pole, or about the wires?"
  BAD:  "What do you want this project to be?" -- vague, no sides.
Only ask if the fork is really there. Otherwise give a move.
` : ''}
${input.endGoal ? `
They said it ends with: "${input.endGoal}". Also say whether what's been done reaches that ("finish"). Be strict: reached only if the finished work plainly is that thing.
` : ''}
${PLAIN_ENGLISH_RULES}

${CLEAR_STEP_RULES}

${CREATIVE_MOVE_RULES}

${FIRST_MOVE_RULES}

Respond with JSON only:
{
  "kind": "move"${canFork ? ' | "fork"' : ''},
  "move": "the move, without the done-when",
  "done_when": "the stopping point, without the words 'done when'",
  ${canFork ? '"question": "only for a fork",\n  ' : ''}"finish": ${input.endGoal ? '{ "reached": false, "reason": "one plain sentence" }' : 'null'}
}`
}

// ── Reading the answer ─────────────────────────────────────────────────

export interface ParsedMove {
  move: NextMove | null
  finish: { reached: boolean; reason: string } | null
  rejected: string | null
}

function clean(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ')
  return t && t.length <= max ? t : null
}

/**
 * The gate: one line, no admin verbs, nothing named that the evidence
 * doesn't name, and not a move they already turned down. A fork only when
 * one was allowed. Null move when it fails -- the caller falls back.
 */
export function parseMove(raw: unknown, input: MoveInput, evidence: Ev[], from: MoveFrom, now = new Date()): ParsedMove {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const haystack = evidenceHaystack(evidence, input.title)
  const known = (t: string) => hasOnlyKnownSpecifics(t, haystack)

  let finish: ParsedMove['finish'] = null
  const f = obj.finish as { reached?: unknown; reason?: unknown } | null | undefined
  if (input.endGoal && f && typeof f.reached === 'boolean') {
    const reason = clean(f.reason, 200)
    if (reason && known(reason)) finish = { reached: f.reached, reason }
  }

  const canFork = input.stage === 'new' && !input.said && !input.answering
  if (obj.kind === 'fork' && canFork) {
    const q = clean(obj.question, 140)
    if (q && q.endsWith('?') && known(q)) {
      return { move: { text: q, kind: 'fork', from, written_at: now.toISOString() }, finish, rejected: null }
    }
    return { move: null, finish, rejected: 'fork: unusable question' }
  }

  const move = clean(obj.move, 140)?.replace(/[.]*$/, '.')
  if (!move) return { move: null, finish, rejected: 'no move' }
  if (isAdminItem(move)) return { move: null, finish, rejected: `admin: ${move}` }
  if (!known(move)) return { move: null, finish, rejected: `invented: ${move}` }
  const norm = (t: string) => stripDoneWhen(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const turnedDown = input.feedback.slice(-4).map(x => norm(x.move))
  if (turnedDown.includes(norm(move))) return { move: null, finish, rejected: `repeat of a turned-down move: ${move}` }

  const doneWhenRaw = clean(obj.done_when, 110)?.replace(/^done when\s*/i, '').replace(/[.]*$/, '')
  const doneWhen = doneWhenRaw && known(doneWhenRaw) ? doneWhenRaw : null
  const text = doneWhen ? `${move} Done when ${doneWhen}.` : move
  return { move: { text, kind: 'move', from, written_at: now.toISOString() }, finish, rejected: null }
}

/**
 * Never nothing. The note's own "next" when there is one, then the old
 * plan's next step, then the plainest honest move there is: go and look
 * at the last thing you made.
 */
export function fallbackMove(input: MoveInput, debriefNext: string[] = [], now = new Date()): NextMove {
  const text = debriefNext[0]?.trim()
    || input.heading[0]?.trim()
    || `Open ${input.title} and look at the last thing you made. Done when you can say one thing it needs.`
  return { text, kind: 'move', from: 'fallback', written_at: now.toISOString() }
}

export async function writeNextMove(
  input: MoveInput,
  from: MoveFrom,
  debriefNext: string[] = [],
): Promise<{ move: NextMove; finish: ParsedMove['finish'] }> {
  const evidence = buildEvidence(input)
  try {
    const response = await generateText(buildMovePrompt(input, evidence), {
      model: MODELS.SESSION_SHAPE_CHAT,
      responseFormat: 'json',
      temperature: 0.4,
      maxTokens: 1200,
      // One line against a closed evidence set. Uncapped, a thinking model
      // can spend the budget before writing any JSON.
      thinkingLevel: 'low',
    })
    const parsed = parseMove(JSON.parse(response), input, evidence, from)
    if (parsed.move) return { move: parsed.move, finish: parsed.finish }
    console.warn(`[next-move] "${input.title}": ${parsed.rejected} -- falling back`)
    return { move: fallbackMove(input, debriefNext), finish: parsed.finish }
  } catch (e) {
    console.error(`[next-move] "${input.title}" failed, falling back:`, e)
    return { move: fallbackMove(input, debriefNext), finish: null }
  }
}
