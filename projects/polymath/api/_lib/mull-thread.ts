/**
 * "Go further": the take on the card is one step of a thread, and the
 * person can pull it.
 *
 * A take used to be a dead end -- read, maybe tapped, gone in four days. Now
 * it can be followed: each press writes the next step from the steps before
 * it (and from what they said back, when they answered), adds one new true
 * thing from the world, and ends on a sharper open end. Measured on the
 * owner's corpus (Nov 2026), three steps from "zebras are a bit like dazzle
 * ships" went to horseflies and polarised light, then to Japanese farmers
 * painting stripes on cows; three from their replaced-people book idea went
 * to change blindness, Martin Guerre and Parfit on identity.
 *
 * Every step's fact is checked against the web (fact-check.ts), like a
 * nightly take's. A step is a new `sparks` row: `subject_kind = 'thread'`,
 * `subject_id` = the step before, so the chain is rebuilt by walking back.
 * The one before is marked answered -- pulling the thread is the opposite of
 * ignoring it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './plain-english.js'
import { checkFactSafely } from './fact-check.js'
import { SHELF_LIFE_HOURS } from './mull-generator.js'

const MODEL = 'gemini-flash-latest'
/** How many steps back the prompt sees. Enough to not repeat itself. */
export const THREAD_MEMORY = 6
/** One press, whole. Under the function ceiling with room to spare. */
const BUDGET_MS = 40_000

export interface ThreadStep { text: string }

export function threadPrompt(chain: string[], answer?: string, retryNote?: string): string {
  return `A curious friend is following one thread with someone, a line at a time. It started from something they said, in line 1.

THE THREAD SO FAR:
${chain.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${answer ? `\nWHAT THEY SAID BACK TO THE LAST STEP, in their words -- build on this, it matters more than anything above:\n"${answer}"\n` : ''}
Write THREE different candidates for the NEXT LINE, best first. Each is one plain, surprising fact that a curious person would not guess, found by pulling this thread${answer ? ', starting from what they just said' : ''}.
- Each candidate goes a different way: a different field, place or person. Not three versions of one fact.
- Do NOT answer the question the last line asks. If it wonders how many, or whether, leave that open. Open a door next to it instead, with something that makes the question stranger.
- One sentence, under 20 words, naming the specific thing (a person, place, year or experiment). Like: "Horseflies crash into the stripes and can't land." Then: "Japanese farmers painted stripes on cows, and fly bites halved."
- Not a general finding ("readers miss changes"). A named, concrete case.
- No question. No "you". No moral, no wondering, no "what if".
- Only facts you are certain are true; each is checked against the web. Encyclopedia wording, no absolutes ("halved", not "stopped").
- Never clever: no big ideas, no debunking. A fact about the thing itself.
- Every few lines, one may land back on something of theirs -- a note or a project -- in one plain line. Never force it.
- No advice, no tasks, nothing about their health or family.
${retryNote ? `- ${retryNote}\n` : ''}${PLAIN_ENGLISH_RULES}

JSON only: {"steps": [{"take": "the line", "outside": "the same fact, said plainly enough to check"}, {...}, {...}]}`
}

/** Pure: the model's answer, or null if it isn't usable. */
export function readStep(raw: unknown): { take: string; outside: string } | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const take = typeof r.take === 'string' ? r.take.trim() : ''
  const outside = typeof r.outside === 'string' ? r.outside.trim() : ''
  // One line: a fact, not a paragraph and not a question.
  const words = take.split(/\s+/).length
  if (!take || words < 4 || words > 28 || take.includes('?')) return null
  if (findVoiceViolations(take).length > 0) return null
  return { take, outside }
}

/** Pure: every usable candidate, in the model's order. Accepts the old single-step shape too. */
export function readSteps(raw: unknown): { take: string; outside: string }[] {
  const r = (raw ?? {}) as Record<string, unknown>
  const list = Array.isArray(r.steps) ? r.steps : [r]
  return list.map(readStep).filter((x): x is { take: string; outside: string } => x !== null).slice(0, 3)
}

interface SparkRow {
  id: string
  text: string
  project_id: string | null
  subject_id: string | null
  subject_kind: string | null
  sources: { kind: string; title: string; at?: string; url?: string }[] | null
  answered_at: string | null
}

/** The lines before this one, oldest first, for the card. Empty for a fresh take. */
export async function earlierLines(
  supabase: SupabaseClient, userId: string, spark: { text: string; subject_id?: string | null; subject_kind?: string | null },
): Promise<string[]> {
  if (spark.subject_kind !== 'thread' || !spark.subject_id) return []
  const chain = await loadChain(supabase, userId, spark as SparkRow)
  return chain.slice(0, -1)
}

/** The steps up to and including this one, oldest first. */
async function loadChain(supabase: SupabaseClient, userId: string, start: SparkRow): Promise<string[]> {
  const chain = [start.text]
  let at: SparkRow | null = start
  while (at && at.subject_kind === 'thread' && at.subject_id && chain.length < THREAD_MEMORY) {
    const { data }: { data: SparkRow[] | null } = await supabase.from('sparks')
      .select('id, text, project_id, subject_id, subject_kind, sources, answered_at')
      .eq('user_id', userId).eq('id', at.subject_id).limit(1) as never
    at = data?.[0] ?? null
    if (at) chain.unshift(at.text)
  }
  return chain
}

export type FurtherResult =
  | { ok: true; spark: Record<string, unknown> }
  | { ok: false; status: number; error: string; slow?: boolean }

export async function goFurther(
  supabase: SupabaseClient, userId: string, sparkId: string, answer?: string, trace: string[] = [],
): Promise<FurtherResult> {
  const deadline = Date.now() + BUDGET_MS
  const { data, error } = await supabase.from('sparks')
    .select('id, text, project_id, subject_id, subject_kind, sources, answered_at')
    .eq('user_id', userId).eq('id', sparkId).limit(1)
  if (error) return { ok: false, status: 500, error: error.message }
  const spark = (data as SparkRow[] | null)?.[0]
  if (!spark) return { ok: false, status: 404, error: 'take not found' }

  const chain = await loadChain(supabase, userId, spark)
  let step: { take: string; outside: string } | null = null
  let link: { title: string; url: string } | undefined
  let retryNote: string | undefined
  for (let attempt = 0; attempt < 2 && !step && deadline - Date.now() > 6_000; attempt++) {
    let raw: unknown
    try {
      raw = parseModelJson(await generateText(threadPrompt(chain, answer?.trim() || undefined, retryNote), {
        responseFormat: 'json', model: MODEL, maxTokens: 2048, thinkingLevel: 'low',
        timeoutMs: Math.min(15_000, deadline - Date.now() - 4_000),
      }))
    } catch (e) {
      trace.push(`draft failed: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    const candidates = readSteps(raw)
    if (!candidates.length) {
      trace.push('draft unusable')
      retryNote = 'Keep each under 28 words and in plain words.'
      continue
    }
    // Check every candidate at once: the wait is one check, not three, and a
    // failed fact no longer costs a whole new draft.
    const left = Math.max(1_000, deadline - Date.now() - 2_000)
    const checked = await Promise.all(candidates.map(async c => ({
      c, fact: c.outside ? await checkFactSafely(c.outside, left) : { verdict: 'unsure' as const, source: undefined },
    })))
    for (const { c, fact } of checked) trace.push(`fact ${fact.verdict}: ${(c.outside || c.take).slice(0, 80)}`)
    // Best first: the model's own order, among those that checked out.
    const win = checked.find(x => x.fact.verdict === 'true')
    if (win) {
      step = win.c
      link = win.fact.source
    } else {
      retryNote = `None of these held up: ${candidates.map(c => `"${c.outside}"`).join('; ')}. Use different facts.`
    }
  }
  if (!step) return { ok: false, status: 200, error: 'nothing held up', slow: true }

  // The origin stays with every step, so "from" still says where it started.
  const origin = (spark.sources ?? []).filter(x => x.kind !== 'link')
  const now = new Date()
  const row: Record<string, unknown> = {
    user_id: userId,
    type: 'mull',
    text: step.take,
    project_id: spark.project_id,
    subject_id: spark.id,
    subject_kind: 'thread',
    sources: [...origin, ...(link ? [{ kind: 'link', ...link }] : [])],
    shown_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SHELF_LIFE_HOURS * 3600_000).toISOString(),
  }
  const select = 'id, type, text, project_id, shown_at, answered_at, expires_at, sources, projects(title)'
  let ins = await supabase.from('sparks').insert(row).select(select)
  if (ins.error && (ins.error.code === '42703' || ins.error.code === 'PGRST204')) {
    const { sources: _s, ...bare } = row
    ins = await supabase.from('sparks').insert(bare).select(select.replace(', sources', ''))
  }
  if (ins.error) return { ok: false, status: 500, error: ins.error.message }

  if (!spark.answered_at) {
    await supabase.from('sparks').update({ answered_at: now.toISOString() }).eq('id', spark.id).eq('user_id', userId)
  }
  return { ok: true, spark: { ...(ins.data as Record<string, unknown>[])[0], earlier: chain } }
}
