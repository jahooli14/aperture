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

const FUEL_BRIDGE_THRESHOLD = 0.52

/**
 * Main entry point.
 * Builds rich per-project context from associated memories, then asks the AI
 * to spot latent patterns across the user's thinking.
 */
export async function discoverIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): Promise<IntersectionResult[]> {
  if (projects.length < 2) return []

  // --- Phase 1: Build rich context ---
  // For each project, find the user's actual thinking about it (voice notes,
  // articles they've connected to it). This gives the AI substance to work
  // with — not just "Baby photo app" but the WHY and HOW behind it.
  const richContext = buildRichProjectContext(projects, memories, articles)

  // --- Phase 2: AI spots latent patterns ---
  let candidates: RawCandidate[]
  try {
    candidates = await discoverPatterns(projects, richContext)
  } catch (err) {
    console.error('[intersection-engine] AI discovery failed, falling back to embedding-based:', err)
    return embeddingBasedDiscovery(projects, memories, articles)
  }

  if (candidates.length === 0) {
    return embeddingBasedDiscovery(projects, memories, articles)
  }

  // --- Phase 3: Find supporting fuel via embeddings ---
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

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 5)
}

/**
 * Build rich context for each project by finding the most relevant memories
 * and articles. This gives the AI the user's actual THINKING — their voice
 * notes, the things they've read, the problems they're mulling over — not
 * just a title and a blurb.
 */
function buildRichProjectContext(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): string {
  const memoriesWithEmbeddings = memories.filter(m => m.embedding)
  const articlesWithEmbeddings = articles.filter(a => a.embedding)

  return projects.slice(0, 12).map(p => {
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
  const targetCount = Math.min(5, Math.max(2, Math.floor(numProjects * 0.7)))

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

1. Find patterns that span 3-5 projects when possible. A pattern that shows up in 3 different domains is far more interesting than one in 2 — it suggests something fundamental about how this person thinks.${numProjects >= 4 ? ' You have enough ideas here. Go for it.' : ''}

2. Name the MECHANISM. Every good crossover has a specific, nameable thing at its core. "Signal detection in noisy sequences." "The tension between structure and freedom." "Feedback loops that compound." If you can't name the mechanism in one phrase, the crossover isn't real.

3. No mashups. If your crossover is "combine A and B into AB" — delete it and think harder. The crossover should be an insight that changes how the person THINKS about their projects, not a product spec.

4. Keep it simple. If the crossover needs three paragraphs to explain, it's not elegant enough. The best ones land in two sentences.

5. Be specific to THIS person. Reference their actual projects, their actual thinking, the actual words they've used. Generic insights ("creativity benefits from cross-pollination") are worthless. This should feel like it could only be said to THIS person about THESE ideas.

6. Every crossover should suggest ONE clear thing to try. Not a business plan. Just: "Next time you're working on X, try approaching it the way you approach Y. See what happens."

Return a JSON array of ${targetCount} crossovers (or fewer — never force a weak one). For each:

{
  "project_ids": ["id1", "id2", "id3"],
  "pattern_name": "3-6 words naming the underlying pattern (not a product name)",
  "the_insight": "1-2 sentences. The aha moment. Plain English, conversational. This is what the person reads first — it should hook them.",
  "why_its_not_obvious": "1 sentence. Why someone working on just ONE of these projects would never see this pattern.",
  "what_it_unlocks": "1-2 sentences. What becomes possible or changes once you see this pattern. Not a product — a new way of thinking or approaching the work.",
  "one_thing_to_try": "One specific, concrete action for this week. Not vague.",
  "further_steps": ["one more step", "another step"],
  "non_obvious_score": 1-10
}

Only return crossovers scoring 7+. Sort by non_obvious_score descending.
Use the EXACT project IDs from the list above.`

  const raw = await generateText(prompt, {
    model: MODELS.FLASH_CHAT,
    responseFormat: 'json',
    temperature: 1.0,
    maxTokens: 4096,
  })

  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []

  return parsed.filter((c: any) =>
    Array.isArray(c.project_ids) &&
    c.project_ids.length >= 2 &&
    typeof c.the_insight === 'string' &&
    typeof c.pattern_name === 'string'
  ) as RawCandidate[]
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
 * Classic approach: embedding-based discovery + AI enrichment.
 * The original intersection algorithm — find topically similar projects via
 * cosine similarity, identify shared fuel, then ask AI to narrate the top results.
 * Exported for A/B comparison with the new insight-driven approach.
 */
export async function classicIntersections(
  projects: ProjectInput[],
  memories: MemoryInput[],
  articles: ArticleInput[]
): Promise<IntersectionResult[]> {
  const results = embeddingBasedDiscovery(projects, memories, articles)

  // AI enrichment for top 3 — same prompts as the original implementation
  for (let i = 0; i < Math.min(results.length, 3); i++) {
    const intersection = results[i]
    const projectNames = intersection.projects.map(p => p.title).join(' × ')
    const fuelContext = intersection.sharedFuel.map(f => `${f.type}: "${f.title}"`).join(', ')

    try {
      intersection.reason = await generateText(
        `These are projects one person is working on: ${projectNames}.${fuelContext ? ` Things that have come up in both: ${fuelContext}.` : ''}

In 2-3 plain sentences, explain what genuinely surprising idea becomes possible when you combine these. Don't just say they overlap or use buzzwords. Be specific — what could someone build or do that they couldn't if they only worked on one of these? Write like a smart friend explaining it over coffee, not a pitch deck.`,
        { model: MODELS.FLASH_CHAT, temperature: 0.95 }
      )

      const crossoverRaw = await generateText(
        `Someone is working on these projects: ${projectNames}.${fuelContext ? ` Both have come up in relation to: ${fuelContext}.` : ''}

What's a concrete project idea that could only exist because this person works on BOTH of these? Don't suggest something that fits neatly into just one of the projects. Be specific and practical. Write in plain English, no startup speak.

Return JSON:
{"crossover_title":"plain 3-6 word title","why_it_works":"2-3 sentences in plain English","concept":"what you'd actually build, 2-3 sentences","first_steps":["first practical step","second practical step","third practical step"]}`,
        { model: MODELS.FLASH_CHAT, responseFormat: 'json', temperature: 0.95 }
      )
      intersection.crossover = JSON.parse(crossoverRaw)
    } catch {
      // Non-critical
    }
  }

  return results
}

/**
 * Embedding-based intersections (no AI enrichment).
 * Used as fallback when AI discovery fails, and as the base for classicIntersections.
 */
function embeddingBasedDiscovery(
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
