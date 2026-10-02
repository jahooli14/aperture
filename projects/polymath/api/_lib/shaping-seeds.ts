/**
 * The new-project chat, helping someone find the version of an idea that is
 * only theirs.
 *
 * The first version of this chat read their notes back ("that course gave
 * you a good start") and then, fixed naively, would offer what any chatbot
 * offers: a stacking set, a push-along duck. Both prove nothing. An idea
 * is original when it is built from things only this person has -- a
 * material in the garage, a skill they picked up, where the person it's for
 * is right now. So an offer here must cite those things, exactly like a
 * spark does: by ref, with a verbatim quote, checked against the row.
 *
 * What they have just said in this chat counts as one source (ref "SAID"),
 * so "a wooden toy for his first birthday" plus one real note is two
 * things side by side. Nothing the app can't point at is ever offered, and
 * if nothing real fits, it offers nothing and just asks.
 *
 * Any failure -- no corpus, a slow model, a reply that names something
 * nobody said -- returns null, and the caller falls back to the plain chat.
 * A garnish never costs the turn.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { findVoiceViolations, PLAIN_ENGLISH_RULES, CHAT_TURN_RULES } from './plain-english.js'
import { loadCorpus, evidenceText, type Corpus, type CorpusRow } from './mull-corpus.js'
import { quoteIsReal, resolveEvidence, unsupportedSpecifics, MIN_EVIDENCE_ROWS, type Evidence } from './mull.js'

const MODEL = 'gemini-flash-latest'
/** Someone is waiting on this turn. Over it, the plain chat answers. */
export const SEED_BUDGET_MS = 9_000
const MAX_OFFERS = 3
const MAX_OFFER_WORDS = 12
const MAX_REPLY_WORDS = 60
/** The model cites what they said in this chat with this ref. */
export const SAID_REF = 'SAID'

export interface SeededReply {
  reply: string
  offers: string[]
  readyToExtract: boolean
}

export interface ChatTurn { role: 'user' | 'model'; content: string; offers?: string[] }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

function readEvidence(raw: unknown): Evidence[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((e: any) => ({ ref: str(e?.ref), quote: str(e?.quote) }))
    .filter(e => e.quote)
}

/**
 * Check what the model returned against what is really there. Pure.
 * Returns null when the reply itself can't be trusted; offers that fail are
 * dropped one by one and the reply stands without them.
 */
export function gateSeeded(
  raw: unknown, corpus: Corpus, history: ChatTurn[], userTurnNumber: number, trace: string[] = [],
): SeededReply | null {
  const userText = history.filter(t => t.role === 'user').map(t => t.content).join('\n')
  const priorOffers = new Set(history.flatMap(t => t.offers ?? []).map(o => o.toLowerCase()))
  const priorModelText = history.filter(t => t.role === 'model').map(t => t.content).join('\n')

  const reply = str((raw as any)?.reply)
  if (!reply) { trace.push('seed: empty reply'); return null }
  if (words(reply) > MAX_REPLY_WORDS) { trace.push('seed: reply too long'); return null }
  const replyVoice = findVoiceViolations(reply)
  if (replyVoice.length > 0) { trace.push(`seed: reply voice -- ${replyVoice[0]}`); return null }

  /** Rows a piece of text may lean on, plus what they said in this chat. */
  const resolve = (evidence: Evidence[]) => {
    const said = evidence.filter(e => e.ref.toUpperCase() === SAID_REF && quoteIsReal(e.quote, userText))
    const rest = evidence.filter(e => e.ref.toUpperCase() !== SAID_REF)
    const { rows } = resolveEvidence(rest, corpus)
    return { rows, said: said.length > 0 }
  }
  const haystackFor = (rows: CorpusRow[]) => [...rows.map(evidenceText), userText, priorModelText]

  const offers: string[] = []
  const allRows: CorpusRow[] = []
  const rawOffers: unknown[] = Array.isArray((raw as any)?.offers) ? (raw as any).offers : []
  for (const o of rawOffers) {
    const text = str((o as any)?.text)
    if (!text || text.includes('?')) continue
    if (words(text) > MAX_OFFER_WORDS) { trace.push(`seed: offer too long -- "${text}"`); continue }
    if (priorOffers.has(text.toLowerCase()) || offers.some(x => x.toLowerCase() === text.toLowerCase())) continue
    if (findVoiceViolations(text).length > 0) { trace.push(`seed: offer voice -- "${text}"`); continue }

    const { rows, said } = resolve(readEvidence((o as any)?.evidence))
    // Two things side by side: distinct captures, with this chat as one.
    const things = new Set(rows.map(r => r.captureId)).size + (said ? 1 : 0)
    if (things < MIN_EVIDENCE_ROWS || rows.length === 0) {
      trace.push(`seed: offer rests on ${things} real thing(s) -- "${text}"`)
      continue
    }
    const invented = unsupportedSpecifics(text, haystackFor(rows))
    if (invented.length > 0) { trace.push(`seed: offer names ${invented.join(', ')} -- "${text}"`); continue }
    offers.push(text)
    allRows.push(...rows)
  }

  // The reply may lean on rows too: anything it names has to be in them,
  // in the chat so far, or in what this assistant has already said.
  const replyRows = resolve(readEvidence((raw as any)?.uses)).rows
  const invented = unsupportedSpecifics(reply, haystackFor([...replyRows, ...allRows]))
  if (invented.length > 0) { trace.push(`seed: reply names ${invented.join(', ')}`); return null }

  const ready = (raw as any)?.readyToExtract === true || userTurnNumber >= 3
  return { reply, offers: ready ? [] : offers.slice(0, MAX_OFFERS), readyToExtract: ready }
}

export function seedPrompt(corpus: Corpus, history: ChatTurn[], message: string, userTurnNumber: number, context: string): string {
  const said = [...history.filter(t => t.role === 'user').map(t => t.content), message]
  const offered = history.flatMap(t => t.offers ?? [])
  const transcript = history.map(t => `${t.role === 'user' ? 'THEM' : 'YOU'}: ${t.content}`).join('\n')

  return `Someone opened a new-project chat. They're telling you what they want to make.
Your job is to help them find the version of it that only they would make. You are
not planning it, and you are not showing off that you remember their notes.

${PLAIN_ENGLISH_RULES}

EVERYTHING THEY'VE CAPTURED. Each row has a ref like [N12]:
${corpus.text}
${context ? `\n${context}\n` : ''}
WHAT THEY'VE SAID IN THIS CHAT (cite it with ref "${SAID_REF}"):
${said.map(s => `- ${s}`).join('\n')}
${transcript ? `\nTHE CHAT SO FAR:\n${transcript}\n` : ''}${offered.length ? `\nYOU OFFERED THESE ALREADY AND THEY WEREN'T TAKEN. Don't repeat them or their close cousins:\n${offered.map(o => `- ${o}`).join('\n')}\n` : ''}
This is their turn number ${userTurnNumber}.

OFFERS: up to ${MAX_OFFERS} versions of the thing, ${MAX_OFFER_WORDS} words or fewer each, something they could
make. Each must be built from at least TWO real things: what they just said (ref
"${SAID_REF}") and/or rows of their notes. Use a real thing of theirs inside the idea: a
material they have, a skill they picked up, where the person it's for is right
now. Quote each thing word for word, with its ref.
  GOOD, for someone making a gift for a dog-loving friend who has a kiln and
  just got a puppy: "a water bowl glazed with the puppy's paw print".
  BAD: "a ceramic bowl", "a mug set". Anyone could be offered those. If a version
  would fit any person, leave it out. If their notes give nothing real to build
  on, return an empty list. Do not pad.
  If they say they don't know what to make yet, the offers are the whole job:
  each one sits across two of THEIR notes (no "SAID" needed), preferring things
  they keep coming back to over a one-off.

REPLY: one or two short sentences, no more.
- With offers, it's a light lead-in. Don't repeat the offers in it.
- If the thing is for someone and you don't know what that person is doing or
  loving right now, ask ONE question about that: the specific moment, tied to
  their words. Not "tell me more". If you already asked it, or it's already clear,
  don't ask.
- Never reply with a note read back: "that course gave you a good start", "you
  wrote about X before". That proves you remember and helps with nothing.
- Never ask why it matters, what tools they have, or how much time they've got.
${CHAT_TURN_RULES}
- Only name things that are in their notes, in this chat, or that you already said.
  Quote the notes you lean on in "uses".

readyToExtract: true only when what they're making is concrete AND what done
looks like is said (or it's ongoing). When true, give no offers.

Return JSON only:
{
  "reply": "...",
  "uses": [ { "ref": "N12", "quote": "exact words from the row" } ],
  "offers": [ { "text": "...", "evidence": [ { "ref": "${SAID_REF}", "quote": "..." }, { "ref": "N12", "quote": "..." } ] } ],
  "readyToExtract": false
}`
}

/**
 * One chat turn, grounded. Null means "use the plain chat instead".
 */
export async function seededShapingReply(
  supabase: SupabaseClient, userId: string,
  body: { message: string; history: ChatTurn[]; userTurnNumber: number; context?: string },
  trace: string[] = [],
): Promise<SeededReply | null> {
  const start = Date.now()
  try {
    const corpus = await loadCorpus(supabase, userId, trace)
    if (corpus.rows.length === 0) { trace.push('seed: no corpus'); return null }
    const left = SEED_BUDGET_MS - (Date.now() - start)
    if (left < 2_000) { trace.push('seed: out of time before the draft'); return null }

    const prompt = seedPrompt(corpus, body.history, body.message, body.userTurnNumber, body.context ?? '')
    const raw = await generateText(prompt, {
      responseFormat: 'json', model: MODEL, maxTokens: 2048,
      thinkingLevel: 'low', temperature: 0.7, timeoutMs: left,
    })
    const history = [...body.history, { role: 'user' as const, content: body.message }]
    const gated = gateSeeded(parseModelJson(raw), corpus, history, body.userTurnNumber, trace)
    trace.push(`seed: ${gated ? `${gated.offers.length} offer(s)` : 'rejected'} in ${Date.now() - start}ms`)
    return gated
  } catch (e) {
    trace.push(`!! seed failed: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}
