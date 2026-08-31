/**
 * Session shaper — the two minutes of planning that buy the hour.
 *
 * The old pure `deriveSessionShapes` produced 1-3 mechanical items from the
 * last close-out and the empty slots. That's the right FALLBACK, but it
 * isn't a plan: a brand-new project got exactly one item, "Start it.",
 * which is not something anyone can work through.
 *
 * So the real list is written by a model against the project, its recent
 * fragments and the window you actually have, and can be reshaped by
 * saying what's wrong with it. Structure still does the thinking:
 *   - how many items is a function of the window, not the model's mood
 *   - the banned-verb list is enforced here, not hoped for in the prompt
 *   - anything the model returns is sanitised down to plain lines
 * The model only writes the sentences.
 *
 * Everything except `shapeSession` is pure, so the parts that decide what
 * a session looks like are unit-tested without a database or a model call.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { deriveSessionShapes, type SlotInput } from './session-shapes.js'
import { filterGrounded, type Evidence, type GroundedItem, type RawItem } from './session-grounding.js'
import { confidenceFor, reasoningLicence, type Confidence } from './session-confidence.js'
import { pickGap, genericGapQuestion, type Gap } from './session-gap.js'

/**
 * "3-6 depending on time." A 20-minute window that lists six things is
 * lying to you, and an hour with three is under-using the hour. These are
 * ceilings the model is told to hit, not suggestions.
 */
/**
 * Spares generated alongside the list. Swapping an item out has to be
 * instant — a model round-trip per "not that one" would spend a quarter
 * of the planning window on latency, and the whole point of the two
 * minutes is that they're cheap. So the shape call over-generates and the
 * extras sit on the bench.
 */
export const BENCH_SIZE = 3

export function itemCountForWindow(windowMinutes: number | null): number {
  if (windowMinutes == null) return 4
  if (windowMinutes <= 20) return 3
  if (windowMinutes <= 45) return 4
  if (windowMinutes <= 75) return 5
  return 6
}

/**
 * Admin disguised as build (CLAUDE.md's anti-pattern). A session item has
 * to be something you DO to the work, not something you decide about it.
 * Checked after generation because the model agrees to this in the prompt
 * and then does it anyway.
 */
const ADMIN_VERBS = [
  'research', 'plan', 'outline', 'decide', 'list', 'consider', 'review',
  'think about', 'set up', 'organise', 'organize', 'brainstorm', 'explore',
  'reflect on', 'assess', 'evaluate', 'identify', 'define',
]

export function isAdminItem(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/^[-*\d.\s)]+/, '')
  return ADMIN_VERBS.some(v => t.startsWith(v + ' ') || t === v)
}

/**
 * Model output → a list you can put on screen. Strips bullet/number
 * prefixes, drops blanks, near-duplicates and admin items, trims anything
 * long enough to need re-reading mid-session, and caps at the count the
 * window allows.
 */
/**
 * The sanitised pool split into what's on screen and what's held back.
 * Deliberately a pure function of the pool, so the bench can never
 * contain something already in the list.
 */
export function splitBench<T>(pool: T[], count: number): { items: T[]; bench: T[] } {
  return { items: pool.slice(0, count), bench: pool.slice(count) }
}

export function sanitizeRawItems(raw: unknown, count: number): RawItem[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: RawItem[] = []
  for (const entry of raw) {
    // Tolerate a bare string as well as the {text, evidence} shape -- an
    // uncited item is still checkable, it just has to survive on having no
    // specifics in it at all.
    const rawText = typeof entry === 'string' ? entry : entry?.text
    if (typeof rawText !== 'string') continue
    const text = rawText.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
    if (!text) continue
    if (text.length > 120) continue
    if (isAdminItem(text)) continue
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    const evidence = Array.isArray(entry?.evidence)
      ? entry.evidence.filter((x: unknown): x is string => typeof x === 'string')
      : undefined
    out.push({ text, evidence })
    if (out.length >= count) break
  }
  return out
}

/** Text-only view, for callers that just need clean lines (the agreed list
 *  posted back at session start). */
export function sanitizeItems(raw: unknown, count: number): string[] {
  return sanitizeRawItems(raw, count).map(i => i.text)
}

export interface ShapeContext {
  title: string
  goal: string | null
  windowMinutes: number | null
  lastCloseout: string | null
  openTasks: string[]
  /** Finished work, with when it was finished. Reasoning backwards from
   *  the goal is impossible without knowing what's already done, and this
   *  was being filtered out before the model ever saw it. */
  doneTasks: { text: string; date: string | null }[]
  /** Every close-out, not just the newest -- projects.last_closeout_text
   *  is overwritten each session, so the history only exists in `sessions`. */
  pastCloseouts: { text: string; date: string | null }[]
  /** What the user said when the project was first shaped in the chat.
   *  Their turns only: the app's own prose is not evidence. */
  shapingTurns: string[]
  /** Recent captures, newest first, with the date they were made. */
  fragments: { text: string; date: string | null; role?: string | null }[]
  slots: SlotInput[]
  /** What the user just said was wrong with the current list, if anything. */
  instruction?: string | null
  currentItems?: string[]
}

/**
 * Everything the app actually knows about this project, numbered so the
 * model can point at what it used and the result can be checked against
 * it. Nothing outside this list is knowledge — it's invention.
 */
export function buildEvidence(ctx: ShapeContext): Evidence[] {
  const evidence: Evidence[] = []
  let n = 0
  const add = (label: string, text: string) => {
    if (!text?.trim()) return
    evidence.push({ id: `e${++n}`, label, text: text.trim() })
  }

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
  ctx.openTasks.forEach(t => add('already on the project', t))
  ctx.shapingTurns.forEach(t => add('from when you set this project up', t))

  // Slots are deliberately NOT evidence. They're seeded by a model
  // (slot-seed.ts), so counting them made a project the user has never
  // described look like one the app knows -- which is precisely the
  // condition under which it starts inventing.
  return evidence
}

export function buildShapePrompt(
  ctx: ShapeContext,
  evidence: Evidence[],
  confidence: Confidence = 'partial',
): string {
  const count = itemCountForWindow(ctx.windowMinutes)
  const total = count + BENCH_SIZE
  const windowText = ctx.windowMinutes
    ? `${ctx.windowMinutes} minutes`
    : 'an unknown amount of time — assume about an hour'

  const reshaping = ctx.instruction && ctx.currentItems?.length
    ? `
You already gave this list:
${ctx.currentItems.map((t, i) => `${i + 1}. ${t}`).join('\n')}

The user says: "${ctx.instruction}"

Rewrite the list so it answers that. Keep whatever still works — don't
throw out items they didn't complain about.
`
    : ''

  return `You are shaping one work session on a creative project. The user has ${windowText}
and is about to start.

Project: "${ctx.title}"

EVERYTHING KNOWN ABOUT THIS PROJECT:
${evidence.length
  ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing yet — the user has not said anything about this project)'}

That list is the whole of it. Anything not in it, you do not know.

${reasoningLicence(confidence)}
${reshaping}
Give ${total} things to do. The FIRST ${count} are the session, in order. The
last ${BENCH_SIZE} are spares — same quality, different angles, ready to swap in
if one of the first ${count} doesn't suit today. Don't mark them; just order
them that way.

THE RULE THAT MATTERS MOST — never invent a detail:
- No tools, gear, brands, model numbers, file formats, settings, tempos,
  keys, instruments, people or place names unless they appear verbatim
  above. If the notes never mention a guitar, this project has no guitar.
- Do not guess how they work. You do not know what software they use, what
  they record with, or what stage anything is at, unless it says so above.
- Every item that refers to anything specific must cite the evidence ids it
  comes from. If you cannot cite it, you cannot say it.
- An item that asserts nothing beyond the project's own name needs no
  citation. "Open it and play it back from the start" is always allowed.
- Vague and true beats specific and invented. If you only know a little,
  give a short list of things that are certainly real. Fewer honest items
  is the correct answer, not a failure.

Rules for the list:
- The first item is an ignition move: physical, trivial, under two minutes.
  Starting must be easier than deliberating.
- Every other item is a real move against the work — something exists
  afterwards that didn't before.
- BANNED, this is admin pretending to be building: research, plan, outline,
  decide, list, consider, review, think about, set up, brainstorm, explore.
- Size the first ${count} to ${windowText}. Finishable, not aspirational.
- One line each. No sub-bullets, no time estimates, no explanation.

${PLAIN_ENGLISH_RULES}

Say the note has: "Next: fix the transition out of track two."
  BAD:  "Record a fresh guitar take with the SM57 while the click runs."
        — the notes say nothing about a guitar, a microphone or a click.
        Every one of those is made up, and one made-up detail means they
        have to check the whole list themselves.
  GOOD: "Play track two from the top and find where the transition breaks."
        — cites the note, adds nothing that wasn't in it.

Respond with JSON only:
{ "items": [ { "text": "...", "evidence": ["e1"] } ] }`
}

/**
 * The floor below which a list stops being a plan. Two grounded items out
 * of five means the model was guessing for the other three, and showing
 * them anyway is what destroys trust in the two that were real.
 */
const MIN_TRUSTWORTHY_ITEMS = 3

export interface ShapeResult {
  items: GroundedItem[]
  bench: GroundedItem[]
  source: 'ai' | 'derived'
  /** Set when the app doesn't know enough to fill a session honestly. The
   *  right move then is to ask, not to invent — and the answer is filed as
   *  the thing it is, so it fixes the project rather than this one session. */
  needsInput: string | null
  /** What kind of answer the question is fishing for, so the API knows
   *  where to put it. Null when the question is the generic fallback. */
  gap: Gap | null
  confidence: Confidence
}

/**
 * Generates the list, falling back to the pure derivation if the model is
 * unavailable or gives nothing usable. The fallback matters more than
 * usual here: this sits at the top of a rare hour, and "the AI is down"
 * must never mean "you can't start."
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
  // exist fails the whole select, which is how this returned "Project not
  // found" for projects that plainly exist.
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

  const slots: SlotInput[] = Array.isArray(project.slots) ? project.slots : []
  const allTasks: any[] = Array.isArray(project.metadata?.tasks) ? project.metadata.tasks : []
  const shortDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null

  const openTasks: string[] = allTasks
    .filter(t => t && !t.done && typeof t.text === 'string')
    .slice(0, 6)
    .map(t => t.text)

  // Finished work was being filtered out entirely, which made "the intro's
  // done, so the transition is next" impossible to say even when it was
  // plainly true. It's the other half of knowing where a project is.
  const doneTasks = allTasks
    .filter(t => t && t.done && typeof t.text === 'string')
    .slice(-6)
    .map(t => ({ text: t.text, date: shortDate(t.completed_at) }))

  const [{ data: fragmentRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('fragments')
      .select('text, created_at, role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    // projects.last_closeout_text is overwritten every session, so the
    // record of what actually happened over time only exists here.
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
    // The newest one is already in projects.last_closeout_text; don't say
    // the same sentence to the model twice under two different labels.
    .filter(r => r.closeout_text && r.closeout_text !== project.last_closeout_text)
    .map(r => ({ text: r.closeout_text as string, date: shortDate(r.ended_at) }))

  // The project's shaping chat: the user's turns only. The app's own prose
  // is not evidence about the project, it's evidence about the app.
  const conversation: any[] = Array.isArray(project.metadata?.conversation)
    ? project.metadata.conversation
    : []
  const shapingTurns = conversation
    .filter(t => t?.role === 'user' && typeof t.content === 'string')
    .slice(-6)
    .map(t => t.content.trim())
    .filter(Boolean)

  const ctx: ShapeContext = {
    title: project.title,
    goal: project.metadata?.end_goal || project.description || null,
    windowMinutes,
    lastCloseout: project.last_closeout_text || null,
    openTasks,
    doneTasks,
    pastCloseouts,
    shapingTurns,
    fragments: (fragmentRows || [])
      .filter(f => f.text)
      .map(f => ({ text: f.text, date: shortDate(f.created_at), role: f.role })),
    slots,
    instruction,
    currentItems,
  }

  const ninetyDaysAgo = Date.now() - 90 * 86_400_000
  const confidence = confidenceFor({
    endGoal: project.metadata?.end_goal ?? null,
    endGoalSource: project.metadata?.end_goal_source ?? null,
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

  const evidence = buildEvidence(ctx)
  const count = itemCountForWindow(windowMinutes)
  const gap = pickGap({
    title: project.title,
    endGoal: ctx.goal,
    lastCloseout: ctx.lastCloseout,
    openTaskCount: openTasks.length,
    unfilledSlots: slots.filter(sl => !sl.filled).map(sl => sl.name).filter(Boolean),
  })
  const ask = (): string => gap?.question ?? genericGapQuestion(project.title)

  // Nothing known means nothing to say. Inventing a plan here is exactly
  // what cost this feature its credibility, so ask instead — and let the
  // answer be the thing that makes next time better.
  // Nothing known means nothing to say, and there's no point spending a
  // model call to find that out.
  if (evidence.length === 0 || confidence === 'thin') {
    return {
      items: [{ text: `Open ${project.title} and look at where you left it.`, source: null }],
      bench: [],
      source: 'derived',
      needsInput: ask(),
      gap,
      confidence,
    }
  }

  try {
    const response = await generateText(buildShapePrompt(ctx, evidence, confidence), {
      responseFormat: 'json',
      // Low: this is a reporting task over a fixed evidence list, not a
      // creative one. High temperature here reads as confident invention.
      temperature: 0.3,
      maxTokens: 1600,
    })

    const raw = JSON.parse(response)?.items
    const cleaned = sanitizeRawItems(raw, count + BENCH_SIZE)
    const { kept, rejected } = filterGrounded(cleaned, evidence, project.title)

    if (rejected.length > 0) {
      console.warn(
        `[session-shaper] dropped ${rejected.length} ungrounded item(s) for ${projectId}:`,
        rejected.map(r => `"${r.text}" — ${r.reason}`),
      )
    }

    if (kept.length >= MIN_TRUSTWORTHY_ITEMS) {
      const { items, bench } = splitBench(kept, count)
      return { items, bench, source: 'ai', needsInput: null, gap: null, confidence }
    }

    // Not enough survived. Show what did — those are real — and ask for
    // the rest rather than padding with things that aren't.
    return { items: kept, bench: [], source: 'ai', needsInput: ask(), gap, confidence }
  } catch (e) {
    console.error('[session-shaper] generation failed, falling back:', e)
  }

  const derived = deriveSessionShapes({
    lastClosingText: ctx.lastCloseout,
    slots,
    mvsMinutes: null,
    windowMinutes,
  })
  return {
    items: derived.map(sh => ({ text: sh.text, source: null })),
    bench: [],
    source: 'derived',
    needsInput: null,
    gap: null,
    confidence,
  }
}
