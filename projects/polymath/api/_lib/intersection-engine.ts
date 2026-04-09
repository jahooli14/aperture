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
 * Main entry point.
 * Builds rich per-project context from associated memories, then asks the AI
 * to spot latent patterns across the user's thinking.
 */
export async function discoverIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[],
  listItems: ListItemInput[] = []
): Promise<IntersectionResult[]> {
  if (projects.length < 2) return []

  // --- Phase 1: Build rich context ---
  // For each project, find the user's actual thinking about it (voice notes,
  // articles they've connected to it). This gives the AI substance to work
  // with — not just "Baby photo app" but the WHY and HOW behind it.
  const richContext = buildRichProjectContext(projects, memories, articles, listItems)

  // --- Phase 2: AI spots latent patterns ---
  let candidates: RawCandidate[]
  try {
    candidates = await discoverPatterns(projects, richContext)
  } catch (err) {
    console.error('[intersection-engine] AI discovery failed, falling back to embedding-based:', err)
    return embeddingBasedDiscovery(projects, memories, articles, listItems)
  }

  if (candidates.length === 0) {
    return embeddingBasedDiscovery(projects, memories, articles, listItems)
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
    console.warn('[intersection-engine] discoverIntersections dropped all candidates', {
      rawCandidates: candidates.length,
      droppedMissingId,
      droppedTooSmall,
      droppedNoProject,
    })
    // Fall back rather than return nothing — the UI just shows an empty section otherwise.
    return embeddingBasedDiscovery(projects, memories, articles, listItems)
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 5)
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
  richContext: string
): Promise<RawCandidate[]> {

  const numProjects = projects.length
  const targetCount = Math.min(4, Math.max(2, Math.floor(numProjects * 0.7)))

  const prompt = `You are reading through everything one person has been working on and thinking about recently. Your job: spot patterns in their thinking that THEY haven't noticed yet.

This is not about combining projects into one product. That's boring. This is about finding a hidden thread — a mechanism, a constraint, a principle — that keeps showing up across their work in different disguises. Something that, once pointed out, makes them go: "Oh. I've been circling the same idea from three different directions and I didn't even see it."

HERE IS EVERYTHING THIS PERSON IS WORKING ON AND THINKING ABOUT:

${richContext}

---

Now. Read all of that carefully. What patterns do you see that this person probably hasn't noticed?

WHAT MAKES A GREAT CROSSOVER vs A FORGETTABLE ONE:

A great crossover is an INSIGHT — it reveals something that was already there but invisible. It's clever but simple. Once you hear it, you can't unhear it.

A bad crossover is a MASHUP — it just staples ideas together. "Your photo app + your book editor = a photo book tool!" That's not clever. That's a feature request. Nobody's mind is blown by concatenation.

THE DIFFERENCE, BY EXAMPLE:

BAD (mashup): "Your baby tracking app and your knowledge graph both handle data, so you could build a baby data dashboard."
— This is just noticing they both involve data. That's a category, not an insight. Anyone could see this.

BAD (artificial): "Combine your photo app, knowledge graph, and book editor into one mega-app."
— This is just putting three things in a bag. There's no underlying connection. It's forced.

GOOD (insight): "You keep solving the same problem without realising it. In your baby app, you're figuring out how to spot meaningful change in a stream of nearly-identical photos. In your knowledge graph, you're figuring out how to spot meaningful connections in a stream of scattered thoughts. Both are the same challenge: signal detection in noisy sequences. And that article you read about bird migration patterns? Same thing — how do individual data points become a visible pattern? You've accidentally become an expert in this one specific problem from three completely different angles."
— This names a specific mechanism. It connects things that LOOK different but ARE the same. It changes how you think about each project. And it's simple to explain.

GOOD (insight): "There's a tension in your work you might not have noticed. Your book editor is all about imposing structure on messy material — taking raw creativity and shaping it. Your voice capture tool does the opposite — it deliberately avoids structure to capture raw thought. You're building tools for both sides of the same creative process. What if the connection between them isn't a feature — it's a workflow? The thing missing from both is the BRIDGE between unstructured capture and structured output."
— This finds a genuine tension. It doesn't combine the projects. It reveals what they share at a deeper level.

YOUR RULES:

1. Find patterns that span 3-5 items when possible. A pattern that shows up in 3 different items is far more interesting than one in 2 — it suggests something fundamental about how this person thinks.${numProjects >= 4 ? ' You have enough ideas here. Go for it.' : ''}

2. Items can be projects, standalone thoughts, OR list items. A collision between a project and a stray thought the person had last month is just as valid as a collision between two projects. If a thought about "how birds navigate" connects with a software project, say so. Don't limit yourself to project-vs-project.

3. Name the MECHANISM. Every good crossover has a specific, nameable thing at its core. Name it in plain words the person would actually use out loud.

4. No mashups. If your crossover is "combine A and B into AB" — delete it and think harder. The crossover should be an insight that changes how the person THINKS about their work, not a product spec.

5. Keep it simple. If the crossover needs three paragraphs to explain, it's not elegant enough. The best ones land in two sentences.

6. Be specific to THIS person. Reference their actual projects, their actual thinking, the actual words they've used. Generic insights ("creativity benefits from cross-pollination") are worthless. This should feel like it could only be said to THIS person about THESE ideas.

7. Every crossover should suggest ONE clear thing to try. Not a business plan. Just: "Next time you're working on X, try approaching it the way you approach Y. See what happens."

8. PLAIN ENGLISH. NO JARGON. Write like you're explaining it to a friend in a pub, not to an academic or a VC. Specifically BANNED words: stochastic, ontological, epistemological, heuristic, emergent, bifurcation, recursion, isomorphism, bisociation, exaptation, orthogonal, teleological, dialectical, paradigm, meta-, -ness, -icity, actualize, paradigmatic, topology. If you find yourself reaching for one of those words, you're being a show-off — rewrite with normal words. A 14-year-old should be able to read your crossover and understand every single word. If a word has more than 4 syllables, double-check whether it's really the best word.

Return a JSON array of UP TO ${targetCount} crossovers (fewer is fine — never force a weak one). KEEP EVERY FIELD TIGHT. No preamble, no markdown, just JSON.

For each crossover:

{
  "node_ids": ["id1", "id2", "id3"],
  "pattern_name": "3-6 words",
  "the_insight": "1-2 sentences max. The aha moment, plain English.",
  "why_its_not_obvious": "1 sentence.",
  "what_it_unlocks": "1 sentence. New way of thinking, not a product.",
  "one_thing_to_try": "1 sentence. Concrete action.",
  "further_steps": ["short step", "short step"],
  "non_obvious_score": 1-10
}

node_ids: use the EXACT bracketed IDs from the list above. You may mix projects, standalone thoughts, and list items — anything with an ID in brackets is fair game. At least ONE of the IDs MUST be a project (the blocks at the top, before the STANDALONE THOUGHTS and LIST ITEMS sections). No crossover with zero projects.

Only return crossovers scoring 7+. Sort by non_obvious_score descending.
Be terse — long fields will get truncated.`

  const raw = await generateText(prompt, {
    model: MODELS.FLASH_CHAT,
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
function parseCandidatesJSON(raw: string): any[] {
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
  listItems: ListItemInput[] = []
): Promise<IntersectionResult[]> {
  const results = embeddingBasedDiscovery(projects, memories, articles, listItems)
  if (results.length === 0) {
    console.warn('[intersection-engine] classicIntersections produced zero clusters', {
      projects: projects.length,
      memoriesWithEmbeddings: memories.filter(m => m.embedding).length,
      listItemsWithEmbeddings: listItems.filter(li => li.embedding).length,
    })
  }

  // AI narration for top 3 — run in parallel so we stay well under Vercel's
  // function timeout. Sequentially this was 6 Gemini calls × ~3s = ~18s,
  // which combined with discoverIntersections was blowing the 15s default.
  const narrationTargets = results.slice(0, 3)
  await Promise.all(narrationTargets.map(async (intersection) => {
    const nodeLabel = intersection.nodes
      .map(n => n.type === 'project' ? `the project "${n.title}"` : n.type === 'memory' ? `a thought: "${n.title}"` : `a list item: "${n.title}"`)
      .join(' + ')
    const fuelContext = intersection.sharedFuel.slice(0, 5).map(f => `${f.type}: "${f.title}"`).join(', ')

    // Both calls for one intersection can also run in parallel.
    const [reasonResult, crossoverResult] = await Promise.allSettled([
      generateText(
        `One person has these things on their mind: ${nodeLabel}.${fuelContext ? ` Things that keep showing up across them: ${fuelContext}.` : ''}

In 2-3 plain-English sentences, say what surprising thing becomes possible when you line these up next to each other. Be specific. Write like a friend who just noticed something clever. No buzzwords, no jargon. BANNED words: stochastic, ontological, emergent, heuristic, isomorphism, paradigm, teleological. If a 14-year-old wouldn't understand a word, don't use it.`,
        { model: MODELS.FLASH_CHAT, temperature: 0.95 }
      ),
      generateText(
        `Someone has these things on their mind: ${nodeLabel}.${fuelContext ? ` Things that keep showing up across them: ${fuelContext}.` : ''}

What's one concrete thing they could try that only makes sense because they have ALL of these on their mind at once? Not a feature. Not a business plan. A small, specific experiment. Write in plain English only. BANNED words: stochastic, ontological, emergent, heuristic, isomorphism, paradigm, teleological. A 14-year-old should understand every word.

Return JSON:
{"crossover_title":"plain 3-6 word title","why_it_works":"2-3 short sentences in plain English","concept":"what you'd actually try, 2-3 sentences","first_steps":["first simple step","second simple step","third simple step"]}`,
        { model: MODELS.FLASH_CHAT, responseFormat: 'json', temperature: 0.95, maxTokens: 1024 }
      )
    ])

    if (reasonResult.status === 'fulfilled') {
      intersection.reason = reasonResult.value
    }
    if (crossoverResult.status === 'fulfilled') {
      try {
        intersection.crossover = JSON.parse(crossoverResult.value)
      } catch {
        // Non-critical — cluster still renders without crossover detail
      }
    }
  }))

  return results
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
function embeddingBasedDiscovery(
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
    if (picked.length >= 5) break
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
