/**
 * The picture of the person: the 6-8 lines they keep coming back to without
 * saying so, each backed by the notes, list items, projects and answers that
 * show it. Rebuilt nightly, so every capture can start a line, strengthen one
 * or join two -- the more they feed it, the more it knows. Everything that
 * gives back (the daily question, Suggest a project) reads it.
 *
 * Grounded like a take: every row a line cites must exist, a line needs
 * three rows from two kinds of place, and its dates are worked out from the
 * rows in code, never taken from the model. Names stay steady between
 * rebuilds (the old lines are handed back), so the "What it knows" page
 * fills up rather than reshuffling.
 *
 * Stored in user_settings.portrait (20261116_portrait.sql). Until that is
 * run, the bake rebuilds it each night and keeps it for that run only.
 */

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './plain-english.js'
import { loadCorpus, type Corpus, type CorpusRow } from './mull-corpus.js'
import { MODELS } from './models.js'

// Rebuilt overnight, nobody waiting: the slower, sharper tier.
const MODEL = MODELS.QUALITY
export const MIN_ROWS = 3
export const MAX_LINES = 8
/** Rebuilt at most this often. */
export const REBUILD_HOURS = 20

export interface LineRow { kind: string; id: string; title: string; at?: string }
export interface PortraitLine {
  name: string
  rows: LineRow[]
  first?: string
  last?: string
}
export interface Portrait {
  lines: PortraitLine[]
  built_at: string
  /** Fingerprint of what the lines were read from (portraitInputHash). Lets a
   *  night with nothing new skip the model call. Absent on older pictures. */
  input_hash?: string
}

/** What the model would be shown, boiled down. Same text and same corrections
 *  give the same lines to within noise, so there is nothing to pay for. The
 *  corpus text carries absolute dates only, so it does not drift by itself. */
export function portraitInputHash(corpusText: string, corrections: string): string {
  return createHash('sha1').update(corpusText).update('\u0000').update(corrections).digest('hex').slice(0, 16)
}

export function portraitPrompt(corpusText: string, previous: PortraitLine[], corrections: string): string {
  return `Below is everything one person has put into their notebook. Each row has a ref and a date.

${corpusText}
${corrections ? `\nTHEY HAVE CORRECTED US BEFORE (trust these over the notes):\n${corrections}\n` : ''}${previous.length ? `\nTHE LINES YOU FOUND LAST TIME -- keep a line's name if it still holds, add rows to it, drop it only if nothing backs it now:\n${previous.map(l => `- ${l.name}`).join('\n')}\n` : ''}
Find the ${MAX_LINES - 2} to ${MAX_LINES} things they keep coming back to without saying so -- the picture a friend would have after reading all of it.
- "name": what it is, under 8 words, plain and specific ("people quietly swapped for someone else"). Never a theme word alone ("memory", "identity").
- "refs": EVERY ref that shows it, across projects, notes, answers and lists. At least ${MIN_ROWS}, from at least two different kinds of place.
- Never about their health, family worries, drink or money. Never a verdict on their character.
${PLAIN_ENGLISH_RULES}

JSON only: { "lines": [ { "name": "", "refs": ["N12"] } ] }`
}

const refOf = (r: string) => r.replace(/[[\]\s]/g, '')

/** Pure: the model's lines, kept only where the rows hold up. */
export function groundLines(raw: unknown, corpus: Corpus): PortraitLine[] {
  const list = (raw as { lines?: unknown })?.lines
  if (!Array.isArray(list)) return []
  const out: PortraitLine[] = []
  for (const l of list) {
    const name = typeof l?.name === 'string' ? l.name.trim() : ''
    if (!name || name.split(/\s+/).length > 10 || findVoiceViolations(name).length) continue
    const rows: CorpusRow[] = []
    for (const r of Array.isArray(l?.refs) ? l.refs : []) {
      const row = typeof r === 'string' ? corpus.byRef.get(refOf(r)) : undefined
      if (row && !rows.some(x => x.captureId === row.captureId)) rows.push(row)
    }
    const kinds = new Set(rows.map(r => (r.kind === 'fragment' ? 'memory' : r.kind)))
    if (rows.length < MIN_ROWS || kinds.size < 2) continue
    const dates = rows.map(r => r.at).filter((d): d is string => !!d).sort()
    out.push({
      name,
      rows: rows.map(r => ({ kind: r.kind, id: r.id, title: r.title || r.text.slice(0, 60), at: r.at })),
      first: dates[0],
      last: dates[dates.length - 1],
    })
  }
  return out.sort((a, b) => b.rows.length - a.rows.length).slice(0, MAX_LINES)
}

export async function loadPortrait(supabase: SupabaseClient, userId: string): Promise<Portrait | null> {
  const { data, error } = await supabase.from('user_settings').select('portrait').eq('user_id', userId).limit(1)
  if (error) return null
  const p = (data as { portrait?: Portrait | null }[] | null)?.[0]?.portrait
  return p && Array.isArray(p.lines) ? p : null
}

/** Rebuilds the picture from the whole corpus, answers included. Never throws. */
export async function buildPortrait(
  supabase: SupabaseClient, userId: string, opts: { corrections?: string; trace?: string[]; timeoutMs?: number; force?: boolean } = {},
): Promise<Portrait | null> {
  const trace = opts.trace ?? []
  const previous = await loadPortrait(supabase, userId)
  if (!opts.force && previous && Date.now() - Date.parse(previous.built_at) < REBUILD_HOURS * 3600_000) {
    trace.push(`portrait: fresh (${previous.lines.length} lines)`)
    return previous
  }
  try {
    const corpus = await loadCorpus(supabase, userId, [], { withAnswers: true })
    const input_hash = portraitInputHash(corpus.text, opts.corrections ?? '')
    if (!opts.force && previous && previous.input_hash === input_hash) {
      // Nothing was captured or answered since the last build: keep the lines,
      // restart the clock so the next caller doesn't reload the corpus either.
      const kept: Portrait = { ...previous, built_at: new Date().toISOString() }
      await supabase.from('user_settings').upsert({ user_id: userId, portrait: kept }, { onConflict: 'user_id' })
      trace.push(`portrait: nothing new since last build, kept ${previous.lines.length} lines`)
      return kept
    }
    const raw = await generateText(portraitPrompt(corpus.text, previous?.lines ?? [], opts.corrections ?? ''), {
      responseFormat: 'json', model: MODEL, maxTokens: 8192, thinkingLevel: 'low', timeoutMs: opts.timeoutMs ?? 25_000,
    })
    const lines = groundLines(parseModelJson(raw), corpus)
    trace.push(`portrait: ${lines.length} lines (${lines.map(l => `${l.name} [${l.rows.length}]`).join('; ')})`)
    if (lines.length === 0) return previous
    const portrait: Portrait = { lines, built_at: new Date().toISOString(), input_hash }
    const { error } = await supabase.from('user_settings').upsert({ user_id: userId, portrait }, { onConflict: 'user_id' })
    if (error) trace.push(`portrait not saved (run 20261116_portrait.sql): ${error.message}`)
    return portrait
  } catch (e) {
    trace.push(`portrait failed: ${e instanceof Error ? e.message : String(e)}`)
    return previous
  }
}
