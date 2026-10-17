/**
 * A/B test, run on the real corpus, writes nothing (`job=bake-experiment`).
 *
 *   A  one Flash draft over the whole corpus, then a Flash judge   (production)
 *   B  many Flash-Lite drafts, each seeing a small slice, a Lite judge picks,
 *      capped at A's spend AND A's wall time
 *   C  the same swarm with ~5x the room, for reference
 *
 * Each arm picks its own top three. All the picks are then pooled, shuffled
 * and scored together by one blind Flash judge, so the arms never mark their
 * own homework. Honesty gates and the echo check are the same for every arm.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { echoesRecent } from './spark-echo.js'
import { loadCorpus, formatRow, type Corpus, type CorpusRow } from './mull-corpus.js'
import { checkCandidate, judgePercent, judgeRank, parseJudgeScores, type Candidate, type Grounded, type JudgeScore } from './mull.js'
import { judgePrompt } from './mull-prompts.js'
import { buildDraftPrompt, loadEchoContext, readCandidates } from './mull-generator.js'

const FLASH = 'gemini-flash-latest'
const LITE = 'gemini-flash-lite-latest'

/** $ per 1M tokens, from Google's pricing page (Oct 2026): Gemini 3.8 Flash at
 *  its introductory rate (doubles on 1 Jan 2027) and 3.5 Flash-Lite. If the
 *  `-latest` Lite alias has moved on, the Lite figure is approximate. */
const PRICE = { flash: { in: 0.75, out: 3.75 }, lite: { in: 0.30, out: 2.50 } }

interface Spend { calls: number; failed: number; inTok: number; outTok: number; usd: number; firstError?: string }
const newSpend = (): Spend => ({ calls: 0, failed: 0, inTok: 0, outTok: 0, usd: 0 })

async function ask(
  model: string, tier: 'flash' | 'lite', prompt: string, maxTokens: number, timeoutMs: number, spend: Spend,
): Promise<unknown | null> {
  spend.calls++
  let usage: { input: number; output: number; thinking: number } | null = null
  try {
    const raw = await generateText(prompt, {
      responseFormat: 'json', model, maxTokens, thinkingLevel: 'low', timeoutMs, onUsage: u => { usage = u },
    })
    return parseModelJson(raw)
  } catch (e) {
    spend.failed++
    spend.firstError ??= e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160)
    return null
  } finally {
    const u = usage as { input: number; output: number; thinking: number } | null
    if (u) {
      spend.inTok += u.input
      spend.outTok += u.output + u.thinking
      spend.usd += (u.input * PRICE[tier].in + (u.output + u.thinking) * PRICE[tier].out) / 1_000_000
    }
  }
}

interface ArmResult {
  name: string
  drafted: number
  passed: number
  drops: Record<string, number>
  picks: Grounded[]
  spend: Spend
  ms: number
}

const dropKey = (reason: string) => reason.replace(/:.*$/, '').replace(/ -- .*/, '').slice(0, 48)

/** Gates and echo check, the same for every arm. */
function gate(
  cands: Candidate[], corpus: Corpus, recentIds: Set<string>, recentTexts: string[], drops: Record<string, number>,
): Grounded[] {
  const out: Grounded[] = []
  const seen = new Set<string>()
  for (const c of cands) {
    const key = c.question.toLowerCase().replace(/\W+/g, ' ').trim()
    if (seen.has(key)) { drops['duplicate'] = (drops['duplicate'] ?? 0) + 1; continue }
    seen.add(key)
    const check = checkCandidate(c, corpus, false)
    if (!check.ok) { const k = dropKey(check.reason); drops[k] = (drops[k] ?? 0) + 1; continue }
    if (check.grounded.rows.some(r => recentIds.has(r.id))) { drops['built on a recent row'] = (drops['built on a recent row'] ?? 0) + 1; continue }
    if (echoesRecent(check.grounded.question, recentTexts)) { drops['echoes a recent question'] = (drops['echoes a recent question'] ?? 0) + 1; continue }
    out.push(check.grounded)
  }
  return out
}

/** Score survivors; returns them sorted best first. */
async function judgeAndRank(
  grounded: Grounded[], model: string, tier: 'flash' | 'lite', liveTitle: string | null, spend: Spend, batch: number,
): Promise<Grounded[]> {
  if (grounded.length === 0) return []
  const chunks: Grounded[][] = []
  for (let i = 0; i < grounded.length; i += batch) chunks.push(grounded.slice(i, i + batch))
  const scored = await Promise.all(chunks.map(async chunk => {
    const raw = await ask(model, tier, judgePrompt(chunk, liveTitle), 8192, 20_000, spend)
    const scores = raw ? parseJudgeScores(raw, chunk.length) : new Map<number, JudgeScore>()
    return chunk.map((g, i) => ({ g, rank: scores.has(i + 1) ? judgeRank(scores.get(i + 1)!) : -999 }))
  }))
  return scored.flat().sort((a, b) => b.rank - a.rank).map(x => x.g)
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** A small, mixed slice of the corpus around one seed row. */
function sliceFor(corpus: Corpus, seed: CorpusRow, liveRow: CorpusRow | null, recentIds: Set<string>, rand: () => number): CorpusRow[] {
  const free = (r: CorpusRow) => r !== seed && !recentIds.has(r.id) && r.captureId !== seed.captureId
  const pick = (kind: CorpusRow['kind'], n: number) =>
    shuffle(corpus.rows.filter(r => r.kind === kind && free(r)), rand).slice(0, n)
  const rows = [seed, ...pick('memory', 3), ...pick('list_item', 2), ...pick('project', 1), ...pick('fragment', 1)]
  if (liveRow && !rows.includes(liveRow)) rows.push(liveRow)
  return rows
}

async function swarmArm(
  name: string, corpus: Corpus, echo: Awaited<ReturnType<typeof loadEchoContext>>, recentIds: Set<string>, recentTexts: string[],
  caps: { usd: number; ms: number; maxCalls: number }, rand: () => number,
): Promise<ArmResult> {
  const start = Date.now()
  const spend = newSpend()
  const drops: Record<string, number> = {}
  const liveTitle = echo.season?.main?.title ?? echo.live?.title ?? null
  const liveRow = liveTitle ? corpus.rows.find(r => r.kind === 'project' && r.title.toLowerCase() === liveTitle.toLowerCase()) ?? null : null
  const seeds = shuffle(corpus.rows.filter(r => (r.kind === 'memory' || r.kind === 'list_item') && !recentIds.has(r.id)), rand)
  const drafted: Candidate[] = []
  // The Lite judge runs after the drafts and is inside the same cap.
  const deadline = start + caps.ms - 4_000
  let next = 0
  // Judging gets a slice of the budget too; the drafts may use ~80% of it.
  const draftUsd = caps.usd * 0.8
  const worker = async () => {
    while (next < caps.maxCalls && next < seeds.length && Date.now() < deadline - 1_000 && spend.usd < draftUsd) {
      const i = next++
      const withLive = liveRow && i % 2 === 0
      const rows = sliceFor(corpus, seeds[i], withLive ? liveRow : null, recentIds, rand)
      const prompt = buildDraftPrompt(corpus, echo, recentIds, recentTexts, {
        howMany: 1, seedRef: seeds[i].ref, corpusText: rows.map(formatRow).join('\n'),
        liveTitle: withLive ? liveTitle : null, recentRefs: [],
      })
      const raw = await ask(LITE, 'lite', prompt, 2048, Math.max(4_000, deadline - Date.now() - 2_000), spend)
      if (raw) drafted.push(...readCandidates(raw))
    }
  }
  await Promise.all(Array.from({ length: 30 }, worker))
  const passed = gate(drafted, corpus, recentIds, recentTexts, drops)
  const ranked = await judgeAndRank(passed, LITE, 'lite', liveTitle, spend, 8)
  return { name, drafted: drafted.length, passed: passed.length, drops, picks: ranked.slice(0, 3), spend, ms: Date.now() - start }
}

export async function runExperiment(supabase: SupabaseClient, userId: string, trace: string[]): Promise<void> {
  const rand = Math.random
  const [corpus, echo] = await Promise.all([loadCorpus(supabase, userId, trace), loadEchoContext(supabase, userId)])
  const recentIds = new Set<string>([
    ...(echo.recentSubjectIds ?? []),
    ...corpus.rows.filter(r => r.kind === 'project' && echo.recentProjectIds?.has(r.id)).map(r => r.id),
  ])
  const recentTexts = echo.recentTexts
  const liveTitle = echo.season?.main?.title ?? echo.live?.title ?? null
  trace.push(`corpus: ${corpus.rows.length} rows, ${corpus.text.length} chars; live project: ${liveTitle ?? 'none'}`)

  // ── A: one Flash draft over everything, Flash judge ──────────────────
  const aStart = Date.now()
  const aSpend = newSpend()
  const aDrops: Record<string, number> = {}
  const aRaw = await ask(FLASH, 'flash', buildDraftPrompt(corpus, echo, recentIds, recentTexts, { howMany: 4, lens: liveTitle ? 'live' : undefined }), 16384, 30_000, aSpend)
  const aDrafted = aRaw ? readCandidates(aRaw) : []
  const aPassed = gate(aDrafted, corpus, recentIds, recentTexts, aDrops)
  const aRanked = await judgeAndRank(aPassed, FLASH, 'flash', liveTitle, aSpend, 8)
  const A: ArmResult = { name: 'A  one Flash call', drafted: aDrafted.length, passed: aPassed.length, drops: aDrops, picks: aRanked.slice(0, 3), spend: aSpend, ms: Date.now() - aStart }

  // ── B: swarm of Lite, capped at A's spend and A's time ────────────────
  const B = await swarmArm('B  Lite swarm, same spend + time', corpus, echo, recentIds, recentTexts,
    { usd: A.spend.usd, ms: A.ms, maxCalls: 400 }, rand)
  // ── C: the same swarm with room to spare ──────────────────────────────
  const C = await swarmArm('C  Lite swarm, ~5x spend + 2x time', corpus, echo, recentIds, recentTexts,
    { usd: A.spend.usd * 5, ms: Math.max(A.ms * 2, 20_000), maxCalls: 400 }, rand)

  // ── Blind pooled judge: every arm's picks, shuffled, scored together ───
  const arms = [A, B, C]
  const pool = shuffle(arms.flatMap((arm, ai) => arm.picks.map(g => ({ g, ai }))), rand)
  const blindSpend = newSpend()
  const blindRaw = pool.length
    ? await ask(FLASH, 'flash', judgePrompt(pool.map(x => x.g), liveTitle), 8192, 25_000, blindSpend)
    : null
  const blind = blindRaw ? parseJudgeScores(blindRaw, pool.length) : new Map<number, JudgeScore>()

  const usd = (n: number) => `$${n.toFixed(4)}`
  for (let ai = 0; ai < arms.length; ai++) {
    const arm = arms[ai]
    const mine = pool.map((x, i) => ({ x, s: blind.get(i + 1) })).filter(m => m.x.ai === ai && m.s)
    const pcts = mine.map(m => judgePercent(m.s!))
    const dropText = Object.entries(arm.drops).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}x ${k}`).join('; ') || 'none'
    trace.push(`#### ${arm.name}`)
    trace.push(`calls ${arm.spend.calls} (${arm.spend.failed} failed${arm.spend.firstError ? `: ${arm.spend.firstError}` : ''}), ${arm.spend.inTok} in / ${arm.spend.outTok} out tokens, ${usd(arm.spend.usd)}, ${(arm.ms / 1000).toFixed(1)}s`)
    trace.push(`drafted ${arm.drafted}, passed gates ${arm.passed}; dropped: ${dropText}`)
    trace.push(`blind score of its top ${pcts.length}: ${pcts.join('%, ') || 'none'}${pcts.length ? '%' : ''}  (best ${pcts.length ? Math.max(...pcts) : 0}%, mean ${pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0}%)`)
    const best = mine.sort((a, b) => judgePercent(b.s!) - judgePercent(a.s!))[0]
    if (best) trace.push(`its best: ${judgePercent(best.s!)}% -- ${best.x.g.question}`)
  }
  trace.push(`blind judge cost ${usd(blindSpend.usd)}`)
}
