/**
 * Session shaper — the two minutes of planning that buy the hour.
 *
 * One planning model, three altitudes:
 *   - the FINISH LINE, in the user's words (metadata.end_goal)
 *   - the STEPS that reach it, in order (metadata.tasks, task-spine.ts)
 *   - the SESSION: the next step or steps, cut to fit this sitting
 *
 * The earlier shaper had a second, competing planning unit: it invented
 * 3-6 fresh items per session "sized to the window", with spares on a
 * bench to swap in. Filling a window is the wrong job -- it's where the
 * imaginary microphones came from -- and swapping a step for a spare
 * quietly broke the order the steps were in. There is no bench now. A
 * session is:
 *
 *   1. the re-entry line (last close-out, the user's own words)
 *   2. the next open steps, in plan order, as many as fit the window
 *   3. if the very next step is bigger than the window, ONE model call
 *      splits that step into the first piece of it that fits
 *      (session-split.ts) -- nothing else is ever generated
 *   4. if the real backlog runs out before the window does, one narrower
 *      model call (session-topup.ts) may propose a small, evidence-cited
 *      top-up -- capped, labelled as a suggestion, and empty rather than
 *      invented when nothing grounds. Not the old bench: this only fires
 *      when there's genuinely nothing left to draw from, never to pad a
 *      list that already has real steps left over
 *   5. one line saying what "done today" looks like
 *
 * Saying what's wrong with the list still reshapes it by voice, and that
 * path is model-written -- but every item it returns must cite a real
 * step or the words just spoken, so it can reorder, split or drop, and
 * never invent.
 *
 * Everything except `shapeSession` is pure and unit-tested.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import {
  filterGrounded, evidenceHaystack, hasOnlyKnownSpecifics,
  type Evidence, type GroundedItem,
} from './session-grounding.js'
import { sanitizeRawItems, dedupeSimilar } from './session-items.js'
import { confidenceFor, reasoningLicence, type Confidence } from './session-confidence.js'
import { pickGap, genericGapQuestion, type Gap } from './session-gap.js'
import { openTasksInOrder, selectByBudget, sumMinutes, workingMinutes, type BudgetTask } from './session-budget.js'
import { nearestEstimate, type EstimateMinutes } from './session-estimate.js'
import { splitStep, doneLineForSteps, sanitizeDoneLooksLike } from './session-split.js'
import { checkReady } from './session-ready.js'
import { topUpSession } from './session-topup.js'
import { briefSession, isUsableExitNote } from './session-briefing.js'
import { sparkForSession, sparkMinutesCap, type WeekSignal } from './session-spark.js'
import { readPrebake, isPrebakeFresh } from './session-prebake.js'
import { generateTaskSpine, generateFirstCutTasks, toStoredTasks } from './task-spine.js'
import { normalizeTaskOrder } from './task-order.js'
import { parseEmbedding } from './project-ideas/seed-picker.js'

export { isAdminItem, sanitizeItems, sanitizeRawItems, dedupeSimilar } from './session-items.js'

/**
 * "3-6 depending on time." A 20-minute window that lists six things is
 * lying to you, and an hour with three is under-using the hour. These are
 * ceilings on how many real steps go on screen, not targets to pad to.
 */
export function itemCountForWindow(windowMinutes: number | null): number {
  if (windowMinutes == null) return 4
  if (windowMinutes <= 20) return 3
  if (windowMinutes <= 45) return 4
  if (windowMinutes <= 75) return 5
  return 6
}

/**
 * The friction line goes through the same honesty rule as every other AI-
 * written line here: nothing named that wasn't already known, and genuinely
 * absent (null) when there's nothing real to say.
 */
export function sanitizeFriction(raw: unknown, evidence: Evidence[], projectTitle: string): FrictionLine | null {
  if (!raw || typeof raw !== 'object') return null
  const text = typeof (raw as any).text === 'string' ? (raw as any).text.trim() : ''
  const minutes = (raw as any).minutes
  if (!text || text.length > 100 || typeof minutes !== 'number') return null
  const haystack = evidenceHaystack(evidence, projectTitle)
  if (!hasOnlyKnownSpecifics(text, haystack)) return null
  return { text, minutes: nearestEstimate(minutes) }
}

/**
 * Taking a step off the project for good, not just off today's session.
 * The model never sees a real task id -- only evidence ids -- so this is
 * the same resolve-through-the-server-built-map pattern as the readiness
 * "add" branch's citation check: an evidence id that isn't in
 * taskIdByEvidenceId (i.e. didn't come from an "already on the project"
 * entry) can't name a real step, so it's silently dropped rather than
 * removing nothing or, worse, guessing.
 */
export function sanitizeRemovals(raw: unknown, taskIdByEvidenceId: Record<string, string>): string[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const taskId = taskIdByEvidenceId[entry]
    if (taskId) ids.add(taskId)
  }
  return [...ids]
}

/**
 * Setting up and clearing away are facts about the PROJECT, not about
 * tonight: a project that needs the paint got out will need it every time.
 * Once observed, it's stored and reused, so it costs one inference rather
 * than one per session -- and so the fast, no-model path can subtract it
 * too.
 */
export function readStoredFriction(raw: unknown): FrictionLine | null {
  if (!raw || typeof raw !== 'object') return null
  const text = typeof (raw as any).text === 'string' ? (raw as any).text.trim() : ''
  const minutes = (raw as any).minutes
  if (!text || typeof minutes !== 'number' || minutes <= 0) return null
  return { text, minutes: nearestEstimate(minutes) }
}

/** Only writes when something actually changed -- this runs on every
 *  briefing, and a no-op update per session is a wasted round trip. */
export function frictionChanged(
  stored: unknown, next: FrictionLine | null,
): boolean {
  const before = readStoredFriction(stored)
  if (!before && !next) return false
  if (!before || !next) return true
  return before.text !== next.text || before.minutes !== next.minutes
}

async function persistFriction(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  metadata: any,
  setup: FrictionLine | null,
  packdown: FrictionLine | null,
): Promise<void> {
  if (!frictionChanged(metadata?.setup, setup) && !frictionChanged(metadata?.packdown, packdown)) return
  const { error } = await supabase
    .from('projects')
    .update({ metadata: { ...metadata, setup, packdown } })
    .eq('id', projectId)
    .eq('user_id', userId)
  if (error) console.warn('[session-shaper] could not save setup/pack-down:', error.message)
}

export interface OpenStep extends BudgetTask {
  progressNote: string | null
}

export interface ShapeContext {
  title: string
  goal: string | null
  windowMinutes: number | null
  lastCloseout: string | null
  /** Open steps in plan order, each carrying a real or default estimate
   *  and, when a close-out said so, where the user got to on it. */
  openTasks: OpenStep[]
  doneTasks: { text: string; date: string | null }[]
  pastCloseouts: { text: string; date: string | null }[]
  shapingTurns: string[]
  fragments: { text: string; date: string | null; role?: string | null }[]
  /** Recent captures that connect to this project but never got attached to
   *  it (below fragments.ts's attach threshold, or claimed by another
   *  project first). Corpus-wide recall, not project-scoped like `fragments`. */
  recalled: { text: string; date: string | null }[]
  /** Days since the project was last touched -- same formula
   *  project-maintenance.ts uses for the dormant-reshape threshold, and the
   *  same number TodaysAnswerCard already shows as a "going quiet" badge. */
  dormancyDays: number
  /** metabolism.ts's own plain-English reason a project's heat just moved,
   *  when there is one -- already citable as-is. */
  heatReason: string | null
  /** One line of tone-setting from what they've recently added to a list or
   *  highlighted while reading -- NOT run through the evidence/citation
   *  system, so it can never become a generated step (see buildReshapePrompt). */
  identityLine: string | null
  /** What the user just said was wrong with the current list, if anything. */
  instruction?: string | null
  currentItems?: string[]
}

/** Plain, no analyst voice -- same bucketing as forgotten.ts's
 *  forgottenSparkText, but returning just the duration phrase so callers can
 *  build their own sentence around it. */
export function humanizeDuration(days: number): string {
  const months = Math.floor(days / 30)
  if (months >= 12) {
    const years = Math.floor(months / 12)
    return years === 1 ? 'a year' : `${years} years`
  }
  if (months >= 2) return `${months} months`
  const weeks = Math.floor(days / 7)
  return weeks <= 1 ? 'a week' : `${weeks} weeks`
}

export interface BuiltEvidence {
  evidence: Evidence[]
  /** evidence id -> open task id, so an item that cites a step can be
   *  traced back to it at close time whatever the wording. */
  taskIdByEvidenceId: Record<string, string>
}

/**
 * Everything the app actually knows about this project, numbered so the
 * model can point at what it used and the result can be checked against
 * it. Nothing outside this list is knowledge — it's invention.
 */
export function buildEvidence(ctx: ShapeContext): BuiltEvidence {
  const evidence: Evidence[] = []
  const taskIdByEvidenceId: Record<string, string> = {}
  let n = 0
  const add = (label: string, text: string, taskId?: string): string | null => {
    if (!text?.trim()) return null
    const id = `e${++n}`
    evidence.push({ id, label, text: text.trim() })
    if (taskId) taskIdByEvidenceId[id] = taskId
    return id
  }

  // What the user just said, on a reshape, is the single most current and
  // most authoritative thing known about this session -- a real, citable
  // entry, so an item that comes straight from it has an honest citation
  // instead of being stapled to an unrelated old note.
  add('what you just said', ctx.instruction ?? '')
  add('the finish line you set', ctx.goal ?? '')
  add('from your last close-out', ctx.lastCloseout ?? '')
  ctx.pastCloseouts.forEach(c =>
    add(c.date ? `from your close-out on ${c.date}` : 'from an earlier close-out', c.text),
  )
  ctx.fragments.forEach(f =>
    add(f.date ? `from your note on ${f.date}` : 'from one of your notes', f.text),
  )
  ctx.recalled.forEach(m =>
    add(m.date ? `a capture from ${m.date} that connects` : 'a capture that connects', m.text),
  )
  if (ctx.heatReason) add('something new since you were last here', ctx.heatReason)
  ctx.doneTasks.forEach(t =>
    add(t.date ? `you finished this on ${t.date}` : 'already finished', t.text),
  )
  // Steps in plan order, so "[e7] then [e8]" reads as the sequence it is.
  ctx.openTasks.forEach(t => {
    add('already on the project', t.text, t.id)
    if (t.progressNote) add(`where you got to on "${t.text}"`, t.progressNote, t.id)
  })
  ctx.shapingTurns.forEach(t => add('from when you set this project up', t))

  return { evidence, taskIdByEvidenceId }
}

/**
 * The reshape prompt. The only session-time prompt that writes a whole
 * list, and it is constrained to the steps: reorder, split, drop, or add
 * what the user just asked for -- never a new idea of its own.
 */
export function buildReshapePrompt(
  ctx: ShapeContext,
  evidence: Evidence[],
  confidence: Confidence = 'partial',
): string {
  const count = itemCountForWindow(ctx.windowMinutes)
  const windowText = ctx.windowMinutes
    ? `${ctx.windowMinutes} minutes`
    : 'an unknown amount of time — assume about an hour'
  const current = ctx.currentItems?.length
    ? ctx.currentItems.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(nothing yet)'

  return `You are reshaping one work session on a creative project. The user has ${windowText}
and is about to start.

Project: "${ctx.title}"${ctx.dormancyDays >= 7 ? ` — it's been ${humanizeDuration(ctx.dormancyDays)} since the last session` : ''}
${ctx.identityLine ? `\n${ctx.identityLine}\n` : ''}
EVERYTHING KNOWN ABOUT THIS PROJECT:
${evidence.length
  ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing yet — the user has not said anything about this project)'}

That list is the whole of it. Anything not in it, you do not know.
The entries marked "already on the project" are the plan's steps, in the
order they're meant to be done.

${reasoningLicence(confidence)}

The list on screen right now:
${current}

The user says: "${ctx.instruction}"

Rewrite the list so it answers that. Keep whatever still works — don't
throw out items they didn't complain about. Up to ${count} items, sized to
${windowText}. Finishable, not aspirational: under-reach when unsure.

What you may do:
- Reorder, drop from today's list, or keep the steps that are already on
  the project. Dropping a step from today's list just leaves it for a
  later session -- it's still on the project.
- Split one step into the first piece of it that fits the time.
- Add exactly what they just asked for, citing "what you just said".
- Take a step off the project ENTIRELY, not just today's list, when
  they're plainly asking to be rid of it for good ("don't do that", "drop
  that from the plan", "I'm not doing the distribution plan"). Cite its
  evidence id in "remove". Only ever a step marked "already on the
  project" -- never a close-out, a note, or the finish line. Skipping a
  step for today is not the same as this; only use "remove" when they
  clearly mean gone, not "not now".
What you may not do:
- Invent a step. Every item cites the step it belongs to or the words they
  just said. If you can't cite it, you can't say it.
- Put a step before one it plainly depends on. "Peel the stencil off"
  cannot come before "cut the stencil".
- Name a tool, brand, format, setting, person or place that isn't word
  for word in the list above.
- Admin dressed as building: research, plan, outline, decide, list,
  consider, review, think about, set up, brainstorm, explore. If they used
  one of those words themselves, that's the INTENT — turn it into the
  concrete action it implies ("plan the riff" -> "try a few ideas for the
  riff").
- Repeat something the evidence says is already finished.
- Two items that say the same thing in different words.
- One line each. No sub-bullets, no time estimates, no explanation.

Also say, in one plain sentence, what exists at the end of the session if
the list lands ("done_looks_like").

Is there a real, physical setup step before they could start on THIS
session — connecting gear, laying out materials — that the evidence
above actually supports? Only then name it ("friction"), with rough
minutes. A made-up setup step is worse than none.

${PLAIN_ENGLISH_RULES}

Say the note has: "Next: fix the transition out of track two."
  BAD:  "Record a fresh guitar take with the SM57 while the click runs."
        — the notes say nothing about a guitar, a microphone or a click.
  GOOD: "Play track two from the top and find where the transition breaks."
        — cites the note, adds nothing that wasn't in it.

Say [e5] is "already on the project: write a distribution plan" and the
user says "no, don't do that, I'm not writing a distribution plan":
  GOOD: "remove": ["e5"] — they plainly want it gone, not skipped for now.
Say they instead say "not today, too much for an hour":
  GOOD: "remove": [] — that's asking to skip it this session, not delete
        it. Just leave it off "items".

Respond with JSON only:
{
  "items": [ { "text": "...", "evidence": ["e1"] } ],
  "done_looks_like": "...",
  "friction": { "text": "...", "minutes": 5 } | null,
  "remove": ["e5"]
}`
}

/**
 * The floor below which a reshaped list stops being a plan. Two grounded
 * items out of five means the model was guessing for the other three.
 */
export const MIN_TRUSTWORTHY_ITEMS = 2

export interface FrictionLine {
  text: string
  minutes: EstimateMinutes
}

export interface ShapeResult {
  items: GroundedItem[]
  /** What exists at the end of the sitting if the list lands. */
  doneLooksLike: string | null
  /** 'tasks' — the plan is the project's own next steps, verbatim.
   *  'split' — the next step was bigger than the window; this is the first
   *  piece of it. 'ai' — reshaped on the user's instruction. 'briefing' —
   *  the project's own steps, ordered and worded by the user's own exit
   *  note. 'derived' — nothing to plan from; a placeholder rather than an
   *  invention. */
  source: 'tasks' | 'split' | 'ai' | 'briefing' | 'derived'
  needsInput: string | null
  gap: Gap | null
  confidence: Confidence
  friction: FrictionLine | null
  /** Clearing away at the other end -- cleaning brushes, putting the gear
   *  back. Real minutes spent inside the window, so it is subtracted from
   *  the working time the same way setup is, and shown last rather than
   *  first. Null when the project genuinely doesn't need one. */
  packdown: FrictionLine | null
  /** Open steps beyond what was even considered, so the app can say so. */
  truncatedCount: number
  /** Steps planned onto the project first because its list was empty. */
  planned: number
  /** Set when the next step couldn't be started until something else was
   *  done, and the plan was changed to say so -- either a step moved up
   *  from further down the list, or one written in that was missing
   *  entirely. Said out loud, because it rewrote the plan. */
  unblocked: { text: string; before: string; added: boolean } | null
  /** Steps taken off the project for good on a reshape instruction --
   *  deleted from metadata.tasks, not just left out of today's session.
   *  Said out loud for the same reason `unblocked` is: this rewrote the
   *  permanent plan, not just what's on screen. Empty outside a reshape. */
  removed: { text: string }[]
}

const OPEN_TASK_LIMIT = 24

function shortDate(iso?: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
}

function toOpenSteps(allTasks: any[]): OpenStep[] {
  const notes = new Map<string, string>(
    allTasks
      .filter(t => t && typeof t.id === 'string' && typeof t.progress_note === 'string' && t.progress_note.trim())
      .map(t => [t.id, t.progress_note.trim()]),
  )
  return openTasksInOrder(allTasks, OPEN_TASK_LIMIT).map(t => ({ ...t, progressNote: notes.get(t.id) ?? null }))
}

/**
 * Generates the session, planning steps first when the list is empty.
 * Never invents to fill a window: the fallbacks are the real steps, and
 * below that, the one question that would let the app plan honestly.
 */
export async function shapeSession(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  windowMinutes: number | null,
  instruction?: string | null,
  currentItems?: string[],
): Promise<ShapeResult> {
  // Column list matters: `goal` is NOT a column on projects (what done
  // looks like lives in metadata.end_goal). Asking for one that doesn't
  // exist fails the whole select.
  const { data: project, error } = await supabase
    .from('projects')
    .select('title, description, metadata, slots, last_closeout_text, last_session_ended_at, last_active, created_at, embedding, heat_reason')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[session-shaper] project fetch failed:', error)
    throw new Error(error.message)
  }
  if (!project) throw new Error('Project not found')

  const metadata = project.metadata ?? {}
  let allTasks: any[] = Array.isArray(metadata.tasks) ? metadata.tasks : []

  // ── Already baked? Then this costs nothing ────────────────────────
  // An hour appears and the app has to be useful in the first two
  // seconds. A stored plan is served whole, above even the corpus
  // queries -- but only while it still matches what it was built from
  // (session-prebake.ts), and never on a reshape, where the user is
  // asking for something new by definition.
  if (!instruction) {
    const bake = readPrebake(metadata)
    if (isPrebakeFresh(bake, allTasks, project.last_closeout_text) && bake) {
      // A shorter window than the bake was built for just takes fewer
      // items off the front: they're already in priority order, so this
      // is a pure trim rather than a reason to re-shape.
      const room = itemCountForWindow(windowMinutes)
      const items = windowMinutes != null && windowMinutes < bake.windowMinutes
        ? bake.items.slice(0, room)
        : bake.items
      return {
        confidence: confidenceFor({
          endGoal: metadata.end_goal ?? null,
          endGoalSource: metadata.end_goal_source ?? null,
          description: project.description ?? null,
          lastCloseout: project.last_closeout_text ?? null,
          lastSessionEndedAt: project.last_session_ended_at ?? null,
          movedSessionCount: 0,
          doneTaskCount: allTasks.filter((t: any) => t?.done).length,
          openTaskCount: allTasks.filter((t: any) => t && !t.done).length,
          recentFragmentCount: 0,
          shapingChatTurns: 0,
        }),
        items,
        doneLooksLike: bake.doneLooksLike,
        source: bake.source,
        needsInput: null,
        gap: null,
        friction: bake.friction,
        packdown: bake.packdown,
        truncatedCount: bake.truncatedCount,
        planned: 0,
        unblocked: null,
        removed: [],
      }
    }
  }
  const goal: string | null = metadata.end_goal || project.description || null

  // Recent captures that connect to this project by meaning but never got
  // attached to it (fragments.ts only attaches above a 0.5 similarity bar,
  // and only to whichever single project scored highest) -- corpus recall,
  // reusing the same match_memories RPC and query shape memories.ts's own
  // similarity search already uses, just with the project's embedding as
  // the query vector instead of a memory's.
  const projectEmbedding = parseEmbedding(project.embedding)
  const recallEmbeddingStr = projectEmbedding ? `[${projectEmbedding.join(',')}]` : null

  const [{ data: fragmentRows }, { data: sessionRows }, recallRpc, { data: listItemRows }, { data: highlightRows }] = await Promise.all([
    supabase
      .from('fragments')
      .select('text, created_at, role, memory_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('sessions')
      .select('closeout_text, ended_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .not('closeout_text', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(5),
    recallEmbeddingStr
      ? supabase.rpc('match_memories', {
          query_embedding: recallEmbeddingStr,
          filter_user_id: userId,
          match_threshold: 0.4,
          match_count: 8,
        })
      : Promise.resolve({ data: [] as any[] }),
    // Identity signal: what they've recently added to a list and what
    // they've been highlighting, same shape project-ideas/gather.ts reads.
    // The freshest one sets ambient tone (`identityLine`); the handful
    // feeds the "while you're in there" spark (session-spark.ts).
    supabase
      .from('list_items')
      .select('content, created_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('article_highlights')
      .select('created_at, reading_queue!inner(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  // Never permanently attached (still visible next time via `fragments`
  // once/if it clears the threshold), so this is soft recall only -- drop
  // anything already covered by `fragments` above, and anything not recent.
  const attachedMemoryIds = new Set((fragmentRows || []).map((f: any) => f.memory_id).filter(Boolean))
  const twentyOneDaysAgo = Date.now() - 21 * 86_400_000
  const recalled = ((recallRpc as { data: any[] | null }).data || [])
    .filter((m: any) => m.id && !attachedMemoryIds.has(m.id))
    .filter((m: any) => m.created_at && new Date(m.created_at).getTime() > twentyOneDaysAgo)
    .slice(0, 3)
    .map((m: any) => ({ text: (m.body || m.title || '').trim(), date: shortDate(m.created_at) }))
    .filter(m => m.text)

  const dormancyDays = Math.floor(
    (Date.now() - new Date(project.last_active || project.created_at || Date.now()).getTime()) / 86_400_000,
  )

  // One line, freshest of the two sources, never both -- this is ambient
  // tone, not a digest (see buildReshapePrompt: never run through the
  // evidence/citation system, so it can't leak into a generated step).
  const identityCandidates: { text: string; ts: number }[] = []
  if (listItemRows?.[0]?.content) {
    identityCandidates.push({ text: listItemRows[0].content, ts: new Date(listItemRows[0].created_at).getTime() })
  }
  const highlightTitle = (highlightRows?.[0] as any)?.reading_queue?.title
  if (highlightTitle) {
    identityCandidates.push({ text: highlightTitle, ts: new Date((highlightRows![0] as any).created_at).getTime() })
  }
  identityCandidates.sort((a, b) => b.ts - a.ts)
  const identityLine = identityCandidates[0]
    ? `Just for tone, not something to plan around: they've recently been into "${identityCandidates[0].text}".`
    : null

  // The same material, but citable: what the week has actually been made
  // of, each entry carrying the plain phrase that will appear under the
  // spark as its receipt. Recent only -- a list item from March says
  // nothing about who's sitting down tonight.
  const fourteenDaysAgo = Date.now() - 14 * 86_400_000
  const weekSignals: WeekSignal[] = []
  const addSignal = (text: string, source: string, ts: number) => {
    if (!text?.trim() || ts < fourteenDaysAgo || weekSignals.length >= 8) return
    weekSignals.push({ id: `w${weekSignals.length + 1}`, label: source, text: text.trim(), source })
  }
  ;(listItemRows || []).forEach((r: any) => {
    if (r?.content) addSignal(r.content, `you added "${r.content}" to a list`, new Date(r.created_at).getTime())
  })
  ;(highlightRows || []).forEach((r: any) => {
    const t = r?.reading_queue?.title
    if (t) addSignal(t, `you've been reading "${t}"`, new Date(r.created_at).getTime())
  })
  // Captures that never landed on any project -- the half-asleep idea
  // that's been sitting in the corpus doing nothing.
  recalled.forEach(m => addSignal(m.text, 'a note of yours that never got filed', Date.now()))

  const pastCloseouts = (sessionRows || [])
    .filter(r => r.closeout_text && r.closeout_text !== project.last_closeout_text)
    .map(r => ({ text: r.closeout_text as string, date: shortDate(r.ended_at) }))

  const conversation: any[] = Array.isArray(metadata.conversation) ? metadata.conversation : []
  const shapingTurns = conversation
    .filter(t => t?.role === 'user' && typeof t.content === 'string')
    .slice(-6)
    .map(t => t.content.trim())
    .filter(Boolean)

  const fragments = (fragmentRows || [])
    .filter(f => f.text)
    .map(f => ({ text: f.text as string, date: shortDate(f.created_at), role: f.role as string | null }))

  // ── An empty plan gets planned, not padded ────────────────────────
  // The list is the golden source for a session. When it's spent, the
  // right move is to plan the next steps -- backwards from the finish line
  // when the user gave one, forwards from what the project is and where
  // it got to when they didn't -- once, here, so the session that follows
  // is made of real steps rather than of whatever a session-sized prompt
  // could invent.
  let planned = 0
  const openNow = allTasks.filter(t => t && !t.done && typeof t.text === 'string' && typeof t.id === 'string')
  if (openNow.length === 0 && !instruction) {
    const said = [
      project.last_closeout_text,
      ...pastCloseouts.map(c => c.text), ...shapingTurns, ...fragments.map(f => f.text),
    ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    const steps = metadata.end_goal
      ? await generateTaskSpine({
          title: project.title,
          endGoal: metadata.end_goal,
          said: [project.description, ...said].filter((t): t is string => !!t),
          existingSteps: [],
        })
      : await generateFirstCutTasks({
          title: project.title,
          description: project.description || '',
          said,
        })
    if (steps.length > 0) {
      const doneTasks = allTasks.filter(t => t?.done)
      allTasks = normalizeTaskOrder([...doneTasks, ...toStoredTasks(steps, new Date(), doneTasks.length)])
      planned = steps.length
      const { error: saveErr } = await supabase
        .from('projects')
        .update({ metadata: { ...metadata, tasks: allTasks, is_shaped: true } })
        .eq('id', projectId)
        .eq('user_id', userId)
      if (saveErr) console.warn('[session-shaper] could not save the new plan:', saveErr.message)
    }
  }

  const openTaskCountTotal = allTasks.filter(t => t && !t.done && typeof t.text === 'string' && typeof t.id === 'string').length
  const truncatedCount = Math.max(0, openTaskCountTotal - OPEN_TASK_LIMIT)
  const openTasks = toOpenSteps(allTasks)
  const doneTasks = allTasks
    .filter(t => t && t.done && typeof t.text === 'string')
    .slice(-6)
    .map(t => ({ text: t.text, date: shortDate(t.completed_at) }))

  const ctx: ShapeContext = {
    title: project.title,
    goal,
    windowMinutes,
    lastCloseout: project.last_closeout_text || null,
    openTasks,
    doneTasks,
    pastCloseouts,
    shapingTurns,
    fragments,
    recalled,
    dormancyDays,
    heatReason: project.heat_reason || null,
    identityLine,
    instruction,
    currentItems,
  }

  const ninetyDaysAgo = Date.now() - 90 * 86_400_000
  const confidence = confidenceFor({
    endGoal: metadata.end_goal ?? null,
    endGoalSource: metadata.end_goal_source ?? null,
    description: project.description ?? null,
    lastCloseout: project.last_closeout_text ?? null,
    lastSessionEndedAt: project.last_session_ended_at ?? null,
    movedSessionCount: pastCloseouts.length,
    doneTaskCount: doneTasks.length,
    openTaskCount: openTasks.length,
    recentFragmentCount: (fragmentRows || []).filter(
      f => f.created_at && new Date(f.created_at).getTime() > ninetyDaysAgo,
    ).length,
    shapingChatTurns: shapingTurns.length,
  })

  const { evidence, taskIdByEvidenceId } = buildEvidence(ctx)
  const base = { confidence, truncatedCount, planned, gap: null, needsInput: null, friction: null, packdown: null, unblocked: null, removed: [] as { text: string }[] }

  // ── Reshape: the user said what's wrong ───────────────────────────
  if (instruction) {
    const response = await generateText(buildReshapePrompt(ctx, evidence, confidence), {
      model: MODELS.SESSION_SHAPE_CHAT,
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 1400,
      // Without a cap, an uncapped thinking model can spend the entire
      // maxTokens budget reasoning before writing any JSON, leaving
      // nothing to parse. This is reorder/split/cite against a closed
      // list, not open-ended prose -- 'low' matches checkReady's own
      // choice for the same reason.
      thinkingLevel: 'low',
    })
    const parsed = JSON.parse(response)
    const cleaned = sanitizeRawItems(parsed?.items, itemCountForWindow(windowMinutes))
    const { kept, rejected } = filterGrounded(cleaned, evidence, project.title, taskIdByEvidenceId)
    if (rejected.length > 0) {
      console.warn(`[session-shaper] dropped ${rejected.length} ungrounded item(s) on reshape for ${projectId}:`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }
    // A step taken off the project entirely can't also stand as a session
    // item -- filtered out here regardless of whether the model also (or
    // instead) listed it in "items", since removal always wins.
    const removedTaskIds = sanitizeRemovals(parsed?.remove, taskIdByEvidenceId)
    const stepText = new Map(openTasks.map(t => [t.id, t.text.toLowerCase().trim()]))
    const items = dedupeSimilar(kept)
      .filter(k => !k.taskId || !removedTaskIds.includes(k.taskId))
      .map(k => ({
        ...k,
        partial: !!k.taskId && stepText.get(k.taskId) !== k.text.toLowerCase().trim(),
      }))
    // A removal legitimately shrinks how many items there could even be --
    // the backlog it's measured against has to be the post-removal count,
    // or taking the only other step off the project would look exactly
    // like the model failing to ground anything.
    const remainingOpenCount = openTasks.filter(t => !removedTaskIds.includes(t.id)).length
    if (items.length < MIN_TRUSTWORTHY_ITEMS && items.length < remainingOpenCount) {
      throw new Error("Couldn't make a list out of that.")
    }

    // Persisted for good, not just left off today's list -- deleted from
    // metadata.tasks outright rather than marked done, since a rejected
    // step was never finished and marking it done would surface as false
    // "you finished this" evidence later.
    let removed: { text: string }[] = []
    if (removedTaskIds.length > 0) {
      removed = openTasks.filter(t => removedTaskIds.includes(t.id)).map(t => ({ text: t.text }))
      const remainingTasks = allTasks.filter((t: any) => !(t && removedTaskIds.includes(t.id)))
      const { error: saveErr } = await supabase
        .from('projects')
        .update({ metadata: { ...metadata, tasks: remainingTasks } })
        .eq('id', projectId)
        .eq('user_id', userId)
      if (saveErr) console.warn('[session-shaper] could not save the removal:', saveErr.message)
    }

    const haystack = evidenceHaystack(evidence, project.title)
    return {
      ...base,
      items,
      doneLooksLike: sanitizeDoneLooksLike(parsed?.done_looks_like, haystack) ?? doneLineForSteps(items),
      source: 'ai',
      friction: sanitizeFriction(parsed?.friction, evidence, project.title),
      removed,
    }
  }

  // ── Nothing to plan from: ask, don't invent ───────────────────────
  if (openTasks.length === 0) {
    const gap = pickGap({
      title: project.title,
      endGoal: metadata.end_goal ?? null,
      lastCloseout: ctx.lastCloseout,
      openTaskCount: 0,
      unfilledSlots: (Array.isArray(project.slots) ? project.slots : [])
        .filter((sl: any) => !sl?.filled).map((sl: any) => sl?.name).filter(Boolean),
    })
    return {
      ...base,
      items: [{ text: `Open ${project.title} and look at where you left it.`, source: null, taskId: null }],
      doneLooksLike: null,
      source: 'derived',
      needsInput: gap?.question ?? genericGapQuestion(project.title),
      gap,
    }
  }

  // ── Can the next step actually be started? ────────────────────────
  // The list being in order doesn't mean nothing is missing from it. A
  // spine is a handful of steps for a whole project, so a real
  // prerequisite can simply never have been written down -- and sitting
  // down to a step you can't start is the worst thing a rare hour can
  // produce. When one is found, the PLAN changes, not just this session:
  // a step already further down moves up, and a missing one is written
  // in front of the step it blocks. Skipped when the step is already
  // part-done, which settles the question by itself.
  let steps = openTasks
  let unblocked: ShapeResult['unblocked'] = null
  // Set from the same checkReady call below -- true only when the top
  // step's own text plainly bundles more than one separately-schedulable
  // job. Independent of readiness, so it's read after the fact rather
  // than folded into the unblocked/reorder branch.
  let topCompound = false
  const top = steps[0]
  if (top && !top.progressNote) {
    const readiness = await checkReady({
      title: project.title,
      step: top,
      laterSteps: steps.slice(1),
      evidence,
    })
    topCompound = readiness.compound

    let nextTasks = normalizeTaskOrder(allTasks)
    let resized = false

    // Sizing is independent of the ready/blocked verdict -- a step can be
    // perfectly startable and still be wrongly sized. Corrects a stored
    // estimate that was never really set (openTasksInOrder's
    // DEFAULT_ESTIMATE_MINUTES fallback, session-budget.ts) or was set
    // too low against the model's own fresh read of this exact step
    // text -- never overwrites a deliberately-set number downward.
    const rawTop = nextTasks.find(t => t?.id === top.id) as any
    if (
      readiness.sizeMinutes != null && rawTop &&
      (!rawTop.estimate_set || readiness.sizeMinutes > (rawTop.estimated_minutes ?? 0))
    ) {
      nextTasks = nextTasks.map(t =>
        t?.id === top.id ? { ...t, estimated_minutes: readiness.sizeMinutes, estimate_set: true } : t,
      )
      resized = true
    }

    if (readiness.kind !== 'ready') {
      const now = new Date()
      const blockedAt = () => nextTasks.findIndex(t => t?.id === top.id)

      if (readiness.kind === 'move') {
        const from = nextTasks.findIndex(t => t?.id === readiness.taskId)
        if (from !== -1 && blockedAt() !== -1) {
          const [moved] = nextTasks.splice(from, 1)
          nextTasks.splice(blockedAt(), 0, moved)
          unblocked = { text: readiness.text, before: top.text, added: false }
        }
      } else {
        const at = blockedAt()
        nextTasks.splice(at === -1 ? 0 : at, 0, {
          id: `t-${now.getTime()}-pre`,
          text: readiness.item.text,
          done: false,
          created_at: now.toISOString(),
          order: 0,
          origin: 'session',
          source: readiness.item.source,
          estimated_minutes: readiness.minutes,
          estimate_set: true,
        })
        unblocked = { text: readiness.item.text, before: top.text, added: true }
      }
    }

    if (unblocked || resized) {
      allTasks = normalizeTaskOrder(nextTasks)
      steps = toOpenSteps(allTasks)
      const { error: saveErr } = await supabase
        .from('projects')
        .update({ metadata: { ...metadata, tasks: allTasks } })
        .eq('id', projectId)
        .eq('user_id', userId)
      if (saveErr) console.warn('[session-shaper] could not save the reordered plan:', saveErr.message)
    }
  }

  let setup: FrictionLine | null = readStoredFriction(metadata.setup)
  let packdown: FrictionLine | null = readStoredFriction(metadata.packdown)

  // ── One thing to try, from what the week has been made of ─────────
  // Appended last on any path, and only when the real work has left room
  // for it: the spark is the colour, never the spine. Skipped entirely on
  // a reshape (the user is steering; adding an uninvited idea mid-steer
  // is the app talking over them).
  const sparkFor = async (planned: GroundedItem[]): Promise<GroundedItem | null> => {
    if (weekSignals.length === 0 || planned.length >= itemCountForWindow(windowMinutes)) return null
    // Room is checked against the same working minutes everything else is
    // budgeted from, so a punt can never be what makes the hour overrun.
    if (windowMinutes != null) {
      const plannedMinutes = planned.reduce((total, i) => {
        const step = steps.find(st => st.id === i.taskId)
        return total + (step?.minutes ?? 0)
      }, 0)
      const left = (workingMinutes(windowMinutes, setup?.minutes, packdown?.minutes) ?? 0) - plannedMinutes
      if (left < sparkMinutesCap(windowMinutes)) return null
    }
    return sparkForSession({
      title: project.title,
      projectEvidence: evidence,
      weekSignals,
      currentItems: planned.map(i => i.text),
      windowMinutes,
    })
  }

  // ── What the hour is actually worth ───────────────────────────────
  // Setting up and clearing away are spent inside the window, not around
  // it. Read from the project first: needing the paint got out is a fact
  // about the project, not about tonight, so once it's known it's reused
  // rather than re-inferred (and re-charged for) every single session.
  const count = itemCountForWindow(windowMinutes)

  // ── The briefing: their own exit note, as this session's path ──────
  // Only when there's a real exit note to build on. Anything less and
  // this falls through to the verbatim list below, which is what shipped
  // before and is never worse than a thin briefing.
  if (isUsableExitNote(ctx.lastCloseout)) {
    const briefing = await briefSession({
      title: project.title,
      exitNote: ctx.lastCloseout as string,
      openSteps: steps.map(s => ({ id: s.id, text: s.text })),
      windowMinutes,
      maxItems: count,
      evidence,
      taskIdByEvidenceId,
      confidence,
      knownSetup: setup,
      knownPackdown: packdown,
    })
    if (briefing) {
      const learnedSetup = sanitizeFriction(briefing.rawSetup, evidence, project.title)
      const learnedPackdown = sanitizeFriction(briefing.rawPackdown, evidence, project.title)
      if (learnedSetup) setup = learnedSetup
      if (learnedPackdown) packdown = learnedPackdown
      await persistFriction(supabase, projectId, userId, metadata, setup, packdown)

      // The model was asked to under-reach and told the ceiling, but the
      // budget is the thing that actually has to hold: trim in order
      // against the minutes really available, using each item's own
      // source-step estimate.
      const minutesByTaskId = new Map(steps.map(s => [s.id, s.minutes]))
      const budgeted = selectByBudget(
        briefing.items.map(i => ({ item: i, minutes: minutesByTaskId.get(i.taskId as string) ?? 20 })),
        workingMinutes(windowMinutes, setup?.minutes, packdown?.minutes),
        count,
      )
      const items = budgeted.selected.map(b => b.item)
      const spark = await sparkFor(items)
      return {
        ...base, unblocked, friction: setup, packdown,
        items: spark ? [...items, spark] : items,
        doneLooksLike: briefing.doneLooksLike,
        source: 'briefing',
      }
    }
  }

  // ── The next steps, in order, as many as fit ──────────────────────
  const { selected, rest } = selectByBudget(
    steps, workingMinutes(windowMinutes, setup?.minutes, packdown?.minutes), count,
  )
  const first = selected[0]

  // The next step is bigger than the sitting -- either the numbers say so,
  // or checkReady already flagged it as bundling more than one job. The
  // compound flag matters on its own: nearestEstimate snaps to a ladder
  // topping out at 60, so a step judged "really more like 90 minutes"
  // still reads as exactly 60 after snapping and would tie (never split)
  // against a 60-minute window under strict `>` alone.
  const oversized = first && windowMinutes != null && first.minutes > windowMinutes
  const flaggedCompound = first && topCompound && first.id === top.id
  if (first && windowMinutes != null && (oversized || flaggedCompound)) {
    const split = await splitStep({
      title: project.title,
      step: first,
      progressNote: first.progressNote,
      windowMinutes,
      evidence,
    })
    if (split) {
      // A split is deliberately conservative (session-split.ts:
      // "Under-reach. Too small is fine; too big means stopping
      // mid-thing.") -- the right instinct against overcommitting one
      // step, but it means the moves alone often won't fill the window.
      // Top up the same way the plain task-list path does, but only when
      // there's genuinely nothing else real behind this step to save it
      // for (`rest.length === 0`) -- split's moves carry no numeric
      // estimate by design, so there's no exact minutes to hand the
      // top-up call; pass `null` and let it judge for itself.
      const splitTopUp = rest.length === 0
        ? await topUpSession({
            title: project.title,
            evidence,
            currentItems: split.moves.map(m => m.text),
            remainingMinutes: null,
            maxItems: Math.max(0, count - split.moves.length),
          })
        : []
      const splitItems = [...split.moves, ...splitTopUp]
      const splitSpark = await sparkFor(splitItems)
      return {
        ...base, unblocked, friction: setup, packdown,
        items: splitSpark ? [...splitItems, splitSpark] : splitItems,
        doneLooksLike: split.doneLooksLike ?? doneLineForSteps(split.moves),
        source: 'split',
      }
    }
  }

  const items: GroundedItem[] = selected.map(t => ({
    text: t.text,
    source: t.progressNote ? `last time: ${t.progressNote}` : 'already on the project',
    taskId: t.id,
    partial: false,
  }))

  // The real backlog ran out before the window did -- never when there's
  // real material left over (`rest.length === 0`), and never on top of an
  // oversized/compound step that already tried (and, here, failed) to
  // split: that's a "couldn't split" fallback, not "nothing left to draw
  // from", and topping THAT up would risk padding around a step that's
  // still genuinely too big rather than genuinely short a plan.
  if (rest.length === 0 && windowMinutes != null && !oversized && !flaggedCompound) {
    const remainingMinutes = (workingMinutes(windowMinutes, setup?.minutes, packdown?.minutes) ?? windowMinutes)
      - sumMinutes(selected)
    if (remainingMinutes >= 15) {
      const topUpItems = await topUpSession({
        title: project.title,
        evidence,
        currentItems: items.map(i => i.text),
        remainingMinutes,
        maxItems: Math.max(0, count - selected.length),
      })
      items.push(...topUpItems)
    }
  }

  const spark = await sparkFor(items)
  if (spark) items.push(spark)

  return {
    ...base, unblocked, friction: setup, packdown,
    items, doneLooksLike: doneLineForSteps(selected), source: 'tasks',
  }
}
