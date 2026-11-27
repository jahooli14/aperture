/**
 * The parts of a project you tick off: "Chapter 1" ... "Chapter 12",
 * "Final pass". Owner's ask (Nov 2026): the novel had moved on a lot and
 * none of it was in the app -- chapter 1 rewritten in their own voice,
 * eleven to go, then one final pass. The app could see none of that.
 *
 * Kept in `metadata.parts` (server-owned, so a stale device can't wipe it).
 * Tick by hand on the project page, or just say it: an Update like
 * "finished chapter 4" ticks Chapter 4 (`partsFromSaid`, pure + tested).
 * Never a count on the home card -- a number there is pressure, and the
 * only number the app shows is days touched.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Part { id: string; label: string; done: boolean; at?: string }

export const MAX_PARTS = 60

export function readParts(metadata: unknown): Part[] {
  const raw = (metadata as { parts?: unknown } | null)?.parts
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is Part => !!p && typeof (p as Part).id === 'string' && typeof (p as Part).label === 'string')
    .map(p => ({ id: p.id, label: p.label, done: !!p.done, ...(p.at ? { at: p.at } : {}) }))
}

/** New labels, keeping the tick on any label that was already there. Pure. */
export function withLabels(current: Part[], labels: string[]): Part[] {
  const clean = labels.map(l => l.trim().slice(0, 80)).filter(Boolean).slice(0, MAX_PARTS)
  const byLabel = new Map(current.map(p => [p.label.toLowerCase(), p]))
  let n = Math.max(0, ...current.map(p => Number(p.id.replace(/\D/g, '')) || 0))
  return clean.map(label => byLabel.get(label.toLowerCase()) ?? { id: `p${++n}`, label, done: false })
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const DONE = /\b(finish(ed)?|done|complete(d)?|rewr(ote|itten)|wrapped( up)?|got through|polished|nailed|sorted|ticked off|in my voice)\b/i
const NOT_DONE = /\b(not|n't|nearly|almost|half(way)?|start(ed|ing)?|begin|began|working on|next|tomorrow|yet|still to)\b/i

function numberIn(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word)
  const i = NUMBER_WORDS.indexOf(word.toLowerCase())
  return i > 0 ? i : null
}

/**
 * The ids of the parts a sentence says are done. Clause by clause, so
 * "finished chapter 4, starting chapter 5" ticks only 4; ranges
 * ("chapters 2 to 4") and pairs ("chapters 2 and 3") count. Pure.
 */
export function partsFromSaid(text: string, parts: Part[]): string[] {
  const out = new Set<string>()
  const numbered = parts.map(p => {
    const m = p.label.match(/^(.*?)\s*(\d+)$/)
    return m ? { p, word: m[1].trim().toLowerCase(), n: Number(m[2]) } : { p, word: null, n: null }
  })
  for (const clause of text.split(/[.;!?]|,|\bbut\b|\bthen\b/i)) {
    if (!DONE.test(clause) || NOT_DONE.test(clause)) continue
    const lower = clause.toLowerCase()
    for (const { p, word, n } of numbered) {
      if (word !== null && n !== null) {
        const re = new RegExp(`\\b${word.replace(/[^a-z]/g, '')}s?\\s+([a-z0-9]+)(?:\\s*(?:to|-|–|through|and|&)\\s*([a-z0-9]+))?`, 'gi')
        for (const m of lower.matchAll(re)) {
          const a = numberIn(m[1]); const b = m[2] ? numberIn(m[2]) : null
          if (a === null) continue
          const hi = b !== null && /\band\b|&/.test(m[0]) ? null : b
          if (n === a || (b !== null && n === b) || (hi !== null && n >= a && n <= hi)) out.add(p.id)
        }
      } else {
        const words = p.label.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        if (words.length && words.every(w => lower.includes(w))) out.add(p.id)
      }
    }
  }
  return parts.filter(p => out.has(p.id) && !p.done).map(p => p.id)
}

/** One plain line for the prompts: what's done and what isn't. Pure. */
export function partsLine(parts: Part[]): string {
  if (parts.length === 0) return ''
  const done = parts.filter(p => p.done).map(p => p.label)
  const todo = parts.filter(p => !p.done).map(p => p.label)
  return `Done: ${done.join(', ') || 'nothing yet'}. Still to do: ${todo.join(', ') || 'nothing'}.`
}

async function write(supabase: SupabaseClient, userId: string, projectId: string, change: (parts: Part[]) => Part[]): Promise<Part[]> {
  const { data, error } = await supabase.from('projects').select('metadata').eq('id', projectId).eq('user_id', userId).single()
  if (error || !data) throw new Error(error?.message ?? 'project not found')
  const metadata = (data.metadata as Record<string, unknown>) ?? {}
  const before = readParts(metadata)
  const parts = change(before)
  // Nothing changed: don't rewrite the whole metadata blob from a read that
  // may already be stale (an Update with no ticks used to do this every time).
  if (JSON.stringify(before) === JSON.stringify(parts)) return parts
  const { error: upErr } = await supabase.from('projects').update({ metadata: { ...metadata, parts } }).eq('id', projectId).eq('user_id', userId)
  if (upErr) throw new Error(upErr.message)
  return parts
}

export const setPartLabels = (s: SupabaseClient, u: string, p: string, labels: string[]) =>
  write(s, u, p, current => withLabels(current, labels))

export const tickPart = (s: SupabaseClient, u: string, p: string, id: string, done: boolean) =>
  write(s, u, p, current => current.map(x => (x.id === id ? { ...x, done, ...(done ? { at: new Date().toISOString() } : {}) } : x)))

/** After an Update: tick whatever it says is done. Returns the labels ticked. */
export async function tickFromSaid(s: SupabaseClient, u: string, p: string, text: string): Promise<string[]> {
  let ticked: string[] = []
  await write(s, u, p, current => {
    const ids = new Set(partsFromSaid(text, current))
    ticked = current.filter(x => ids.has(x.id)).map(x => x.label)
    const at = new Date().toISOString()
    return current.map(x => (ids.has(x.id) ? { ...x, done: true, at } : x))
  })
  return ticked
}
