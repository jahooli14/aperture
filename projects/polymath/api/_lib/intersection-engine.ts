/**
 * Intersection Engine — Pattern Discovery in the User's Thinking
 *
 * The core insight: the best crossovers aren't combinations ("A + B = AB").
 * They're latent patterns the user is already creating without knowing it.
 * The AI's job is to notice what the human hasn't — a mechanism, constraint,
 * or principle that keeps showing up across their different projects.
 *
 * The output should feel like a brilliant friend who knows all your work
 * saying: "Have you noticed you keep doing the same thing in three
 * completely different contexts? Here's what that means."
 *
 * Two-phase approach:
 *   1. AI reads the user's projects + their actual thinking (voice notes,
 *      articles) and spots latent structural patterns across domains
 *   2. Embeddings find concrete memories/articles that bridge the pattern
 *
 * See docs/INTERSECTIONS.md for the full intellectual framework.
 */

import { generateText } from './gemini-chat.js'
import { cosineSimilarity } from './gemini-embeddings.js'
import { MODELS } from './models.js'

// --- Types matching the frontend contract (WeeklyIntersection.tsx) ---

export type IntersectionNodeType = 'project' | 'memory' | 'list_item'

export interface IntersectionNode {
  id: string
  title: string
  type: IntersectionNodeType
}

export interface IntersectionResult {
  id: string
  /** @deprecated kept for backwards compat — prefer nodes */
  projectIds: string[]
  /** @deprecated kept for backwards compat — prefer nodes */
  projects: Array<{ id: string; title: string }>
  /** All collision participants (projects + thoughts + list items) */
  nodes: IntersectionNode[]
  score: number
  sharedFuel: Array<{ type: string; title: string; id: string }>
  reason?: string
  crossover?: {
    crossover_title: string
    why_it_works: string
    concept: string
    first_steps: string[]
  }
}

interface RawCandidate {
  /** Preferred field — mixed node IDs (projects, memories, list items). */
  node_ids?: string[]
  /** Legacy field name — still accepted for backwards compat. */
  project_ids?: string[]
  pattern_name: string
  the_insight: string
  why_its_not_obvious: string
  what_it_unlocks: string
  one_thing_to_try: string
  further_steps: string[]
  non_obvious_score: number
}

export interface ProjectInput {
  id: string
  title: string
  description: string | null
  embedding: number[] | null
  metadata: any
  status: string
}

export interface MemoryInput {
  id: string
  title: string | null
  body: string | null
  themes: string[] | null
  embedding: number[] | null
}

export interface ArticleInput {
  id: string
  title: string | null
  summary: string | null
  embedding: number[] | null
}

export interface ListItemInput {
  id: string
  content: string | null
  metadata: any
  embedding: number[] | null
}

const FUEL_BRIDGE_THRESHOLD = 0.52

/**
 * Past feedback the user has given on previous weeks of cards. Passed into
 * generation so the AI can avoid disliked themes and lean into liked ones.
 * Sourced by intersection-weekly.ts from weekly_intersections_history.
 *
 * `alreadySeen` is the full history of crossover titles ever shown to this
 * user (regardless of feedback). The prompt uses it as a "do not repeat"
 * list, and intersection-weekly.ts also runs a post-generation filter so the
 * same idea cannot resurface even if the model ignores the instruction.
 */
export interface PriorFeedback {
  liked: string[]        // crossover_titles the user said "Shape this idea" on
  disliked: string[]     // crossover_titles the user said "Not for me" on
  alreadySeen?: string[] // every crossover_title ever generated for this user
}

/**
 * Normalise a crossover title for duplicate comparison: lowercase, strip
 * punctuation, collapse whitespace. Two titles that normalise to the same
 * string are treated as the same idea.
 */
export function normalizeTitle(title: string | null | undefined): string {
  if (!title) return ''
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cap each deck (mashups + insights) at this many cards. */
const MAX_CARDS_PER_DECK = 3

/**
 * Main entry point.
 * Builds rich per-project context from associated memories, then asks the AI
 * to spot latent patterns across the user's thinking.
 */
export async function discoverIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[],
  listItems: ListItemInput[] = [],
  priorFeedback: PriorFeedback = { liked: [], disliked: [] }
): Promise<IntersectionResult[]> {
  if (projects.length < 2) return []

  // --- Phase 1: Build rich context ---
  // For each project, find the user's actual thinking about it (voice notes,
  // articles they've connected to it). This gives the AI substance to work
  // with — not just "Baby photo app" but the WHY and HOW behind it.
  const richContext = buildRichProjectContext(projects, memories, articles, listItems)

  // --- Phase 2: Pro spots latent patterns ---
  // If Pro fails or returns nothing, return empty rather than silently
  // masking with embedding+narration. The MASHUPS deck (classicIntersections)
  // is a separate path that still renders; this deck (INSIGHTS) stays empty
  // when Pro can't produce a 7+ observation. That's honest and visible —
  // previously the fallback hid failure behind weak Flash prose.
  let candidates: RawCandidate[]
  try {
    candidates = await discoverPatterns(projects, richContext, priorFeedback)
  } catch (err) {
    console.error('[intersection-engine] discoverIntersections: Pro call failed, returning empty (no silent fallback):', err)
    return []
  }

  console.log('[intersection-engine] discoverIntersections: Pro returned', candidates.length, 'candidates')

  if (candidates.length === 0) {
    console.warn('[intersection-engine] discoverIntersections: Pro returned zero candidates \u2014 nothing scored 7+. Returning empty.')
    return []
  }

  // --- Phase 3: Find supporting fuel via embeddings ---
  // Build lookup tables across ALL candidate pools. The AI prompt tells the
  // model that collisions can mix projects, thoughts, and list items, so the
  // IDs it returns may come from any of those pools — not just projects.
  const projectById = new Map(projects.map(p => [p.id, p]))
  const memoryById = new Map(memories.map(m => [m.id, m]))
  const listItemById = new Map(listItems.map(li => [li.id, li]))

  const results: IntersectionResult[] = []
  let droppedMissingId = 0
  let droppedTooSmall = 0
  let droppedNoProject = 0

  for (const candidate of candidates) {
    const rawIds = candidate.node_ids ?? candidate.project_ids ?? []
    const matchedNodes: IntersectionNode[] = []
    const matchedProjects: ProjectInput[] = []

    for (const id of rawIds) {
      const p = projectById.get(id)
      if (p) {
        matchedNodes.push({ id: p.id, title: p.title, type: 'project' })
        matchedProjects.push(p)
        continue
      }
      const m = memoryById.get(id)
      if (m) {
        const title = (m.title && m.title.trim()) || m.body?.slice(0, 50).trim() || 'Thought'
        matchedNodes.push({ id: m.id, title, type: 'memory' })
        continue
      }
      const li = listItemById.get(id)
      if (li) {
        const title = li.content?.slice(0, 60).trim() || 'List item'
        matchedNodes.push({ id: li.id, title, type: 'list_item' })
        continue
      }
      droppedMissingId++
    }

    // Need at least 2 total nodes AND at least one project (keeps results
    // grounded — a collision with no project anchor is noise).
    if (matchedNodes.length < 2) { droppedTooSmall++; continue }
    if (matchedProjects.length === 0) { droppedNoProject++; continue }

    const fuel = findSupportingFuel(matchedProjects, memories, articles)
    const projectIds = matchedProjects.map(p => p.id)

    results.push({
      id: matchedNodes.map(n => n.id).sort().join(','),
      projectIds,
      projects: matchedProjects.map(p => ({ id: p.id, title: p.title })),
      nodes: matchedNodes,
      score: (candidate.non_obvious_score || 7) * (matchedNodes.length * 0.8),
      sharedFuel: fuel.slice(0, 8),
      reason: candidate.the_insight,
      crossover: {
        crossover_title: candidate.pattern_name,
        why_it_works: candidate.why_its_not_obvious,
        concept: candidate.what_it_unlocks,
        first_steps: [
          candidate.one_thing_to_try,
          ...(candidate.further_steps || [])
        ].filter(Boolean).slice(0, 3)
      }
    })
  }

  if (results.length === 0) {
    console.warn('[intersection-engine] discoverIntersections: all candidates dropped by filters', {
      rawCandidates: candidates.length,
      droppedMissingId,
      droppedTooSmall,
      droppedNoProject,
    })
    return []
  }

  console.log('[intersection-engine] discoverIntersections: kept', results.length, 'of', candidates.length, 'candidates', {
    droppedMissingId,
    droppedTooSmall,
    droppedNoProject,
  })

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, MAX_CARDS_PER_DECK)
}

/**
 * Build rich context for each project by finding the most relevant memories
 * and articles. This gives the AI the user's actual THINKING — their voice
 * notes, the things they've read, the problems they're mulling over — not
 * just a title and a blurb.
 *
 * Also lists standalone thoughts and list items (things the user wrote down
 * that don't belong to any project) so the AI can find patterns that cross
 * project boundaries OR connect a stray thought to a project.
 */
function buildRichProjectContext(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[],
  listItems: ListItemInput[] = []
): string {
  const memoriesWithEmbeddings = memories.filter(m => m.embedding)
  const articlesWithEmbeddings = articles.filter(a => a.embedding)
  const projectEmbeddings = projects.filter(p => p.embedding).map(p => p.embedding!)

  const projectBlocks = projects.slice(0, 12).map(p => {
    let context = `[${p.id}] "${p.title}"`
    if (p.description) context += `\n${p.description.slice(0, 500)}`

    // Find the user's recent thinking about this project (top 3 most relevant memories)
    if (p.embedding && memoriesWithEmbeddings.length > 0) {
      const related = memoriesWithEmbeddings
        .map(m => ({ m, sim: cosineSimilarity(m.embedding!, p.embedding!) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 3)
        .filter(x => x.sim > 0.45)

      if (related.length > 0) {
        context += `\nWhat they've been thinking about this:`
        for (const { m } of related) {
          const text = m.body?.slice(0, 300) || m.title || ''
          if (text) context += `\n  > "${text}"`
        }
      }
    }

    // Find related reading (top 2 most relevant articles)
    if (p.embedding && articlesWithEmbeddings.length > 0) {
      const related = articlesWithEmbeddings
        .map(a => ({ a, sim: cosineSimilarity(a.embedding!, p.embedding!) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 2)
        .filter(x => x.sim > 0.45)

      if (related.length > 0) {
        context += `\nWhat they've been reading:`
        for (const { a } of related) {
          const label = a.title || 'Article'
          context += `\n  > "${label}"${a.summary ? ` — ${a.summary.slice(0, 150)}` : ''}`
        }
      }
    }

    return context
  }).join('\n\n---\n\n')

  // Orphan thoughts: memories NOT strongly attached to any project. These are
  // standalone ideas the user had that don't fit neatly in one bucket — exactly
  // the kind of thing that can collide with a project from a different angle.
  const orphanMemories = memoriesWithEmbeddings
    .filter(m => {
      if (!projectEmbeddings.length) return true
      const maxSim = Math.max(...projectEmbeddings.map(e => cosineSimilarity(m.embedding!, e)))
      return maxSim < 0.55
    })
    .filter(m => (m.body?.length ?? 0) > 40)
    .slice(0, 8)

  let orphanBlock = ''
  if (orphanMemories.length > 0) {
    orphanBlock = '\n\n---\n\nSTANDALONE THOUGHTS (not tied to any specific project — these can still be collision points):\n'
    for (const m of orphanMemories) {
      const text = m.body?.slice(0, 250) || m.title || ''
      if (text) orphanBlock += `\n[${m.id}] (thought) > "${text}"`
    }
  }

  // List items with substance. Things the user has jotted to read/try/build.
  const richListItems = listItems
    .filter(li => (li.content?.length ?? 0) > 20)
    .slice(0, 12)

  let listBlock = ''
  if (richListItems.length > 0) {
    listBlock = '\n\n---\n\nLIST ITEMS (things they\'ve noted to read/try/consider — also valid collision points):\n'
    for (const li of richListItems) {
      const text = li.content?.slice(0, 200) || ''
      if (text) listBlock += `\n[${li.id}] (list item) > "${text}"`
    }
  }

  return projectBlocks + orphanBlock + listBlock
}

/**
 * The core discovery step. Asks the AI to read through everything the user
 * has been working on and thinking about, then spot patterns they haven't
 * noticed in their own thinking.
 *
 * Critical framing: "What patterns has this person not noticed?" —
 * NOT "How can these projects be combined?"
 */
async function discoverPatterns(
  projects: ProjectInput[],
  richContext: string,
  priorFeedback: PriorFeedback = { liked: [], disliked: [] }
): Promise<RawCandidate[]> {

  const numProjects = projects.length
  const targetCount = Math.min(4, Math.max(2, Math.floor(numProjects * 0.7)))

  const feedbackBlock = buildFeedbackPromptBlock(priorFeedback)

  const prompt = `You are reading through everything one person has been working on and thinking about recently. Your job is NOT to propose new products. Your job is to catch THEM doing something they haven't noticed about themselves.

The output you're writing is an observation, not a pitch. Imagine you're the person's sharpest friend, and you just realised something about how they think. You're saying it back to them.

HERE IS EVERYTHING THIS PERSON IS WORKING ON AND THINKING ABOUT:

${richContext}

---

WHAT MAKES A GREAT CROSSOVER vs A FORGETTABLE ONE:

A great crossover is an OBSERVATION about the person. It names a mechanism, habit, or tension that's already operating in their work — they just never put words on it. Once you point it out, they can't unsee it.

A bad crossover is a MASHUP. It combines two things into a new product. "Walkable library app", "interactive book portals", "centuries-long dream sci-fi" — all mashups. They describe a hypothetical product the person might build. Nobody's brain lights up reading a feature spec.

BANNED OPENING PHRASES (if your insight starts with any of these, delete it and try again):
- "If you put these together…"
- "If you combine…"
- "You've basically designed…"
- "You could build…"
- "You could write…"
- "Imagine a…"
- "What if you…"
- "This lets you…"
- "Together they form…"

REQUIRED OPENING: Start \`the_insight\` with "You" followed by a verb that describes what the person is ALREADY DOING. Good openers: "You keep…", "You already…", "You notice…", "You're quietly…", "You've been…", "You treat…". The first word of the insight should be "You". Full stop.

EXAMPLES OF THE DIFFERENCE:

BAD: "If you combine your dream ideas with the long now concept, you could write about people who live for centuries and spend fifty years at a time inside a single vivid dream."
— Product pitch. Science fiction premise. Says nothing about the person.

BAD: "You've basically designed a book that works like a board game map. You could use the memory house as the layout and make every replaced object a portal."
— Starts with a mashup opener. Describes a product, not a pattern.

GOOD: "You keep solving the same problem in three different disguises. The baby app is signal detection in photos. The knowledge graph is signal detection in thoughts. The bird migration article you saved is signal detection in positions. You've accidentally become an expert in one very specific thing."
— Observation about the person. Names a mechanism (signal detection). Makes them reconsider what their work is really about.

GOOD: "You write tools to impose structure, then you write tools to escape it. The book editor shapes raw creativity into form. The voice capture tool deliberately refuses to shape anything. You're building both ends of a process you haven't joined up yet — the bridge from loose thought to finished work is the thing missing from both."
— Names a tension already present in the work. Not a product. An observation about the person's ambivalence.

${feedbackBlock}
YOUR RULES:

1. OBSERVATION, not product. Every crossover must describe something the person is ALREADY DOING across their work. If the insight only makes sense as a new thing to build, it's a mashup — reject it.

2. Start with "You" + present/present-continuous verb. No conditional, no hypothetical. Not "you could", not "if you". Just: "You keep…", "You already…", "You treat…".

3. Name the MECHANISM in 3-6 words. \`pattern_name\` must name the thing the person is doing — "Signal detection across media", "Structure-then-escape loop", "Constraint as creative trigger". Not a poetic title, not a product name. If it would work as a book chapter heading about this person, you're close.

4. Find patterns that span 3-5 items when possible. A pattern across 3 items is far more interesting than one across 2.${numProjects >= 4 ? ' You have enough ideas here.' : ''} Mix projects, thoughts, and list items freely.

5. Keep \`the_insight\` to 2-3 sentences. If it needs more, it's not elegant enough.

6. Be specific to THIS person. Reference actual project titles, actual phrases they used, actual things they've read. Generic insights ("cross-pollination is powerful") score 0.

7. PLAIN ENGLISH. BANNED words: stochastic, ontological, epistemological, heuristic, emergent, bifurcation, recursion, isomorphism, bisociation, exaptation, orthogonal, teleological, dialectical, paradigm, meta-, -ness, -icity, actualize, paradigmatic, topology. If a word is over 4 syllables, double-check it. A 14-year-old should understand every word.

8. Each field has a distinct job — don't repeat yourself across fields:
   - \`the_insight\` = THE OBSERVATION. What is the person already doing? (Starts with "You".)
   - \`why_its_not_obvious\` = Why hasn't the person spotted this themselves? What made it invisible?
   - \`what_it_unlocks\` = How does seeing this change the way they think about their own work? (NOT a product. A shift in self-understanding.)
   - \`one_thing_to_try\` = A small concrete experiment they could run THIS WEEK with tools they already have. Name the specific project, specific file, specific person. Never "pick a thing from your list" — tell them which thing.
   - \`further_steps\` = 0-2 optional next experiments, same quality bar. Empty array is fine.

9. SCORING CALIBRATION (non_obvious_score):
   - 10: Would make the person physically stop scrolling. Names something they've been circling for months without words. Changes how they'd describe their own work at a dinner party.
   - 8-9: Solid observation. Non-obvious. Specific. Clearly about THIS person.
   - 7: Defensible but not electric. Keep only if you can't do better.
   - Below 7: Don't return it.

Return a JSON array of UP TO ${targetCount} crossovers (fewer is fine — NEVER force a weak one). If nothing scores 7+, return an empty array. No preamble, no markdown, just JSON.

For each crossover:

{
  "node_ids": ["id1", "id2", "id3"],
  "pattern_name": "3-6 words naming the mechanism",
  "the_insight": "2-3 sentences. Must start with 'You'. Observation, not pitch.",
  "why_its_not_obvious": "1 sentence. Why has this stayed invisible to them?",
  "what_it_unlocks": "1 sentence. A shift in how they see their own work. Not a product.",
  "one_thing_to_try": "1 sentence. A specific experiment this week using tools/projects they already have. Name the actual thing.",
  "further_steps": ["optional specific step", "optional specific step"],
  "non_obvious_score": 7-10
}

node_ids: use the EXACT bracketed IDs from the list above. Mix projects, standalone thoughts, and list items freely. At least ONE ID MUST be a project. No crossover with zero projects.

Sort by non_obvious_score descending. Be terse — long fields will get truncated.`

  // Pro: cross-project pattern discovery is the core synthesis step of this
  // engine. Narration below (narrateClusters) stays on Flash — it only dresses
  // up clusters Pro has already picked.
  const raw = await generateText(prompt, {
    model: MODELS.PRO,
    responseFormat: 'json',
    temperature: 1.0,
    maxTokens: 8192,
  })

  const parsed = parseCandidatesJSON(raw)
  if (!Array.isArray(parsed)) return []

  return parsed.filter((c: any) => {
    const ids = Array.isArray(c.node_ids) ? c.node_ids : Array.isArray(c.project_ids) ? c.project_ids : null
    return (
      ids !== null &&
      ids.length >= 2 &&
      typeof c.the_insight === 'string' &&
      typeof c.pattern_name === 'string'
    )
  }) as RawCandidate[]
}

/**
 * Parse Gemini JSON output, repairing truncation if needed.
 * If the response was cut off mid-string (token limit hit), trim back to the
 * last complete object and close the array. Better to keep N-1 valid candidates
 * than throw and lose them all.
 */
export function parseCandidatesJSON(raw: string): any[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Truncated — try to recover whatever complete objects we got
    const startIdx = raw.indexOf('[')
    if (startIdx === -1) return []
    // Find the last complete top-level object: scan for "}," at depth 1
    let depth = 0
    let inString = false
    let escape = false
    let lastCompleteEnd = -1
    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i]
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') {
        depth--
        if (depth === 1 && ch === '}') lastCompleteEnd = i
      }
    }
    if (lastCompleteEnd === -1) return []
    const repaired = raw.slice(startIdx, lastCompleteEnd + 1) + ']'
    try {
      const parsed = JSON.parse(repaired)
      console.warn('[intersection-engine] Recovered truncated JSON:', Array.isArray(parsed) ? parsed.length : 0, 'candidates')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

/**
 * Find memories and articles that semantically bridge the intersection's projects.
 * A fuel item is a "bridge" if it relates to 2+ of the projects in the crossover.
 */
function findSupportingFuel(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): Array<{ type: string; title: string; id: string }> {
  const fuel: Array<{ type: string; title: string; id: string; avgSim: number }> = []

  for (const mem of memories) {
    if (!mem.embedding) continue
    const sims = projects.map(p =>
      p.embedding ? cosineSimilarity(mem.embedding!, p.embedding) : 0
    )
    const bridgeCount = sims.filter(s => s > FUEL_BRIDGE_THRESHOLD).length
    if (bridgeCount >= 2) {
      const avg = sims.reduce((a, b) => a + b, 0) / sims.length
      fuel.push({
        type: 'memory',
        title: mem.title || mem.body?.substring(0, 60) || 'Thought',
        id: mem.id,
        avgSim: avg
      })
    }
  }

  for (const art of articles) {
    if (!art.embedding) continue
    const sims = projects.map(p =>
      p.embedding ? cosineSimilarity(art.embedding!, p.embedding) : 0
    )
    const bridgeCount = sims.filter(s => s > FUEL_BRIDGE_THRESHOLD).length
    if (bridgeCount >= 2) {
      const avg = sims.reduce((a, b) => a + b, 0) / sims.length
      fuel.push({
        type: 'article',
        title: art.title || 'Article',
        id: art.id,
        avgSim: avg
      })
    }
  }

  fuel.sort((a, b) => b.avgSim - a.avgSim)
  return fuel.map(({ avgSim, ...rest }) => rest)
}

/**
 * Classic approach: embedding-based cluster discovery + AI narration.
 * Finds multi-node clusters (projects + substantial memories + list items)
 * using greedy cosine-similarity clustering. Each cluster gets an AI-generated
 * "what if you combined these" story.
 */
export async function classicIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[],
  listItems: ListItemInput[] = [],
  _priorFeedback: PriorFeedback = { liked: [], disliked: [] }
): Promise<IntersectionResult[]> {
  // Note: priorFeedback isn't used inside the embedding clustering itself
  // (the geometry doesn't know about user preference), but the post-filter in
  // intersection-weekly.ts drops any classic card whose title matches a
  // disliked theme. The argument is accepted to keep the call site symmetric
  // with discoverIntersections.
  const results = embeddingBasedDiscovery(projects, memories, articles, listItems)
  if (results.length === 0) {
    console.warn('[intersection-engine] classicIntersections produced zero clusters', {
      projects: projects.length,
      memoriesWithEmbeddings: memories.filter(m => m.embedding).length,
      listItemsWithEmbeddings: listItems.filter(li => li.embedding).length,
    })
    return results
  }

  console.log('[intersection-engine] classicIntersections: found', results.length, 'embedding clusters, narrating with Pro')

  await narrateClusters(results)

  const narrated = results.filter(r => r.reason && r.crossover).length
  console.log('[intersection-engine] classicIntersections: narrated', narrated, 'of', results.length, 'clusters')

  return results
}

/**
 * Generate `reason` and `crossover` for every cluster in-place. Used by the
 * classic embedding pipeline (whose clusters come from cosine-similarity
 * geometry and therefore arrive without any narrative attached).
 *
 * Uses Pro — the same model that powers discoverIntersections — because the
 * narration IS the insight. Flash produced product-pitch prose ("if you put
 * these together you could build X") that read exactly like the mashups the
 * Pro prompt bans. Upgrading the model + rewriting the prompt keeps the
 * MASHUPS deck quality consistent with the INSIGHTS deck.
 */
export async function narrateClusters(clusters: IntersectionResult[]): Promise<void> {
  if (clusters.length === 0) return
  const results = await Promise.allSettled(clusters.map(async (intersection) => {
    // Skip if already fully populated upstream.
    if (intersection.reason && intersection.crossover) return

    const nodeLabel = intersection.nodes
      .map(n => n.type === 'project' ? `the project "${n.title}"` : n.type === 'memory' ? `a thought: "${n.title}"` : `a list item: "${n.title}"`)
      .join(' + ')
    const fuelContext = intersection.sharedFuel.slice(0, 5).map(f => `${f.type}: "${f.title}"`).join(', ')

    const prompt = `One person has these things on their mind: ${nodeLabel}.${fuelContext ? ` Things that keep showing up across them: ${fuelContext}.` : ''}

These items are related — the geometry of the person's thinking connects them. Your job is to name WHAT the person is already doing across these items. Not to propose a product.

BANNED OPENING PHRASES for every field:
- "If you put these together…"
- "If you combine…"
- "You've basically designed…"
- "You could build…" / "You could write…"
- "Imagine a…" / "What if…"
- "Together they form…"
- "This lets you…"

REQUIRED OPENING for \`reason\`: start with "You" + a verb that describes what the person is already doing ("You keep…", "You already…", "You treat…", "You notice…"). Observation, not hypothesis.

GOOD reason: "You keep framing the same question in new clothes. In the book editor it's 'how do you impose structure on chaos'. In the voice capture tool it's 'how do you keep chaos alive long enough to hear it'. Same question, opposite directions."

BAD reason: "If you put these together, you could build a tool that handles both structured writing and voice capture." ← That's a product pitch. Banned.

RULES:
- \`reason\`: 2-3 sentences. Starts with "You". An observation about a mechanism, habit, or tension already operating across these items.
- \`crossover_title\`: 3-6 words naming the mechanism itself (not a poetic title, not a product name). E.g. "Signal detection across media", "Structure-then-escape loop".
- \`why_it_works\`: 1 sentence. Why is this worth naming?
- \`concept\`: 2 sentences. How does seeing this pattern change how the person could approach their work? NOT "build X". A shift in stance.
- \`first_steps\`: 2-3 items. Each must be a specific experiment this person could run THIS WEEK using a project they already have. Name the actual project or thing. Never "pick a thing from your list".

PLAIN ENGLISH. BANNED words: stochastic, ontological, emergent, heuristic, isomorphism, paradigm, teleological, epistemological, bifurcation, exaptation, orthogonal, dialectical, paradigmatic. A 14-year-old should understand every word.

Return JSON:
{"reason":"2-3 sentences starting with 'You'","crossover_title":"3-6 word mechanism name","why_it_works":"1 sentence","concept":"2 sentences about the shift in stance","first_steps":["specific experiment","specific experiment","specific experiment"]}`

    const raw = await generateText(prompt, {
      model: MODELS.PRO,
      responseFormat: 'json',
      temperature: 0.9,
      maxTokens: 1024,
    })

    let parsed: {
      reason?: string
      crossover_title?: string
      why_it_works?: string
      concept?: string
      first_steps?: string[]
    }
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.warn('[intersection-engine] narrateClusters: failed to parse Pro JSON', {
        clusterId: intersection.id,
        err: err instanceof Error ? err.message : String(err),
      })
      return
    }

    if (!intersection.reason && parsed.reason) {
      intersection.reason = parsed.reason
    }
    if (!intersection.crossover && parsed.crossover_title) {
      intersection.crossover = {
        crossover_title: parsed.crossover_title,
        why_it_works: parsed.why_it_works || '',
        concept: parsed.concept || '',
        first_steps: Array.isArray(parsed.first_steps) ? parsed.first_steps.slice(0, 3) : [],
      }
    }
  }))

  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    console.warn('[intersection-engine] narrateClusters: Pro narration failed for', failed, 'of', clusters.length, 'clusters')
  }
}

/**
 * Build a small "lessons from past weeks" block to prepend to the discovery
 * prompt. We don't dump the whole history — just enough signal to bias the
 * model away from disliked themes and toward themes the user has previously
 * said "Shape this idea" on. Mirrors insights-generator.ts:155-163.
 */
function buildFeedbackPromptBlock(feedback: PriorFeedback): string {
  const alreadySeen = feedback.alreadySeen ?? []
  if (
    feedback.liked.length === 0 &&
    feedback.disliked.length === 0 &&
    alreadySeen.length === 0
  ) {
    return ''
  }
  const lines: string[] = ['', 'WHAT THIS PERSON HAS PREVIOUSLY TOLD YOU:']
  if (feedback.liked.length > 0) {
    lines.push(`They got excited about and started exploring: ${feedback.liked.slice(0, 6).map(t => `"${t}"`).join(', ')}. Lean into themes like these — pattern, mechanism, the kind of thinking that lights them up.`)
  }
  if (feedback.disliked.length > 0) {
    lines.push(`They explicitly rejected (don't repeat or echo these): ${feedback.disliked.slice(0, 8).map(t => `"${t}"`).join(', ')}. Avoid resurfacing the same idea with different words.`)
  }
  if (alreadySeen.length > 0) {
    // Cap the list so the prompt doesn't blow up after months of weekly runs.
    // The post-generation filter in intersection-weekly.ts is the safety net
    // for anything beyond this window.
    const recent = alreadySeen.slice(0, 40)
    lines.push(`They have ALREADY been shown these crossovers in past weeks — do NOT generate any of them again, and do not just rephrase them with new wording: ${recent.map(t => `"${t}"`).join(', ')}. Each new crossover must be a fundamentally different idea, not a restatement.`)
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Embedding-based cluster discovery (no AI enrichment).
 *
 * Unlike the old pair-only version, this finds clusters of 2-5 nodes of
 * MIXED types: projects, substantial memories, and list items. A 3-way
 * cluster (e.g. "baby app + memory about pattern recognition + list item
 * about bird migration") is more interesting than a bare pair, so we
 * extend pairs greedily by adding any node that's similar to ALL current
 * members within the useful range.
 *
 * Used as fallback when AI discovery fails, and as the base for classicIntersections.
 */
export function embeddingBasedDiscovery(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[],
  listItems: ListItemInput[] = []
): IntersectionResult[] {
  // Build a unified candidate pool with mixed node types.
  // A candidate is any item with an embedding that has enough substance to
  // "collide" — for projects that's always true; for memories/list items we
  // filter by text length to exclude one-liners.
  type Candidate = { id: string; title: string; type: IntersectionNodeType; embedding: number[] }
  const candidates: Candidate[] = []

  for (const p of projects) {
    if (p.embedding) candidates.push({ id: p.id, title: p.title, type: 'project', embedding: p.embedding })
  }
  for (const m of memories) {
    if (!m.embedding) continue
    if ((m.body?.length ?? 0) < 60) continue // substance filter
    const title = (m.title && m.title.trim()) || m.body?.slice(0, 50).trim() || 'Thought'
    candidates.push({ id: m.id, title, type: 'memory', embedding: m.embedding })
  }
  for (const li of listItems) {
    if (!li.embedding) continue
    if ((li.content?.length ?? 0) < 30) continue
    const title = li.content?.slice(0, 60).trim() || 'List item'
    candidates.push({ id: li.id, title, type: 'list_item', embedding: li.embedding })
  }

  if (candidates.length < 2) return []

  // Pairwise similarity matrix (only computed once)
  const n = candidates.length
  const sims: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sims[i][j] = sims[j][i] = cosineSimilarity(candidates[i].embedding, candidates[j].embedding)
    }
  }

  // Sweet-spot similarity range: close enough to be connected, far enough to
  // not be redundant. Memories often land closer to their parent project, so
  // we allow a wider upper bound.
  const LOWER = 0.38
  const UPPER = 0.82

  // Generate clusters by extending every useful pair greedily.
  const clusters: Array<{ indices: number[]; avgSim: number }> = []

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (sims[i][j] < LOWER || sims[i][j] > UPPER) continue
      const members = [i, j]
      // Try to extend with nodes that are similar to ALL current members
      // (sorted by their average similarity to the seed pair to prefer strong adds)
      const extCandidates = Array.from({ length: n }, (_, k) => k)
        .filter(k => k !== i && k !== j)
        .map(k => ({ k, avg: (sims[i][k] + sims[j][k]) / 2 }))
        .sort((a, b) => b.avg - a.avg)
      for (const { k } of extCandidates) {
        const simsToAll = members.map(m => sims[m][k])
        if (simsToAll.every(s => s >= LOWER && s <= UPPER)) {
          members.push(k)
          if (members.length >= 5) break
        }
      }
      // Average pairwise sim
      let total = 0
      let count = 0
      for (let a = 0; a < members.length; a++) {
        for (let b = a + 1; b < members.length; b++) {
          total += sims[members[a]][members[b]]
          count++
        }
      }
      clusters.push({ indices: [...members].sort((a, b) => a - b), avgSim: count > 0 ? total / count : 0 })
    }
  }

  // Dedupe by member set; keep the strongest scoring version
  const seen = new Map<string, { indices: number[]; avgSim: number }>()
  for (const c of clusters) {
    const key = c.indices.join(',')
    const existing = seen.get(key)
    if (!existing || c.avgSim > existing.avgSim) seen.set(key, c)
  }

  // Filter: every cluster should contain AT LEAST ONE project (keeps results
  // grounded — pure thought/list clusters are noise without a project anchor).
  // Prefer larger clusters and higher similarity.
  const clusterList = Array.from(seen.values())
    .filter(c => c.indices.some(idx => candidates[idx].type === 'project'))
    .sort((a, b) => {
      const sizeBonusA = (a.indices.length - 2) * 0.15
      const sizeBonusB = (b.indices.length - 2) * 0.15
      return (b.avgSim + sizeBonusB) - (a.avgSim + sizeBonusA)
    })

  // Aggressive suppression of overlap: skip clusters that share >1 members
  // with an earlier, better-scoring cluster. This keeps the final list diverse.
  const picked: Array<{ indices: number[]; avgSim: number }> = []
  for (const c of clusterList) {
    const overlapsTooMuch = picked.some(p => {
      const shared = p.indices.filter(i => c.indices.includes(i)).length
      return shared > 1
    })
    if (!overlapsTooMuch) picked.push(c)
    if (picked.length >= MAX_CARDS_PER_DECK) break
  }

  // Build final results with supporting fuel
  return picked.map(cluster => {
    const nodes = cluster.indices.map(idx => candidates[idx])
    const projectNodes = nodes.filter(n => n.type === 'project')
    const projectInputs = projectNodes
      .map(n => projects.find(p => p.id === n.id))
      .filter((p): p is ProjectInput => !!p)
    const fuel = findSupportingFuel(projectInputs, memories, articles)

    return {
      id: cluster.indices.map(i => candidates[i].id).sort().join(','),
      projectIds: projectNodes.map(n => n.id),
      projects: projectNodes.map(n => ({ id: n.id, title: n.title })),
      nodes: nodes.map(n => ({ id: n.id, title: n.title, type: n.type })),
      score: 2 * cluster.avgSim + nodes.length * 0.3 + fuel.length * 0.1,
      sharedFuel: fuel.slice(0, 8),
    }
  })
}
