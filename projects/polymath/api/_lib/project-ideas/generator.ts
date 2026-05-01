/**
 * Generator — synthesises 3 ranked project ideas from a GatherResult.
 *
 * Single Gemini Pro call (deeper reasoning than Flash for cross-domain
 * synthesis), JSON-mode response. Pro is slower but the cost of a bland
 * homepage is the user not trusting the surface — much more expensive
 * than $0.20/run.
 *
 * Time budget on a 60s Vercel function: ~5s gather + ~40-50s Pro call +
 * ~3s insert. No retry loop — a retry would push us past the ceiling and
 * Pro at temperature 0.85 doesn't need it. Truncated JSON gets a salvage
 * pass before we give up.
 *
 * Quality moves baked in (research-driven):
 *   - Enumerate 15-20 candidate seeds first, then critique each, then
 *     select 3. Single biggest evidence-backed lever for non-obvious
 *     output (Wharton paper on AI idea diversity).
 *   - Anti-pattern banlist on modal-mediocre tech-Twitter side projects
 *     (newsletter, podcast, course, tracker app, "directory of", etc.).
 *     Forces the model to NAME the cliché before allowing the candidate.
 *   - Each rank slot has a different JOB: rank-1 is highest convergence
 *     (uses the most accumulated skills/tools at once), rank-2 is dormant
 *     revival (something they couldn't make six months ago), rank-3 is
 *     growing edge (the next stretch). The reframe from "cross-domain
 *     distance" was deliberate — that prompt produced forced surrealist
 *     mashups, not real projects.
 *   - Rejection *reasons* (not just titles) are surfaced to the prompt
 *     so the next batch is conditioned on why prior ideas missed.
 *   - Evidence excerpts are verified server-side to substring-match the
 *     real source body; LLM-fabricated quotes are replaced with the
 *     actual text. This is the trust premise of the surface.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import type { GatherResult, GenerationResult, IdeaEvidence, ProjectIdea } from './types.js'

const MIN_SIGNALS = 8

export async function generateProjectIdeas(gathered: GatherResult): Promise<GenerationResult> {
  if (gathered.total_signal_count < MIN_SIGNALS) {
    console.log(`[project-ideas] insufficient_data: ${gathered.total_signal_count} signals (min ${MIN_SIGNALS})`)
    return { ideas: [], reason: 'insufficient_data', attempts: 0 }
  }

  const prompt = buildPrompt(gathered)
  console.log(`[project-ideas] gather: ${gathered.total_signal_count} signals; prompt: ${prompt.length} chars`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      // Flash is cheap; give the 3-phase prompt enough headroom that 15
      // drafts + 15 reviews + 3 full ideas all fit comfortably. Earlier
      // 8000-token budget was running out before the `ideas` array even
      // started, leaving us with parseable drafts but no actual output.
      maxTokens: 32000,
      temperature: 0.85,
      responseFormat: 'json',
    })
  } catch (err) {
    console.error(`[project-ideas] Flash call threw after ${Date.now() - t0}ms:`, err)
    return { ideas: [], reason: 'parse_failure', attempts: 1 }
  }
  console.log(`[project-ideas] Flash responded in ${Date.now() - t0}ms (${raw.length} chars)`)

  const ideas = parseAndValidate(raw, gathered)
  if (ideas.length === 0) {
    // Log a preview so the next failure is debuggable from Vercel logs.
    // Long preview so we can see whether the JSON truncated, the ideas
    // array was empty, or every idea got dropped by validation. Log in
    // chunks because Vercel truncates very long single log lines.
    console.warn(`[project-ideas] no valid ideas after parse. raw length: ${raw.length}`)
    for (let i = 0; i < raw.length; i += 1500) {
      console.warn(`[project-ideas] raw[${i}..]: ${raw.slice(i, i + 1500)}`)
    }
    return { ideas: [], reason: 'parse_failure', attempts: 1 }
  }

  console.log(`[project-ideas] produced ${ideas.length} valid ideas`)
  return { ideas, attempts: 1 }
}

function buildPrompt(g: GatherResult): string {
  const memBlock = g.memories.slice(0, 35).map(m => {
    const date = isoDate(m.created_at)
    const themeStr = m.themes.length ? ` · themes: ${m.themes.slice(0, 4).join(', ')}` : ''
    const typeStr = m.memory_type ? ` [${m.memory_type}]` : ''
    return `  memory#${m.id} (${date})${typeStr}${themeStr}\n    "${truncate(m.body, 280)}"`
  }).join('\n')

  const listsByType = groupBy(g.list_items, li => li.list_type)
  const listBlock = Array.from(listsByType.entries()).map(([type, items]) =>
    `  ${type} (${items.length}):\n${items.slice(0, 12).map(li =>
      `    list_item#${li.id} (${isoDate(li.created_at)}, ${li.status}) — ${truncate(li.content, 140)}`
    ).join('\n')}`
  ).join('\n')

  const activeProjBlock = g.active_projects.map(p =>
    `  project#${p.id} [${p.status}] "${p.title}"${p.description ? `\n    ${truncate(p.description, 240)}` : ''}${p.tags.length ? `\n    tags: ${p.tags.slice(0, 6).join(', ')}` : ''}`
  ).join('\n')

  const dormantProjBlock = g.dormant_projects.map(p =>
    `  project_dormant#${p.id} [${p.status}, last touched ${isoDate(p.updated_at)}] "${p.title}"${p.description ? `\n    ${truncate(p.description, 200)}` : ''}`
  ).join('\n')

  const readingBlock = g.reading.map(r =>
    `  reading#${r.id} (${isoDate(r.created_at)}) "${r.title ?? '(untitled)'}"${r.source ? ` · ${r.source}` : ''}${r.excerpt ? `\n    ${truncate(r.excerpt, 200)}` : ''}`
  ).join('\n')

  const highlightBlock = g.highlights.map(h =>
    `  highlight#${h.id} (${isoDate(h.created_at)}, from "${h.article_title ?? 'article'}") — "${truncate(h.quote, 220)}"`
  ).join('\n')

  const todoBlock = g.todos.map(t =>
    `  todo#${t.id} (${isoDate(t.created_at)}) — ${truncate(t.text, 180)}${t.notes ? ` :: ${truncate(t.notes, 120)}` : ''}`
  ).join('\n')

  const ieBlock = g.ie_ideas.slice(0, 10).map(i =>
    `  idea_engine#${i.id} [${i.status}] "${i.title}" — ${truncate(i.description, 160)}`
  ).join('\n')

  const suggestionBlock = g.prior_suggestions.slice(0, 10).map(s =>
    `  suggestion#${s.id} [${s.status}] "${s.title}"`
  ).join('\n')

  const seenBlock = [
    ...g.prior_ideas.built.map(t => `  · BUILT: "${t.title}"${t.feedback ? ` — note: ${truncate(t.feedback, 120)}` : ''}`),
    ...g.prior_ideas.saved.map(t => `  · saved: "${t.title}"${t.feedback ? ` — note: ${truncate(t.feedback, 120)}` : ''}`),
    ...g.prior_ideas.rejected.map(t => `  · rejected: "${t.title}"${t.feedback ? ` — reason: ${truncate(t.feedback, 120)}` : ''}`),
  ].join('\n')

  return `You are a specific friend. Not a coach. Not a therapist. A maker who has known this person for years, watched what they pick up and put down, and has a low tolerance for projects that are really just art pieces in disguise. You are dry. You are skeptical. You would be embarrassed to suggest a "memory totem" or a "series exploring" anything. You suggest projects you would build yourself.

Your job: surface the 3 projects this person should obviously be working on RIGHT NOW, because they have already accumulated everything they need to build them. Inevitable picks. Not surprising ones.

═══════ THE CORE DISTINCTION ═══════

CONVERGENT (what you produce): A specific artefact where every input is doing structural work. Woodwork course → the case. Raspberry Pi → the brain. Synth-playing → design intuition. TypeScript → firmware. Result: "build your own synth." Every input is load-bearing. Remove any one and the project is materially worse. A friend reads it and says "obviously, you have everything you need."

DECORATIVE (what you DO NOT produce): Inputs combined as motifs, themes, or aesthetic. Woodwork + memory thoughts + beauty goal → "The Willow Memory Totem." Inputs as ingredients in a sculpture. Films-watched + a voice note → "a film series exploring X." Inputs as taste, not as toolkit. If your idea reads as a sculpture, an installation, a portrait series, a zine, a totem, an "exploration," a "meditation," or a curated something — kill it.

The test: name each input's structural role in the build. If you cannot say "this part is the X" for every input, it is decorative. Kill it.

═══════ THE DATA ═══════

VOICE NOTES (recent, in order):
${memBlock || '  (none)'}

LIST ITEMS (films/books/places — consumption, NOT capability; see rules below):
${listBlock || '  (none)'}

ACTIVE PROJECTS:
${activeProjBlock || '  (none)'}

DORMANT / ON-HOLD / ARCHIVED / ABANDONED PROJECTS (existing scope, residual context, half-built):
${dormantProjBlock || '  (none)'}

READING QUEUE:
${readingBlock || '  (none)'}

HIGHLIGHTS (sentences pulled from articles — thinking out loud, not commitments):
${highlightBlock || '  (none)'}

OPEN TODOS:
${todoBlock || '  (none)'}

PRIOR IDEA-ENGINE OUTPUT (anti-evidence — avoid repeating, do NOT cite as user signal):
${ieBlock || '  (none)'}

PRIOR PROJECT SUGGESTIONS (anti-evidence — same):
${suggestionBlock || '  (none)'}

PREVIOUSLY SURFACED IDEAS (do NOT repeat; honour rejection reasons):
${seenBlock || '  (none)'}

═══════ DATA-SHAPE RULES (HARD) ═══════

1. A voice note is load-bearing only if (a) its theme repeats across ≥2 notes, OR (b) it explicitly names a concrete tool/skill/material. Single cryptic notes ("mouses are good") are NEVER lead evidence.
2. List items (films/books/places) are taste. They can supply aesthetic intuition or a location constraint. They are NEVER the structural reason a project exists. They are NEVER lead evidence.
3. Dormant projects already have scope. Picking one up means SHIPPING IT, not remixing it. The dormant_revival title must reference the original deliverable.
4. Highlights are thinking-out-loud. They can supply why_now framing. They are NEVER the load-bearing capability.
5. Themes arrays are AI-generated and lossy. Excerpts must come from the body text shown above, never from themes.
6. Idea-engine and prior_suggestions are anti-evidence. They condition what to AVOID, not what to build on.

═══════ HOW TO THINK ═══════

Output JSON with keys: toolkit, drafts, review, ideas. Work the phases in order.

PHASE 1 — TOOLKIT (output as an array). List 8–14 items the user has actually accumulated. Each item is one line in the form:
  "<kind>: <specific thing> [source_id]"
where kind is one of: SKILL, TOOL, MATERIAL, DORMANT, OBSESSION, PERSON, LOCATION.
SKILLs are things they can do (a course completed, a repeat practice). TOOLs are things they own and can pick up. MATERIALs are physical or digital substrate they have. DORMANT is a half-built project with residual context. OBSESSION is a theme repeating across ≥2 captures over weeks. PERSON is someone they've named. LOCATION is somewhere they have access to.
Do NOT include consumption preferences (films watched, books read) unless they're supplying a concrete location or a recurring craft interest.

PHASE 2 — DRAFTS (10 lines). Each draft is a finished artefact named first, then the toolkit items it consumes:
  "FINISHED: <concrete artefact> — uses <toolkit-item>, <toolkit-item>, <toolkit-item> [<source_ids>]"
Hard requirements per draft:
  - Each draft must use ≥2 toolkit items.
  - At least one of the cited toolkit items must be SKILL, TOOL, MATERIAL, or DORMANT (not a consumption preference, not a single highlight).
  - Range across the toolkit. The 10 should hit different parts, not 10 versions of the same idea.
Banned title vocabulary in drafts and ideas — automatic fail: "exploration," "study of," "series," "totem," "memory of," "in conversation with," "investigation into," "meditation on," "the [abstract] of [abstract]," "a year of," "directory," "tracker," "second brain," "digital garden," "newsletter," "podcast," "Substack," "zine," "installation," "portrait series."

PHASE 3 — REVIEW (10 lines, one per draft, terse). For each:
  "<n>. CONVERGENT|DECORATIVE — <≤15 words>. Doable: yes/no."
A draft is DECORATIVE if you cannot state a load-bearing structural role for every cited input. Mark it failed.
A draft is CONVERGENT only if removing any single cited input would materially break the build.

PHASE 4 — IDEAS (3 picks from the survivors). Each rank slot does a different job:
  - rank 1 — CONVERGENCE: the project that uses the MOST toolkit items at once in service of one coherent build. Should feel inevitable.
  - rank 2 — DORMANT_REVIVAL: pick up an abandoned project that the toolkit now makes shippable. Title names the original deliverable. Pitch describes shipping it, not reinventing it.
  - rank 3 — GROWING_EDGE: 70% there, 30% stretch. The next-step closes one specific gap.

The 3 must not share a lead evidence item.

For each idea:
  - title: ≤8 words. Names a concrete artefact or a concrete action verb on a real thing. NO abstract nouns from the banlist.
  - pitch: 2–3 sentences. Sentence 1 = what the finished thing IS. Sentence 2 = which toolkit item plays which role in the build. Sentence 3 = what "done" means, in one observable test.
  - why_now: ONE sentence, past tense, citing specific recent accumulation with rough dates ("course finished three weeks ago," "Pi has been on the shelf since November"). No vague "you've been thinking about X."
  - next_step: ONE concrete physical action doable in under an hour, using something already owned. Imperative verb. Names a specific tool or file. NOT "research," NOT "plan," NOT "sketch," NOT "outline."
  - evidence: 3–5 items, each {kind, source_id, label, date, excerpt}. excerpt must be a verbatim substring of the source body shown above (will be substring-checked). Lead evidence (item 0) MUST be a SKILL, TOOL, MATERIAL, or DORMANT — never a list item, never a single highlight.
  - rank_role: "convergence" | "dormant_revival" | "growing_edge"

═══════ CALIBRATION ═══════

GOOD (the bar): "Build your own synth." Woodwork course → case. Pi → brain. Synth practice → knob layout. TypeScript → firmware. Every input load-bearing. Title names the artefact. Next step is "flash CircuitPython, wire one pot to ADC0."

BAD (kill on sight): "The Willow Memory Totem." Wood + memory + beauty as motifs in a sculpture. Inputs decorative. Title is the abstract-of-abstract construction.

BAD (kill on sight): "A film series exploring Mulholland Drive moments in your own life." List items as fuel, no toolkit, no artefact, abstract verb.

BAD (kill on sight): "A newsletter about your woodworking journey." Cliché on the banlist; toolkit items used as content, not as build.

═══════ OUTPUT FAILURE MODES (avoid) ═══════

If you cannot find 3 convergent picks, return 1 or 2. Padding with decorative ideas is worse than silence. If the toolkit has fewer than 4 SKILL/TOOL/MATERIAL/DORMANT items, return an empty ideas array — there isn't enough yet.

═══════ OUTPUT (strict JSON, no markdown fences) ═══════
{
  "toolkit": [
    "SKILL: finished beginner woodwork course in March [memory#abc]",
    "TOOL: Raspberry Pi 4 sitting unused [memory#def]",
    ...
  ],
  "drafts": [
    "FINISHED: monosynth in a wooden case — uses woodwork SKILL, Pi TOOL, synth-playing OBSESSION, TypeScript SKILL [memory#abc, memory#def, memory#ghi, project#jkl]",
    ... (10 lines)
  ],
  "review": [
    "1. CONVERGENT — every input load-bearing. Doable: yes.",
    ... (10 lines)
  ],
  "ideas": [
    {
      "rank": 1,
      "rank_role": "convergence",
      "title": "...",
      "pitch": "...",
      "why_now": "...",
      "next_step": "...",
      "evidence": [
        { "kind": "memory", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "..." }
      ]
    },
    { "rank": 2, "rank_role": "dormant_revival", ... },
    { "rank": 3, "rank_role": "growing_edge", ... }
  ]
}`
}

interface RawIdea {
  rank?: number
  rank_role?: string
  title?: string
  pitch?: string
  why_now?: string
  next_step?: string
  evidence?: Array<{ kind?: string; source_id?: string; label?: string; date?: string; excerpt?: string }>
}

const VALID_KINDS = new Set([
  'memory',
  'list_item',
  'project',
  'project_dormant',
  'reading',
  'highlight',
  'todo',
  'suggestion',
  'idea_engine',
])

function parseAndValidate(raw: string, gathered: GatherResult): ProjectIdea[] {
  const payload = robustJsonParse(raw)
  if (!payload || typeof payload !== 'object') return []
  const ideasRaw = (payload as { ideas?: RawIdea[] }).ideas
  if (!Array.isArray(ideasRaw)) return []

  // Build lookup tables of real source content for excerpt verification.
  // The validator replaces fabricated excerpts with the real text rather
  // than dropping the evidence — preserves the citation, kills the lie.
  const sourceLookup = buildSourceLookup(gathered)

  const out: ProjectIdea[] = []
  let nextRank = 1
  const usedLeadEvidence = new Set<string>()

  for (const item of ideasRaw) {
    if (!item.title || !item.pitch || !item.next_step || !item.why_now) continue
    if (!Array.isArray(item.evidence)) continue

    const evidence: IdeaEvidence[] = []
    const seenSources = new Set<string>()
    for (const e of item.evidence) {
      if (!e.source_id) continue
      // The prompt formats ids as `kind#uuid` so the model can keep types
      // and ids together visually. Two reasons we trust the prefix over
      // the model-supplied `kind` field:
      //   1. Models echo the prefix back in source_id reliably.
      //   2. Models conflate the evidence-kind set (memory/list_item/...)
      //      with the toolkit-kind set (SKILL/TOOL/MATERIAL/DORMANT) and
      //      put the wrong word in the kind field, dropping every item.
      // So: extract kind from prefix if present; fall back to the model
      // field only when there's no prefix.
      const rawId = e.source_id
      const hashIdx = rawId.indexOf('#')
      let kindFromPrefix: string | undefined
      let bareId = rawId
      if (hashIdx > 0) {
        kindFromPrefix = rawId.slice(0, hashIdx).toLowerCase()
        bareId = rawId.slice(hashIdx + 1)
      }
      const kind = kindFromPrefix && VALID_KINDS.has(kindFromPrefix)
        ? kindFromPrefix
        : (typeof e.kind === 'string' ? e.kind.toLowerCase() : '')
      if (!VALID_KINDS.has(kind)) continue

      const real = sourceLookup.get(bareId)
      if (!real) continue // fabricated id
      if (seenSources.has(bareId)) continue // dedupe within an idea
      seenSources.add(bareId)

      const labelOut = (e.label ?? '').slice(0, 120) || real.label
      const dateOut = real.date || (e.date ?? '').slice(0, 32)
      const excerptOut = verifyOrReplaceExcerpt(e.excerpt ?? '', real.body)
      evidence.push({
        kind: kind as IdeaEvidence['kind'],
        // Persist the bare uuid — the UI never shows source_id, but
        // storing the canonical form keeps later joins / debugging sane.
        source_id: bareId,
        label: labelOut,
        date: dateOut,
        excerpt: excerptOut,
      })
    }
    // Be lenient (≥2) — better to ship a slightly thin idea than 0 ideas
    // because of strict validation. The UI labels "from N signals" so
    // small N is visible and self-correcting.
    if (evidence.length < 2) continue

    out.push({
      rank: typeof item.rank === 'number' ? item.rank : nextRank,
      title: item.title.trim().slice(0, 140),
      pitch: item.pitch.trim().slice(0, 800),
      why_now: item.why_now.trim().slice(0, 400),
      next_step: item.next_step.trim().slice(0, 400),
      evidence,
    })
    nextRank++
    if (out.length >= 3) break
  }

  // Forced diversity: if two finalists share their lead evidence, demote
  // the later one. Cheap last-line defence beyond the prompt's own rule.
  const filtered: ProjectIdea[] = []
  for (const idea of out.sort((a, b) => a.rank - b.rank)) {
    const lead = idea.evidence[0]?.source_id
    if (lead && usedLeadEvidence.has(lead)) continue
    if (lead) usedLeadEvidence.add(lead)
    filtered.push(idea)
  }
  return filtered.map((idea, i) => ({ ...idea, rank: i + 1 }))
}

interface SourceRow {
  body: string
  date: string
  label: string
}

function buildSourceLookup(g: GatherResult): Map<string, SourceRow> {
  const m = new Map<string, SourceRow>()
  for (const r of g.memories) {
    m.set(r.id, { body: `${r.title ?? ''} ${r.body}`.trim(), date: isoDate(r.created_at), label: 'voice note' })
  }
  for (const li of g.list_items) {
    m.set(li.id, { body: li.content, date: isoDate(li.created_at), label: li.list_title ? `${li.list_type} list — ${li.list_title}` : `${li.list_type} list` })
  }
  for (const p of g.active_projects) {
    m.set(p.id, { body: `${p.title} ${p.description ?? ''}`.trim(), date: isoDate(p.updated_at), label: `project: ${p.title}` })
  }
  for (const p of g.dormant_projects) {
    m.set(p.id, { body: `${p.title} ${p.description ?? ''}`.trim(), date: isoDate(p.updated_at), label: `dormant project: ${p.title}` })
  }
  for (const r of g.reading) {
    m.set(r.id, { body: `${r.title ?? ''} ${r.excerpt ?? ''}`.trim(), date: isoDate(r.created_at), label: r.title ? `article: ${r.title}` : 'article' })
  }
  for (const h of g.highlights) {
    m.set(h.id, { body: h.quote, date: isoDate(h.created_at), label: h.article_title ? `highlight from ${h.article_title}` : 'highlight' })
  }
  for (const t of g.todos) {
    m.set(t.id, { body: `${t.text} ${t.notes ?? ''}`.trim(), date: isoDate(t.created_at), label: 'todo' })
  }
  for (const s of g.prior_suggestions) {
    m.set(s.id, { body: s.title, date: '', label: `suggestion: ${s.title}` })
  }
  for (const i of g.ie_ideas) {
    m.set(i.id, { body: `${i.title} ${i.description}`.trim(), date: '', label: `idea-engine: ${i.title}` })
  }
  return m
}

/**
 * If the LLM-supplied excerpt is a verbatim substring of the real source
 * body (whitespace-normalised), keep it. Otherwise fall back to the real
 * body, trimmed — the citation should never let the model put words in
 * the user's mouth.
 */
function verifyOrReplaceExcerpt(claimed: string, body: string): string {
  const normalisedBody = body.replace(/\s+/g, ' ').trim()
  const normalisedClaim = claimed.replace(/\s+/g, ' ').trim()
  if (normalisedClaim && normalisedClaim.length >= 8 && normalisedBody.toLowerCase().includes(normalisedClaim.toLowerCase())) {
    return normalisedClaim.slice(0, 220)
  }
  return truncate(normalisedBody, 220)
}

/**
 * Robust JSON parse with three salvage passes — Pro at 8000 tokens
 * shouldn't truncate often, but when it does we'd rather ship 2 ideas
 * than 0.
 */
function robustJsonParse(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
  // Pass 1: full parse
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  // Pass 2: find the last balanced `}` and try parsing through there
  const lastBrace = trimmed.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(trimmed.slice(0, lastBrace + 1)) } catch { /* fall through */ }
  }
  // Pass 3: extract just the "ideas" array if we can locate a clean
  // closing `]` after `"ideas":` — covers truncation in the trailing
  // metadata after the array.
  const ideasIdx = trimmed.indexOf('"ideas"')
  if (ideasIdx >= 0) {
    const arrStart = trimmed.indexOf('[', ideasIdx)
    const arrEnd = trimmed.lastIndexOf(']')
    if (arrStart > 0 && arrEnd > arrStart) {
      try {
        const arr = JSON.parse(trimmed.slice(arrStart, arrEnd + 1))
        return { ideas: arr }
      } catch { /* fall through */ }
    }
  }
  return null
}

function isoDate(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  const trimmed = s.trim().replace(/\s+/g, ' ')
  return trimmed.length <= n ? trimmed : trimmed.slice(0, n - 1) + '…'
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k) ?? []
    arr.push(it)
    m.set(k, arr)
  }
  return m
}
