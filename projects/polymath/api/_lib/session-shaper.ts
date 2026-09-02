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
 *   4. one line saying what "done today" looks like
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
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import {
  filterGrounded, evidenceHaystack, hasOnlyKnownSpecifics,
  type Evidence, type GroundedItem,
} from './session-grounding.js'
import { sanitizeRawItems, dedupeSimilar } from './session-items.js'
import { confidenceFor, reasoningLicence, type Confidence } from './session-confidence.js'
import { pickGap, genericGapQuestion, type Gap } from './session-gap.js'
import { openTasksInOrder, selectByBudget, type BudgetTask } from './session-budget.js'
import { nearestEstimate, type EstimateMinutes } from './session-estimate.js'
import { splitStep, doneLineForSteps, sanitizeDoneLooksLike } from './session-split.js'
import { checkReady } from './session-ready.js'
import { generateTaskSpine, generateFirstCutTasks, toStoredTasks } from './task-spine.js'
import { normalizeTaskOrder } from './task-order.js'

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
  /** What the user just said was wrong with the current list, if anything. */
  instruction?: string | null
  currentItems?: string[]
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

Project: "${ctx.title}"

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
- Reorder, drop, or keep the steps that are already on the project.
- Split one step into the first piece of it that fits the time.
- Add exactly what they just asked for, citing "what you just said".
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

Respond with JSON only:
{
  "items": [ { "text": "...", "evidence": ["e1"] } ],
  "done_looks_like": "...",
  "friction": { "text": "...", "minutes": 5 } | null
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
   *  piece of it. 'ai' — reshaped on the user's instruction. 'derived' —
   *  nothing to plan from; a placeholder rather than an invention. */
  source: 'tasks' | 'split' | 'ai' | 'derived'
  needsInput: string | null
  gap: Gap | null
  confidence: Confidence
  friction: FrictionLine | null
  /** Open steps beyond what was even considered, so the app can say so. */
  truncatedCount: number
  /** Steps planned onto the project first because its list was empty. */
  planned: number
  /** Set when the next step couldn't be started until something else was
   *  done, and the plan was changed to say so -- either a step moved up
   *  from further down the list, or one written in that was missing
   *  entirely. Said out loud, because it rewrote the plan. */
  unblocked: { text: string; before: string; added: boolean } | null
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
    .select('title, description, metadata, slots, last_closeout_text, last_session_ended_at')
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
  const goal: string | null = metadata.end_goal || project.description || null

  const [{ data: fragmentRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('fragments')
      .select('text, created_at, role')
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
  ])

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
  const base = { confidence, truncatedCount, planned, gap: null, needsInput: null, friction: null, unblocked: null }

  // ── Reshape: the user said what's wrong ───────────────────────────
  if (instruction) {
    const response = await generateText(buildReshapePrompt(ctx, evidence, confidence), {
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 1400,
    })
    const parsed = JSON.parse(response)
    const cleaned = sanitizeRawItems(parsed?.items, itemCountForWindow(windowMinutes))
    const { kept, rejected } = filterGrounded(cleaned, evidence, project.title, taskIdByEvidenceId)
    if (rejected.length > 0) {
      console.warn(`[session-shaper] dropped ${rejected.length} ungrounded item(s) on reshape for ${projectId}:`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }
    const stepText = new Map(openTasks.map(t => [t.id, t.text.toLowerCase().trim()]))
    const items = dedupeSimilar(kept).map(k => ({
      ...k,
      partial: !!k.taskId && stepText.get(k.taskId) !== k.text.toLowerCase().trim(),
    }))
    if (items.length < MIN_TRUSTWORTHY_ITEMS && items.length < openTasks.length) {
      throw new Error("Couldn't make a list out of that.")
    }
    const haystack = evidenceHaystack(evidence, project.title)
    return {
      ...base,
      items,
      doneLooksLike: sanitizeDoneLooksLike(parsed?.done_looks_like, haystack) ?? doneLineForSteps(items),
      source: 'ai',
      friction: sanitizeFriction(parsed?.friction, evidence, project.title),
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
  const top = steps[0]
  if (top && !top.progressNote) {
    const readiness = await checkReady({
      title: project.title,
      step: top,
      laterSteps: steps.slice(1),
      evidence,
    })
    if (readiness.kind !== 'ready') {
      const now = new Date()
      const nextTasks = [...normalizeTaskOrder(allTasks)]
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

      if (unblocked) {
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
  }

  // ── The next steps, in order, as many as fit ──────────────────────
  const count = itemCountForWindow(windowMinutes)
  const { selected } = selectByBudget(steps, windowMinutes, count)
  const first = selected[0]

  // The next step is bigger than the sitting: split it, once.
  if (first && windowMinutes != null && first.minutes > windowMinutes) {
    const split = await splitStep({
      title: project.title,
      step: first,
      progressNote: first.progressNote,
      windowMinutes,
      evidence,
    })
    if (split) {
      return { ...base, unblocked, items: split.moves, doneLooksLike: split.doneLooksLike ?? doneLineForSteps(split.moves), source: 'split' }
    }
  }

  const items: GroundedItem[] = selected.map(t => ({
    text: t.text,
    source: t.progressNote ? `last time: ${t.progressNote}` : 'already on the project',
    taskId: t.id,
    partial: false,
  }))
  return { ...base, unblocked, items, doneLooksLike: doneLineForSteps(selected), source: 'tasks' }
}
