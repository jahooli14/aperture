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

/**
 * "3-6 depending on time." A 20-minute window that lists six things is
 * lying to you, and an hour with three is under-using the hour. These are
 * ceilings the model is told to hit, not suggestions.
 */
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
export function sanitizeItems(raw: unknown, count: number): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const text = entry.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
    if (!text) continue
    if (text.length > 120) continue
    if (isAdminItem(text)) continue
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= count) break
  }
  return out
}

export interface ShapeContext {
  title: string
  goal: string | null
  windowMinutes: number | null
  lastCloseout: string | null
  openTasks: string[]
  fragments: string[]
  slots: SlotInput[]
  /** What the user just said was wrong with the current list, if anything. */
  instruction?: string | null
  currentItems?: string[]
}

export function buildShapePrompt(ctx: ShapeContext): string {
  const count = itemCountForWindow(ctx.windowMinutes)
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
and is about to start. Give them exactly ${count} things to do, in order.

Project: "${ctx.title}"${ctx.goal ? `\nWhat done looks like: ${ctx.goal}` : ''}
${ctx.lastCloseout ? `\nWhere they left off last time, in their words: "${ctx.lastCloseout}"` : '\nThey have not had a session on this yet.'}
${ctx.openTasks.length ? `\nOpen tasks already on the project:\n${ctx.openTasks.map(t => `- ${t}`).join('\n')}` : ''}
${ctx.fragments.length ? `\nRecent things they captured about it:\n${ctx.fragments.map(t => `- "${t}"`).join('\n')}` : ''}
${ctx.slots.filter(s => !s.filled).length ? `\nStill undecided on this project: ${ctx.slots.filter(s => !s.filled).map(s => s.name).join(', ')}` : ''}
${reshaping}
Rules for the list:
- The first item is an ignition move: physical, trivial, done in under two
  minutes. "Open the project and read the last thing you wrote." Starting
  must be easier than deliberating.
- Every other item is a real move against the work: cut, write, record,
  drill, mix, send, commit, phone, drive. Something exists afterwards that
  didn't before.
- BANNED — this is admin pretending to be building: research, plan, outline,
  decide, list, consider, review, think about, set up, brainstorm, explore.
  If an item starts with one of those, it isn't a session item. Rewrite it
  as the thing you'd actually do.
- Size the whole list to ${windowText}. It should be finishable, not
  aspirational.
- One line each. No sub-bullets, no time estimates, no explanation.

${PLAIN_ENGLISH_RULES}

Bad: "Review the vocal mix notes and consider your distribution options."
Good: "Bounce the vocal at -3dB and listen back on the phone speaker."

Respond with JSON only: { "items": ["...", "..."] }`
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
): Promise<{ items: string[]; source: 'ai' | 'derived' }> {
  const { data: project } = await supabase
    .from('projects')
    .select('title, description, goal, metadata, slots, last_closeout_text')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) throw new Error('Project not found')

  const slots: SlotInput[] = Array.isArray(project.slots) ? project.slots : []
  const openTasks: string[] = (project.metadata?.tasks || [])
    .filter((t: any) => t && !t.done && typeof t.text === 'string')
    .slice(0, 6)
    .map((t: any) => t.text)

  const { data: fragmentRows } = await supabase
    .from('fragments')
    .select('text')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  const ctx: ShapeContext = {
    title: project.title,
    goal: project.goal || project.description || null,
    windowMinutes,
    lastCloseout: project.last_closeout_text || null,
    openTasks,
    fragments: (fragmentRows || []).map(f => f.text).filter(Boolean),
    slots,
    instruction,
    currentItems,
  }

  const count = itemCountForWindow(windowMinutes)

  try {
    const response = await generateText(buildShapePrompt(ctx), {
      responseFormat: 'json',
      temperature: 0.8,
      maxTokens: 1200,
    })
    const items = sanitizeItems(JSON.parse(response)?.items, count)
    // Two survivors isn't a session plan, it's a coin flip — fall through
    // to the derivation rather than showing a list that looks broken.
    if (items.length >= 3) return { items, source: 'ai' }
  } catch (e) {
    console.error('[session-shaper] generation failed, falling back:', e)
  }

  const derived = deriveSessionShapes({
    lastClosingText: ctx.lastCloseout,
    slots,
    mvsMinutes: null,
    windowMinutes,
  })
  return { items: derived.map(s => s.text), source: 'derived' }
}
