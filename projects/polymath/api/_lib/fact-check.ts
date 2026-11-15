/**
 * Every fact from the world a take adds is checked against the web before
 * anyone sees it, and the page that says it comes along as the take's source.
 *
 * Why: a take that adds a fact is only worth anything if the fact is real,
 * and asking the drafter to be sure isn't checking. Measured on the owner's
 * corpus (Nov 2026), Flash wrote "Stanislaw Jerzy Lec wrote biting
 * one-liners to survive a labour camp" (he escaped by killing a guard) and
 * "Ashby's Homeostat achieved artificial intelligence". One search-grounded
 * call per fact judged seven test claims, both of those included, all
 * correctly, in 4-8s each, run in parallel.
 *
 * Strict on purpose: only "true" ships. "false" and "unsure" both drop the
 * take, because a wrong fact ruins the whole thing and there is always
 * another take behind it. The link is a bonus: shown only when the page
 * loads, isn't a bot wall, and is about the topic (outside-find.ts).
 */

import { GoogleGenAI } from '@google/genai'
import { parseModelJson } from './schemas.js'
import { checkPage } from './outside-find.js'

const MODEL = 'gemini-flash-latest'
const PAGE_TIMEOUT_MS = 4_000

export type Verdict = 'true' | 'false' | 'unsure'

export interface FactCheck {
  verdict: Verdict
  /** A page that says it, only once it has been loaded and read. */
  source?: { title: string; url: string }
  why?: string
}

export function factCheckPrompt(claim: string): string {
  return `Check this claim with a web search. Be strict: "true" only if reliable sources say it plainly. "false" if they contradict it, or it overstates what happened. "unsure" otherwise.

CLAIM: ${claim}

Reply with JSON only:
{"verdict": "true" | "false" | "unsure", "why": "under 12 words", "topic": "2-5 words naming the thing, e.g. Dazzle camouflage", "url": "the single best page from your search that says it"}`
}

/** Reads the model's answer. Anything unreadable is "unsure": never ship on a guess. Pure. */
export function parseFactCheck(text: string): { verdict: Verdict; topic: string; url: string; why: string } {
  let raw: Record<string, unknown> = {}
  try {
    const parsed = parseModelJson(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim())
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>
  } catch {
    return { verdict: 'unsure', topic: '', url: '', why: 'unreadable answer' }
  }
  const verdict: Verdict = raw.verdict === 'true' || raw.verdict === true ? 'true' : raw.verdict === 'false' || raw.verdict === false ? 'false' : 'unsure'
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  let url = str(raw.url)
  try {
    if (new URL(url).protocol !== 'https:') url = ''
  } catch {
    url = ''
  }
  return { verdict, topic: str(raw.topic).slice(0, 80), url, why: str(raw.why) }
}

export async function checkFact(claim: string, timeoutMs: number): Promise<FactCheck> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const start = Date.now()
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: factCheckPrompt(claim),
    config: {
      tools: [{ googleSearch: {} }],
      // `low`: this model does no hidden thinking at it, and the search is
      // where the time goes. `minimal` 400s on this model.
      thinkingConfig: { thinkingLevel: 'low' } as never,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  })
  const read = parseFactCheck(response.text ?? '')
  if (read.verdict !== 'true') return { verdict: read.verdict, why: read.why }
  const left = timeoutMs - (Date.now() - start)
  if (!read.url || !read.topic || left < 1_000) return { verdict: 'true', why: read.why }
  const problem = await checkPage({ title: read.topic, url: read.url }, Math.min(PAGE_TIMEOUT_MS, left))
  return problem
    ? { verdict: 'true', why: read.why }
    : { verdict: 'true', why: read.why, source: { title: read.topic, url: read.url } }
}

/** Never throws: a failed check is "unsure", so the take doesn't ship. */
export async function checkFactSafely(claim: string, timeoutMs: number): Promise<FactCheck> {
  try {
    return await checkFact(claim, timeoutMs)
  } catch (e) {
    return { verdict: 'unsure', why: `check failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120) }
  }
}
