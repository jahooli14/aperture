/**
 * Generator — synthesises 3 ranked project ideas from a GatherResult.
 *
 * Single Gemini Flash call, JSON-mode response, 32k output tokens. Flash
 * is cheap enough that we throw budget at the structured prompt rather
 * than try to compress it. Time budget on a 60s Vercel function: ~5s
 * gather + ~30-50s Flash call + ~3s insert.
 *
 * Quality moves baked in (research-driven, then iterated against real
 * outputs that were "wooden box for tech thing" twice in a row):
 *   - Visible TOOLKIT phase. The model enumerates SKILLs/TOOLs/MATERIALs
 *     /DORMANT/OBSESSION/PERSON/LOCATION items WITH a SUBSTRATE tag for
 *     each MATERIAL/TOOL — this is the anti-hallucination check (a model
 *     that has to write "Aperture API: HTTPS endpoint, NOT hardware" up
 *     front can't later put a Vercel app inside a willow box).
 *   - Anti-collapse rule: if any single toolkit item leads >3 of the 10
 *     drafts, the model strikes those drafts and re-drafts from underused
 *     parts of the toolkit. The 10 drafts must collectively lead with ≥6
 *     distinct toolkit items spanning 4 clusters (physical-build, software,
 *     creative, revival). This is the single biggest lever — the model
 *     was finding one convergence and writing 10 variations of it.
 *   - Cluster diversity in PHASE 4: the 3 final picks must lead from 3
 *     different clusters and collectively cite ≥6 distinct toolkit items.
 *     No two picks may share more than ONE toolkit item total.
 *   - Anti-pattern banlist (newsletter/podcast/totem/installation/etc.).
 *   - Each rank slot has a different JOB:
 *       rank 1 INEVITABLE BUILD (most toolkit items at once)
 *       rank 2 SHIP THE DORMANT (revive an abandoned project the new
 *         toolkit makes shippable)
 *       rank 3 STRETCH FROM THE EDGE (70% there, 30% stretch, leading
 *         from a recent acceleration)
 *   - why_now must name an *acceleration in the last 30 days*, not a
 *     static fact about a course finished two months ago.
 *   - next_step must be a build-START (cut, drill, flash, commit, drive,
 *     phone). Banned: measure, research, plan, sketch, outline.
 *   - Evidence excerpts are verified server-side against the real source
 *     body; fabricated quotes are replaced with actual text.
 *   - Diversity filter at parse time: drops a later idea if it shares ≥2
 *     evidence rows with any kept idea (not just the lead row, which the
 *     model can dodge by picking different starting rows for the same
 *     convergence).
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

  // Split active projects: those in the user's focus tier (Keep Going
  // already shows these on the home) are off-limits for "finish/ship X"
  // ideas. Other active projects are eligible — but only via Mode 3
  // (Extend with a NEW direction), never "finish it."
  const focusProjects = g.active_projects.filter(p => p.in_focus)
  const otherActiveProjects = g.active_projects.filter(p => !p.in_focus)
  const focusProjBlock = focusProjects.map(p =>
    `  project#${p.id} [IN FOCUS — Keep Going already showing this] "${p.title}"${p.description ? `\n    ${truncate(p.description, 200)}` : ''}`
  ).join('\n')
  const activeProjBlock = otherActiveProjects.map(p =>
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

  return `You are a friend who's been paying attention. Not a coach. Not a therapist. A maker who would actually build the thing themselves. You write in plain English the way a friend talks. You'd rather say nothing than say something that doesn't ring true.

Your job: find a project whose missing piece just arrived. Most weeks, nothing is ripe. That's fine. Stay quiet rather than make something up.

═══════ HOW TO WRITE ═══════

Plain English. Short sentences. Words people actually say.
NEVER use: "leveraging," "synergies," "soundscapes," "narrative substrate," "feature-rich," "psychological defenses," "high-impact transition," "creative momentum," "experiential."
NEVER invent a hyphenated phrase in scare-quotes ("friction-over-function," "blind-edit"). If the term needs scare-quotes to be understood, rewrite it.
NEVER explain to the user what they "are doing" in coach-voice ("You are shifting from a consumer to a producer of..."). Just say what you'd say to a friend.
ONE idea per sentence. If a sentence has three clauses, it's wrong.
Concrete nouns. "Logic Pro trial expired" beats "your reliance on the 90-day trial of Logic Pro acted as an artificial deadline."
If you can't say it plainly, you don't see the picture clearly enough — drop the idea.

═══════ THE FRAME (READ TWICE) ═══════

A good pick has TWO halves and they must BOTH be real:

  HALF A — A PROJECT-CENTRE that already exists in the data: a thing the user has been quietly building toward for weeks or months, with an artefact-shaped centre. You can name what the finished thing IS in one sentence. This is usually a dormant project, an active project, or a recurring obsession with a clear artefact behind it.

  HALF B — A RECENT ARRIVAL (last ~30 days) that supplies the SPECIFIC missing piece the project-centre was waiting for. Not "thematically related." Not "could be combined with." The missing piece. The thing without which the project couldn't ship.

If you can't name BOTH halves cleanly, there is no idea here. Don't write one.

WORKED EXAMPLE: dormant Raspberry Pi project + accumulated synth-playing intuition = a synth project, 80% formed. RECENT ARRIVAL: woodwork course finished three weeks ago = supplies the case-making skill that was the missing piece. Now possible. Title: "Build your synth." This is the bar.

ANTI-EXAMPLE 1 (rejected): "Wooden mouse-dock." There is no project-centre. "Computer mouse" is a peripheral the user already owns; it isn't an artefact-shaped centre that something could be missing FROM. The voice note "mouses are good" is not an arrival that supplies anything to a real project. This is the model inventing a project to give recent captures a home. Do not do this.

ANTI-EXAMPLE 2 (rejected): "Catch-22 logic-filter for Aperture." Aperture is a real project-centre. But "Catch-22 is your favourite book" is not a recent arrival that supplies a missing piece — it's a stylistic preference. Aperture is not waiting on a paradox-detection feature; nothing about Aperture's design demands one. This is a clever pretend-match. Do not do this.

ANTI-EXAMPLE 3 (rejected): "Paradox-indexed memory palace." A memory palace project is real. A note about Catch-22 is real. But "indexing the memory palace by paradoxes" isn't unblocking the project — the missing piece for a 198-country memory palace is content for the rooms, not a meta-organisational scheme. The match is invented to wedge two real things together.

ANTI-EXAMPLE 4 (rejected): "Finish the Graham song" / "Ship Aperture" / "Complete the bedside table" — when the project is already CURRENTLY IN FOCUS. The home already has a Keep Going card prompting them to start a session on this. Repeating it as an "idea" is duplication. If you can't think of a genuinely NEW direction or extension for an in-focus project that isn't "finish it", drop the idea. Words like "Finish", "Ship", "Complete", "Wrap up" against an in-focus project are an automatic kill.

═══════ THE DATA ═══════

VOICE NOTES (recent, in order):
${memBlock || '  (none)'}

LIST ITEMS (films/books/places — consumption, NOT capability; never lead evidence):
${listBlock || '  (none)'}

CURRENTLY IN FOCUS (Keep Going on the home is already showing these — do NOT propose "finish/ship/complete X" for these. They are NOT project-centres for you):
${focusProjBlock || '  (none)'}

OTHER ACTIVE PROJECTS (eligible only for Mode 3 EXTEND with a genuinely NEW direction — not "finish it"):
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

1. List items (films/books/places) are taste. They are NEVER lead evidence and almost never project-centres.
2. Highlights are thinking-out-loud. They can supply why_now framing. They are NEVER load-bearing.
3. Themes arrays are AI-generated and lossy. Excerpts must come from body text shown above.
4. Idea-engine and prior_suggestions are anti-evidence — what to avoid, not what to build on.
5. Single voice notes that don't tie to a recurring obsession or a named tool/skill cannot be the missing piece. The bar for a "missing piece" is high — it should be something you'd describe to a friend without prompting ("I just finished a woodwork course").

═══════ HOW TO THINK ═══════

Output JSON with keys: centres, arrivals, matches, ideas. Work them in order.

PHASE 1 — CENTRES (3–8 lines).
List the things in the data with an artefact-shaped centre. For each, name the finished thing and what it's been waiting for. Most candidates are dormant projects, active projects with named deliverables, or repeated obsessions with clear physical artefacts (e.g. someone who keeps mentioning the same instrument they want to make). Skip captures that are abstract themes or consumption preferences.
Format:
  "CENTRE: <one-sentence description of the finished thing> [<source_id>] (status: <how formed today>; missing: <what's been blocking it>)"
If there are no real centres, output an empty array — and the rest of the output will also be empty. Don't fake centres to give the model something to do.

PHASE 2 — ARRIVALS (3–10 lines, captures from the LAST 30 DAYS only).
List recent captures (memories, finished courses, recent purchases, dormant project edits, project notes). For each, name what it supplies in concrete terms.
Format:
  "ARRIVAL: <what arrived> [<source_id>] (date: YYYY-MM-DD; supplies: <capability/material/context>)"
Older context is fine in CENTRES; ARRIVALS must be ≤30 days old. If there are no real arrivals, the rest of the output is empty.

PHASE 3 — MATCHES (one line per CENTRE). For each centre, write one of:
  "<centre title>: <arrival id> — <how it supplies the missing piece>"
  OR
  "<centre title>: NO MATCH — nothing in arrivals supplies the missing piece"
Most centres will have NO MATCH. That is correct and expected. If you find yourself stretching to make a match, write NO MATCH and move on. Forced matches are exactly how this surface produced "wooden mouse-dock" and "Catch-22 logic-filter" — those were fake matches that violated the frame.

PHASE 4 — IDEAS (0–3 picks, one per real match from PHASE 3).
Only write ideas where MATCH was real. Do not write 3 ideas to fill a quota. If there is 1 real match, return 1 idea. If 0, return ideas: []. The system is BUILT to return nothing on weeks where nothing is ripe. The user prefers silence over decorative output.

For each idea:
  - title: ≤6 words. Names the artefact or the action ("Build your synth"; "Ship Aperture's homepage"; "Wire the bird cam"). NO abstract nouns: no "exploration," "study," "series," "totem," "memory of," "in conversation with," "investigation into," "meditation on," "the [abstract] of [abstract]," "directory," "tracker," "second brain," "digital garden," "newsletter," "podcast," "Substack," "zine," "installation," "portrait series."
  - pitch: 2–3 sentences. Sentence 1 = name the project that pre-existed AND the missing piece that just arrived ("The Pi-and-synth-playing project has been waiting for a case; the woodwork course that finished three weeks ago is the case-making skill"). Sentence 2 = which toolkit item plays which role. Sentence 3 = what done looks like, in one observable test.
  - why_now: ONE sentence. What arrived in the last 30 days that turns "someday" into "now." If you can't point to something specific that arrived recently, this isn't ripe — drop the idea.
  - next_step: ONE physical action that STARTS the build. Cut, drill, flash, commit (with named file path AND named first content), drive, phone. NOT "create a file" without naming what's in it. NOT "research," "plan," "sketch," "outline," "open settings," "decide," "list," "measure." If the only first action you can name is admin, the idea wasn't actually unblocked — drop it.
  - evidence: 2–5 items, each {kind, source_id, label, date, excerpt}. excerpt must be a verbatim substring of the source body shown above (will be substring-checked). Lead evidence (item 0) is the project-centre. Item 1 should be the recent arrival.
  - rank_role: one of "convergence" | "dormant_revival" | "growing_edge" — best-effort, not strict.

═══════ CALIBRATION ═══════

GOOD: "Build your synth." CENTRE = dormant Pi + accumulated synth-playing (artefact: a custom synth). ARRIVAL = woodwork course finished three weeks ago (supplies: case-making skill). MATCH = real; the case was the missing piece. Title names the artefact in 3 words. Next step is "flash CircuitPython on the Pi tonight, wire one pot to ADC0."

BAD: "Wooden mouse-dock." NO real centre. "Computer mouse" isn't a project. The voice note "mouses are good" is not an arrival that supplies anything. The model invented a centre to use a recent capture. Kill.

BAD: "Catch-22 logic-filter for Aperture." Real centre (Aperture). Fake arrival match — "Catch-22 is your favourite book" is not a missing-piece-supplier; Aperture is not waiting on paradox detection. Kill.

BAD: "Paradox-indexed memory palace." Real centre (memory palace). Fake arrival match — a paradox note doesn't unblock 198 country mappings; the actual missing piece is content. Kill.

═══════ OUTPUT FAILURE MODES ═══════

Returning fewer than 3 ideas is the EXPECTED outcome most weeks. Returning 0 is correct when nothing arrived that completed a real project. Forcing 3 ideas to "look good" produces the fake matches above. Don't do it.

═══════ OUTPUT (strict JSON, no markdown fences) ═══════
{
  "centres": [
    "CENTRE: A custom monosynth built around the Pi [project_dormant#abc] (status: Pi purchased Nov, synth-playing intuition formed; missing: case-making and design)",
    ...
  ],
  "arrivals": [
    "ARRIVAL: Finished beginner woodwork course [memory#def] (date: 2026-04-10; supplies: hand-tool joinery and case-making skill)",
    ...
  ],
  "matches": [
    "Custom monosynth: memory#def — woodwork course supplies the case-making skill the synth project was waiting for",
    "World memory palace: NO MATCH — nothing in arrivals supplies the missing 198 country mappings",
    ...
  ],
  "ideas": [
    {
      "rank": 1,
      "rank_role": "convergence",
      "title": "Build your synth",
      "pitch": "...",
      "why_now": "...",
      "next_step": "...",
      "evidence": [
        { "kind": "project_dormant", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "..." }
      ]
    }
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

      // The model often truncates UUIDs to ~8 chars in its output (likely
      // imitating short-hash style from in-prompt examples). Accept any
      // prefix match — at 6+ chars UUIDs are unique within one user's
      // gather (~100 rows). Resolve to the full id for canonical storage.
      let resolvedId = bareId
      let real = sourceLookup.get(bareId)
      if (!real && bareId.length >= 6 && bareId.length < 36) {
        for (const key of sourceLookup.keys()) {
          if (key.startsWith(bareId)) {
            resolvedId = key
            real = sourceLookup.get(key)
            break
          }
        }
      }
      if (!real) continue // fabricated id
      if (seenSources.has(resolvedId)) continue // dedupe within an idea
      seenSources.add(resolvedId)

      const labelOut = (e.label ?? '').slice(0, 120) || real.label
      const dateOut = real.date || (e.date ?? '').slice(0, 32)
      const excerptOut = verifyOrReplaceExcerpt(e.excerpt ?? '', real.body)
      evidence.push({
        kind: kind as IdeaEvidence['kind'],
        // Persist the canonical full uuid (resolvedId) — the UI never
        // shows source_id, but storing the full form keeps later joins
        // / debugging sane regardless of how the model truncated.
        source_id: resolvedId,
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

  // Forced diversity: drop a later idea if it shares ≥2 evidence rows
  // with any already-kept idea. The previous "lead row only" check was
  // too loose — the model would put up two ideas with different leads
  // that still collapsed onto the same convergence (two variants of
  // "wooden box for tech thing" leading from the woodwork memory and
  // from the Aperture API memory respectively). Sharing 1 row is fine
  // (one source can legitimately support multiple builds); ≥2 means
  // same convergence.
  // Drop "finish/ship X" titles when the cited project is currently in
  // focus — Keep Going is already showing it. Belt-and-braces against
  // the prompt rule.
  const focusIds = new Set(gathered.active_projects.filter(p => p.in_focus).map(p => p.id))
  const FINISH_RE = /^\s*(finish(ing)?|ship(ping)?|complete(\s+the)?|wrap\s*up|polish(\s+the)?)\b/i

  const filtered: ProjectIdea[] = []
  for (const idea of out.sort((a, b) => a.rank - b.rank)) {
    const cited = idea.evidence.map(e => e.source_id)
    const citesFocus = cited.some(id => focusIds.has(id))
    if (citesFocus && FINISH_RE.test(idea.title)) {
      console.log(`[project-ideas] dropped idea "${idea.title}" — "finish/ship X" against in-focus project (Keep Going dup)`)
      continue
    }

    const ids = new Set(cited)
    const collides = filtered.some(kept => {
      const overlap = kept.evidence.filter(e => ids.has(e.source_id)).length
      return overlap >= 2
    })
    if (collides) {
      console.log(`[project-ideas] dropped idea "${idea.title}" — ≥2 evidence overlap with earlier pick`)
      continue
    }
    filtered.push(idea)
  }
  const final = filtered.map((idea, i) => ({ ...idea, rank: i + 1 }))
  if (final.length < 3) {
    console.log(`[project-ideas] only ${final.length} idea(s) shipped — model returned ${ideasRaw.length}, validator/filter dropped ${ideasRaw.length - final.length}`)
  }
  return final
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
