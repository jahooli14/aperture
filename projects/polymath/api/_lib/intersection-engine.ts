/**
 * Intersection Engine — AI-Primary Structural Discovery
 *
 * Fundamental shift from the old approach:
 *   OLD: Embeddings find topically similar things → AI narrates why they're similar
 *   NEW: AI discovers structural connections between dissimilar things → Embeddings find supporting fuel
 *
 * Based on:
 * - The Medici Effect (Johansson): breakthroughs at intersections of fields, not within them
 * - Packy McCormick (Not Boring): non-obvious structural connections create complexity moats
 * - Koestler's Bisociation: connecting previously unrelated matrices of thought
 * - Steven Johnson's Exaptation: ideas designed for one purpose solving problems in another
 *
 * Key design principles:
 * 1. Find STRUCTURAL patterns (mechanisms, constraints, principles) — not topic overlap
 * 2. Prioritise 3-5 idea combinations over simple pairs
 * 3. Apply the "only at this intersection" test for non-obviousness
 * 4. Every intersection must suggest something concrete and actionable
 * 5. Write like an excited friend who just connected the dots, not a consultant
 *
 * See docs/INTERSECTIONS.md for the full intellectual framework.
 */

import { generateText } from './gemini-chat.js'
import { cosineSimilarity } from './gemini-embeddings.js'
import { MODELS } from './models.js'

// --- Types matching the frontend contract (WeeklyIntersection.tsx) ---

export interface IntersectionResult {
  id: string
  projectIds: string[]
  projects: Array<{ id: string; title: string }>
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
  project_ids: string[]
  crossover_title: string
  why_this_is_wild: string
  the_mechanism: string
  what_you_could_build: string
  first_move: string
  next_steps: string[]
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

// A fuel item must be this similar to a project to count as a bridge
const FUEL_BRIDGE_THRESHOLD = 0.52

/**
 * Main entry point. Discovers intersections using AI-primary structural analysis,
 * with embedding-based fuel finding as supporting evidence.
 */
export async function discoverIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): Promise<IntersectionResult[]> {
  if (projects.length < 2) return []

  // --- Phase 1: AI discovers structural intersections ---
  let candidates: RawCandidate[]
  try {
    candidates = await aiDiscoverIntersections(projects, memories, articles)
  } catch (err) {
    console.error('[intersection-engine] AI discovery failed, falling back to embedding-based:', err)
    return fallbackEmbeddingIntersections(projects, memories, articles)
  }

  if (candidates.length === 0) {
    return fallbackEmbeddingIntersections(projects, memories, articles)
  }

  // --- Phase 2: Find supporting fuel via embeddings ---
  // Embeddings add concrete evidence (specific memories/articles that bridge the intersection)
  // to the AI's structural insights.
  const results: IntersectionResult[] = []

  for (const candidate of candidates) {
    const matched = candidate.project_ids
      .map(id => projects.find(p => p.id === id))
      .filter((p): p is ProjectInput => !!p)

    if (matched.length < 2) continue

    const fuel = findSupportingFuel(matched, memories, articles)
    const projectIds = matched.map(p => p.id)

    results.push({
      id: [...projectIds].sort().join(','),
      projectIds,
      projects: matched.map(p => ({ id: p.id, title: p.title })),
      score: (candidate.non_obvious_score || 7) * (matched.length * 0.8),
      sharedFuel: fuel.slice(0, 8),
      reason: candidate.why_this_is_wild,
      crossover: {
        crossover_title: candidate.crossover_title,
        why_it_works: candidate.the_mechanism,
        concept: candidate.what_you_could_build,
        first_steps: [
          candidate.first_move,
          ...(candidate.next_steps || [])
        ].filter(Boolean).slice(0, 3)
      }
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 5)
}

/**
 * AI-primary intersection discovery.
 *
 * Sends all projects + fuel context to a strong model and asks it to find
 * structural connections. Prioritises 3-5 idea intersections over simple pairs.
 *
 * The prompt encodes the principles from Medici Effect, Packy McCormick, Koestler,
 * and Steven Johnson — structural isomorphism, constraint inversion, exaptation,
 * hidden feedback loops, and the "only at this intersection" test.
 */
async function aiDiscoverIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): Promise<RawCandidate[]> {

  // Build project context (cap at 15 to keep prompt reasonable)
  const projectContext = projects.slice(0, 15).map(p =>
    `[${p.id}] "${p.title}"${p.description ? ` — ${p.description.slice(0, 600)}` : ''}`
  ).join('\n\n')

  // Build fuel context (recent thoughts + articles as potential bridges)
  const fuelItems: string[] = []
  for (const m of memories.slice(0, 25)) {
    const label = m.title || m.body?.substring(0, 80) || 'Thought'
    const themes = m.themes?.length ? ` (themes: ${m.themes.slice(0, 4).join(', ')})` : ''
    fuelItems.push(`- [thought] "${label}"${themes}${m.body ? `: ${m.body.slice(0, 150)}` : ''}`)
  }
  for (const a of articles.slice(0, 15)) {
    fuelItems.push(`- [article] "${a.title || 'Article'}"${a.summary ? `: ${a.summary.slice(0, 150)}` : ''}`)
  }

  const numProjects = projects.length
  const targetCount = Math.min(5, Math.max(2, Math.floor(numProjects * 0.8)))

  const prompt = buildDiscoveryPrompt(projectContext, fuelItems, numProjects, targetCount)

  const raw = await generateText(prompt, {
    model: MODELS.FLASH_CHAT,
    responseFormat: 'json',
    temperature: 1.0,  // High creativity — we want non-obvious connections
    maxTokens: 4096,
  })

  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []

  // Validate candidates have required fields
  return parsed.filter((c: any) =>
    Array.isArray(c.project_ids) &&
    c.project_ids.length >= 2 &&
    typeof c.why_this_is_wild === 'string' &&
    typeof c.crossover_title === 'string'
  ) as RawCandidate[]
}

/**
 * Build the discovery prompt. This is the heart of the engine.
 *
 * The prompt is designed to produce intersections that are:
 * - Structural (mechanism-level, not topic-level)
 * - Multi-way (3-5 ideas, not just pairs)
 * - Non-obvious (fails the "would one domain see this?" test)
 * - Actionable (suggests something concrete to build/try)
 * - Plain English (excited friend, not consultant)
 */
function buildDiscoveryPrompt(
  projectContext: string,
  fuelItems: string[],
  numProjects: number,
  targetCount: number
): string {
  return `You are a structural pattern recognition engine. Your job is finding where ideas COLLIDE in non-obvious ways — not where they overlap on the surface, but where their underlying mechanisms, constraints, or principles create something genuinely new when combined.

Think like this: if someone is working on a baby photo app AND a knowledge graph AND a book editor, don't say "they all involve content." Instead, find the structural collision: what mechanism in one could transform another? What constraint in one is secretly solved by another? What hidden pattern do 3+ of them share that nobody working on just one would ever notice?

HERE ARE THE IDEAS THIS PERSON IS ACTIVELY WORKING ON:

${projectContext}

${fuelItems.length > 0 ? `RECENT THOUGHTS AND READING (potential bridges between domains):

${fuelItems.join('\n')}

These thoughts and articles might reveal connections the person is already making subconsciously. Look for patterns across them.
` : ''}
FIND ${targetCount} GENUINELY SURPRISING INTERSECTIONS.

RULES — these determine whether the output is incredible or forgettable:

1. AIM FOR 3-5 IDEA INTERSECTIONS. Two-idea pairs are a last resort. The real magic happens when 3+ ideas share a hidden structural pattern that nobody working on just one of them would ever see. A 3-way intersection isn't just "more ideas" — it's a triangulation that reveals a pattern none of the pairs could.${numProjects >= 4 ? ' You have enough ideas here for rich multi-way intersections. Use them.' : ''}

2. Find STRUCTURAL connections, not topic overlap:
   - REJECT: "Both involve technology" / "Both are creative projects" / "Both use AI" — these are categories, not intersections
   - REJECT: "These could be combined into one project" — merging isn't intersecting
   - REJECT: Surface-level shared attributes ("both involve users", "both deal with data")
   - ACCEPT: "The mechanism that makes A work is the exact same pattern that's missing from B — and C has already solved this from a completely different angle"
   - ACCEPT: "A's biggest constraint is B's biggest strength. What if you built something that exploits this tension, using the approach from C?"
   - ACCEPT: "There's a hidden feedback loop connecting A, B, and C that changes how you'd approach all three"

3. THE "ONLY AT THIS INTERSECTION" TEST: If someone working on just ONE of these ideas would think of this connection, it's too obvious. Skip it. The insight must REQUIRE seeing multiple ideas together. That's what makes it genuinely valuable and unreplicable.

4. EVERY intersection must suggest something CONCRETE. Not "explore the synergies" — what would you actually build, create, or try? Something specific enough to start this week.

5. WRITE LIKE AN EXCITED FRIEND who just connected dots nobody else could see. No jargon, no buzzwords, no consultant-speak. No "leveraging" or "synergies" or "holistic approach." Plain English. The excitement comes from the insight itself, not fancy vocabulary. Think: "Wait — you know how [specific thing from idea A]? That's EXACTLY the same pattern as [thing from idea B], and if you add [thing from idea C], you could actually [concrete action]."

6. SURPRISING THEN OBVIOUS: The best intersections feel surprising at first but obvious once explained. "I never would have thought of that, but now that you say it — of course." That's the sweet spot.

TYPES OF STRUCTURAL CONNECTIONS TO HUNT FOR:
- Same mechanism, different domain: the pattern driving A is the same one that makes B work, but nobody in either field has named it
- Constraint inversion: A's limitation is B's superpower — design something at the tension point
- Exaptation: A was designed for purpose X, but its mechanism would solve Y's biggest unsolved problem
- Hidden isomorphism: A, B, and C are all describing the same deep pattern from different angles — someone who sees all three has a unique vantage point
- Emergent architecture: A+B+C together create a system that no pair or individual could. Adding the third idea transforms what the first two mean

Return a JSON array. For each intersection:
{
  "project_ids": ["id1", "id2", "id3"],
  "crossover_title": "plain 3-8 word title",
  "why_this_is_wild": "2-3 sentences, plain English. The aha moment. What structural pattern connects these? Write like you're excitedly telling a friend who knows all these projects.",
  "the_mechanism": "1 sentence: the specific structural connection (e.g. 'The feedback loop that drives X is the same loop that's missing from Y')",
  "what_you_could_build": "2-3 sentences: what you'd actually create. Concrete and specific, not abstract.",
  "first_move": "One specific thing to do this week to start exploring this",
  "next_steps": ["second practical step", "third practical step"],
  "non_obvious_score": 1-10
}

ONLY return intersections scoring 6 or higher on non_obvious_score. If you can't find ${targetCount} that meet this bar, return fewer — quality over quantity. Sort by non_obvious_score descending.

IMPORTANT: Use the EXACT project IDs from the list above in project_ids. Do not invent IDs.`
}

/**
 * Find memories and articles that semantically bridge the intersection's projects.
 * A fuel item is a "bridge" if it's similar enough to at least 2 of the projects —
 * meaning it lives in multiple domains simultaneously.
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

  // Most relevant bridges first
  fuel.sort((a, b) => b.avgSim - a.avgSim)
  return fuel.map(({ avgSim, ...rest }) => rest)
}

/**
 * Fallback: embedding-based intersections (simplified original algorithm).
 * Used when AI discovery fails or returns no results.
 */
function fallbackEmbeddingIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): IntersectionResult[] {
  const pairs: Array<{
    projects: ProjectInput[]
    similarity: number
    sharedFuel: Array<{ type: string; title: string; id: string }>
  }> = []

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i]
      const b = projects[j]
      if (!a.embedding || !b.embedding) continue

      const sim = cosineSimilarity(a.embedding, b.embedding)
      const sharedFuel: Array<{ type: string; title: string; id: string }> = []

      for (const mem of memories) {
        if (!mem.embedding) continue
        const simA = cosineSimilarity(mem.embedding, a.embedding)
        const simB = cosineSimilarity(mem.embedding, b.embedding)
        if (simA > 0.6 && simB > 0.6) {
          sharedFuel.push({ type: 'memory', title: mem.title || mem.body?.substring(0, 60) || 'Thought', id: mem.id })
        }
      }
      for (const art of articles) {
        if (!art.embedding) continue
        const simA = cosineSimilarity(art.embedding, a.embedding)
        const simB = cosineSimilarity(art.embedding, b.embedding)
        if (simA > 0.6 && simB > 0.6) {
          sharedFuel.push({ type: 'article', title: art.title || 'Article', id: art.id })
        }
      }

      // Sweet spot: similar enough to connect, different enough to be interesting
      if (sim >= 0.4 && sim <= 0.72) {
        pairs.push({ projects: [a, b], similarity: sim, sharedFuel })
      }
    }
  }

  pairs.sort((a, b) =>
    (b.similarity + b.sharedFuel.length * 0.1) - (a.similarity + a.sharedFuel.length * 0.1)
  )

  return pairs.slice(0, 5).map(pair => ({
    id: pair.projects.map(p => p.id).sort().join(','),
    projectIds: pair.projects.map(p => p.id),
    projects: pair.projects.map(p => ({ id: p.id, title: p.title })),
    score: 2 * pair.similarity + pair.sharedFuel.length * 0.3,
    sharedFuel: pair.sharedFuel,
  }))
}
