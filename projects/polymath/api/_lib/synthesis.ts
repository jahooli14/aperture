/**
 * Deep Synthesis Engine
 * Mines the full data lake for real patterns, then generates grounded project ideas
 * from observations — not from a list of nouns.
 */

declare var process: any;

import { getSupabaseClient } from './supabase.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { COST_OPTS } from './optimization-config.js'
import { batchGenerateEmbeddings, cosineSimilarity } from './gemini-embeddings.js'
import { MODELS } from './models.js'
import { auditCandidate } from './intersection-critic.js'

const logger = {
  info: (objOrMsg: any, msg?: string) => console.log(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
  warn: (objOrMsg: any, msg?: string) => console.warn(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
  error: (objOrMsg: any, msg?: string) => console.error(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
  debug: (objOrMsg: any, msg?: string) => console.debug(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
}

const supabase = getSupabaseClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const CONFIG = {
  SUGGESTIONS_PER_RUN: COST_OPTS.SYNTHESIS_SUGGESTIONS_PER_RUN,
  MEMORY_CLUSTER_THRESHOLD: 0.78,
  CROSS_SOURCE_MIN_MEMORIES: 2,
}

// ─── Data types ──────────────────────────────────────────────────────────────

interface RichMemory {
  id: string
  title: string
  body: string
  themes: string[]
  tags: string[]
  emotional_tone: string
  triage: any
  embedding: number[] | null
}

interface RichArticle {
  id: string
  title: string
  excerpt: string
  themes: string[]
  entities: any
  embedding: number[] | null
}

interface RichProject {
  id: string
  title: string
  description: string
  status: string
  metadata: any
  embedding: number[] | null
}

interface Capability {
  id: string
  name: string
  description: string
  strength: number
  source_project: string
}

interface RichListItem {
  id: string
  content: string
  list_type: string
  list_title: string
  embedding: number[] | null
}

interface Observation {
  type: 'cross_source_echo' | 'capability_gap' | 'memory_cluster' | 'new_project_idea' | 'cross_surface_cluster'
  description: string
  sourceRefs: string[]
}

interface ProjectIdea {
  title: string
  description: string
  /** @deprecated — kept for DB back-compat. New code reads crossover.the_pattern. */
  reasoning: string
  crossover: {
    crossover_title: string
    hook: string
    the_pattern: string
    the_experiment: string
    first_steps: string[]
  }
  observationBasis: string
  sourceSnippets: string[]
  capabilityIds: string[]
  memoryIds: string[]
  noveltyScore: number
  feasibilityScore: number
  interestScore: number
  totalPoints: number
  isWildcard: boolean
}

// ─── Data loaders ─────────────────────────────────────────────────────────────

async function loadRichMemories(userId: string): Promise<RichMemory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('id, title, body, themes, tags, emotional_tone, triage, embedding')
    .eq('user_id', userId)
    .eq('processed', true)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ error }, 'Failed to load memories')
    return []
  }
  return (data || []).map(m => ({
    id: m.id,
    title: m.title || '',
    body: m.body || '',
    themes: m.themes || [],
    tags: m.tags || [],
    emotional_tone: m.emotional_tone || '',
    triage: m.triage || null,
    embedding: m.embedding || null,
  }))
}

async function loadRichArticles(userId: string): Promise<RichArticle[]> {
  const { data, error } = await supabase
    .from('reading_queue')
    .select('id, title, excerpt, themes, entities, embedding')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ error }, 'Failed to load articles')
    return []
  }
  return (data || []).map(a => ({
    id: a.id,
    title: a.title || '',
    excerpt: a.excerpt || '',
    themes: a.themes || [],
    entities: a.entities || {},
    embedding: a.embedding || null,
  }))
}

async function loadRichProjects(userId: string): Promise<RichProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, description, status, metadata, embedding')
    .eq('user_id', userId)
    .in('status', ['active', 'on-hold', 'maintaining', 'completed', 'upcoming'])

  if (error) {
    logger.error({ error }, 'Failed to load projects')
    return []
  }
  return (data || []).map(p => ({
    id: p.id,
    title: p.title || '',
    description: p.description || '',
    status: p.status || '',
    metadata: p.metadata || {},
    embedding: p.embedding || null,
  }))
}

async function loadRichListItems(userId: string): Promise<RichListItem[]> {
  // Load enriched list items with embeddings — these represent what the user is consuming
  const { data: lists, error: listsError } = await supabase
    .from('lists')
    .select('id, title, type')
    .eq('user_id', userId)

  if (listsError || !lists?.length) return []

  const listMap = new Map(lists.map((l: any) => [l.id, { title: l.title, type: l.type }]))

  const { data: items, error: itemsError } = await supabase
    .from('list_items')
    .select('id, content, list_id, metadata, embedding')
    .eq('user_id', userId)
    .eq('enrichment_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(30)

  if (itemsError) {
    logger.error({ error: itemsError }, 'Failed to load list items')
    return []
  }

  return (items || []).map((item: any) => {
    const list = listMap.get(item.list_id) || { title: 'Unknown', type: 'generic' }
    return {
      id: item.id,
      content: item.content || '',
      list_type: list.type,
      list_title: list.title,
      embedding: item.embedding || null,
    }
  })
}

async function loadCapabilities(_userId: string): Promise<Capability[]> {
  const { data, error } = await supabase
    .from('capabilities')
    .select('id, name, description, strength, source_project')
    .order('strength', { ascending: false })

  if (error) throw error
  return data || []
}

// ─── Pattern mining ───────────────────────────────────────────────────────────

function minePatterns(
  memories: RichMemory[],
  articles: RichArticle[],
  projects: RichProject[],
  capabilities: Capability[],
  listItems: RichListItem[] = []
): Observation[] {
  const observations: Observation[] = []

  // Pattern A: Cross-source echo
  // Topics that appear in ≥2 memories AND ≥1 article
  const memoryTopicMap = new Map<string, string[]>() // topic → memory titles
  for (const memory of memories) {
    const topics = [...(memory.themes || []), ...(memory.tags || [])]
    for (const topic of topics) {
      const key = topic.toLowerCase().trim()
      if (!memoryTopicMap.has(key)) memoryTopicMap.set(key, [])
      memoryTopicMap.get(key)!.push(memory.title)
    }
  }

  const articleTopicMap = new Map<string, string[]>() // topic → article titles
  for (const article of articles) {
    const topics = [
      ...(article.themes || []),
      ...(article.entities?.topics || []),
    ]
    // Also scan title words for common topic detection
    for (const topic of topics) {
      const key = topic.toLowerCase().trim()
      if (!articleTopicMap.has(key)) articleTopicMap.set(key, [])
      articleTopicMap.get(key)!.push(article.title)
    }
  }

  for (const [topic, memTitles] of memoryTopicMap.entries()) {
    if (memTitles.length < CONFIG.CROSS_SOURCE_MIN_MEMORIES) continue
    const artTitles = articleTopicMap.get(topic) || []
    if (artTitles.length === 0) continue

    const uniqueMemTitles = [...new Set(memTitles)].slice(0, 3)
    const uniqueArtTitles = [...new Set(artTitles)].slice(0, 2)
    const displayTopic = topic.charAt(0).toUpperCase() + topic.slice(1)

    observations.push({
      type: 'cross_source_echo',
      description: `You've come back to "${displayTopic}" in ${memTitles.length} separate notes (e.g. "${uniqueMemTitles.join('", "')}") and also saved ${artTitles.length} article${artTitles.length > 1 ? 's' : ''} about it (e.g. "${uniqueArtTitles.join('", "')}"). You're thinking about this both from the inside (your own notes) and the outside (what others have written).`,
      sourceRefs: [...uniqueMemTitles, ...uniqueArtTitles],
    })
  }

  // Pattern B: Capability gap
  // Skill they have but haven't applied to a domain they keep writing/reading about
  const projectDomains = new Set<string>()
  for (const project of projects) {
    const _caps: string[] = project.metadata?.capabilities || []
    const desc = (project.description || '').toLowerCase()
    const title = (project.title || '').toLowerCase()
    // Extract rough domains from project descriptions
    const words = [...desc.split(/\s+/), ...title.split(/\s+/)]
      .filter(w => w.length > 4)
    words.forEach(w => projectDomains.add(w))
  }

  // For each capability, find memory themes not covered by any project
  for (const cap of capabilities.slice(0, 8)) {
    const capName = cap.name.toLowerCase()
    // Find memory themes that mention this capability's domain but aren't in any project
    const relatedMemoryThemes: string[] = []
    const relatedMemoryTitles: string[] = []

    for (const memory of memories) {
      const topics = [...(memory.themes || []), ...(memory.tags || [])]
      for (const topic of topics) {
        const topicLower = topic.toLowerCase()
        // If topic appears in memories but NOT in cap's project context and NOT already in projects
        if (!projectDomains.has(topicLower) && topicLower !== capName) {
          if (!relatedMemoryThemes.includes(topicLower)) {
            relatedMemoryThemes.push(topicLower)
            relatedMemoryTitles.push(memory.title)
          }
        }
      }
    }

    if (relatedMemoryThemes.length >= 3) {
      const topDomains = relatedMemoryThemes.slice(0, 3)
      const exampleTitles = relatedMemoryTitles.slice(0, 2)
      observations.push({
        type: 'capability_gap',
        description: `You have strong "${cap.name}" skills (from ${cap.source_project || 'your work'}) but you've never built anything in the territory of "${topDomains.join('", "')}", even though you've written about it — see "${exampleTitles.join('", "')}". That gap looks intentional to exploit.`,
        sourceRefs: [cap.name, ...exampleTitles],
      })
    }
  }

  // Pattern C: Memory cluster (semantically similar notes using stored embeddings)
  const memoriesWithEmbeddings = memories.filter(m => m.embedding && m.embedding.length > 0)

  if (memoriesWithEmbeddings.length >= 3) {
    // Find clusters: pairs with cosine similarity > threshold
    const clusters: Map<number, number[]> = new Map()
    const visited = new Set<number>()

    for (let i = 0; i < memoriesWithEmbeddings.length; i++) {
      if (visited.has(i)) continue
      const cluster = [i]
      for (let j = i + 1; j < memoriesWithEmbeddings.length; j++) {
        if (visited.has(j)) continue
        const sim = cosineSimilarity(
          memoriesWithEmbeddings[i].embedding!,
          memoriesWithEmbeddings[j].embedding!
        )
        if (sim >= CONFIG.MEMORY_CLUSTER_THRESHOLD) {
          cluster.push(j)
          visited.add(j)
        }
      }
      if (cluster.length >= 3) {
        clusters.set(i, cluster)
        visited.add(i)
      }
    }

    for (const [, indices] of clusters) {
      const clusterMemories = indices.slice(0, 4).map(i => memoriesWithEmbeddings[i])
      const titles = clusterMemories.map(m => m.title)
      const themes = [...new Set(clusterMemories.flatMap(m => m.themes || []))].slice(0, 3)

      observations.push({
        type: 'memory_cluster',
        description: `${clusterMemories.length} of your notes land on almost exactly the same place, even though they were written at different times: "${titles.join('", "')}". You keep circling this — ${themes.length > 0 ? `something around "${themes.join('", "')}"` : 'the same unresolved question'} — without having built anything around it yet.`,
        sourceRefs: titles,
      })
    }
  }

  // Pattern D: Explicitly triaged new_project_idea memories
  const unbuiltIdeas = memories.filter(m =>
    m.triage?.category === 'new_project_idea'
  )

  for (const idea of unbuiltIdeas.slice(0, 3)) {
    const bridge = idea.triage?.bridge_insight
    observations.push({
      type: 'new_project_idea',
      description: `You flagged "${idea.title}" as a potential project idea${bridge ? ` — and your own note says: "${bridge}"` : ''}. It's still sitting there unbuilt.`,
      sourceRefs: [idea.title],
    })
  }

  // Pattern E: Cross-surface cluster.
  // A memory that sits semantically close to BOTH a list item AND a project
  // is a three-surface collision — the same idea surfacing in their thoughts,
  // their consumption, and their active work. That's the strongest possible
  // signal for synthesis and the exact thing a SPARK should build on.
  const CROSS_SURFACE_SIM = 0.55
  const memoriesWithEmb = memories.filter(m => m.embedding && m.embedding.length > 0)
  const listItemsWithEmb = listItems.filter(li => li.embedding && li.embedding.length > 0)
  const projectsWithEmb = projects.filter(p => p.embedding && p.embedding.length > 0)

  const emittedSurfaceClusters = new Set<string>()
  for (const mem of memoriesWithEmb) {
    const relatedListItems = listItemsWithEmb
      .map(li => ({ li, sim: cosineSimilarity(mem.embedding!, li.embedding!) }))
      .filter(x => x.sim >= CROSS_SURFACE_SIM)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 2)
    const relatedProjects = projectsWithEmb
      .map(p => ({ p, sim: cosineSimilarity(mem.embedding!, p.embedding!) }))
      .filter(x => x.sim >= CROSS_SURFACE_SIM)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 2)

    // Only interesting when ALL THREE surfaces light up — thought, consumed,
    // active work. Two surfaces alone are already covered by Patterns A-D.
    if (relatedListItems.length === 0 || relatedProjects.length === 0) continue

    const liTitles = relatedListItems.map(({ li }) => li.content.slice(0, 80))
    const projTitles = relatedProjects.map(({ p }) => p.title)
    const key = [mem.id, ...relatedListItems.map(x => x.li.id), ...relatedProjects.map(x => x.p.id)].sort().join('|')
    if (emittedSurfaceClusters.has(key)) continue
    emittedSurfaceClusters.add(key)

    observations.push({
      type: 'cross_surface_cluster',
      description: `Your note "${mem.title}" sits right next to a list item you're consuming ("${liTitles.join('", "')}") AND your active project${relatedProjects.length > 1 ? 's' : ''} "${projTitles.join('", "')}". Same idea, three surfaces — thought, input, work.`,
      sourceRefs: [mem.title, ...liTitles, ...projTitles],
    })

    // Cap to keep the prompt bounded — pattern miner shouldn't dominate.
    if (observations.filter(o => o.type === 'cross_surface_cluster').length >= 4) break
  }

  logger.info({ count: observations.length }, 'Pattern mining complete')
  return observations
}

// ─── Observation-first generation ────────────────────────────────────────────

async function generateFromObservations(
  observations: Observation[],
  capabilities: Capability[],
  projects: RichProject[],
  count: number,
  previousTitles: string[],
  pairWeightsSection: string = '',
  modeSection: string = '',
  listItems: RichListItem[] = []
): Promise<any[]> {
  const capabilityList = capabilities.slice(0, 15)
    .map(c => `- [${c.id}] ${c.name}: ${c.description}`)
    .join('\n')

  const activeProjectsList = projects
    .filter(p => p.status === 'active' || p.status === 'on-hold')
    .map(p => `- ${p.title}: ${p.description || 'no description'}`)
    .join('\n') || 'None'

  const observationsBlock = observations.length > 0
    ? observations.map((obs, i) => `[OBSERVATION ${i + 1} — ${obs.type}]\n${obs.description}`).join('\n\n')
    : 'No strong patterns detected yet — generate ideas from the capabilities and any themes you can infer.'

  const avoidSection = previousTitles.length > 0
    ? `\nALREADY SUGGESTED (do not repeat or closely resemble):\n${previousTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const consumingSection = listItems.length > 0
    ? `\n═══ WHAT THEY'RE CONSUMING ═══\n${listItems.slice(0, 15).map(li => `- ${li.content} (${li.list_type}: ${li.list_title})`).join('\n')}\n\nThese are books, films, music, etc. they're actively engaged with. Use these as creative fuel — if they're watching a lot of sci-fi, or reading about design, that's signal for what kind of project might excite them.\n`
    : ''

  const prompt = `You are a perceptive friend who has read all of someone's notes, saved articles, lists, and projects. Your job is to catch THEM doing something they haven't noticed, then turn that observation into ONE concrete thing they can actually try.

This output ships next to cards from another engine, rendered identically. The shape is:
  - crossover_title  (3-6 words, concrete, names the mechanism — not cute, not poetic)
  - hook             (one sentence starting with "You" + present-tense verb — what they are ALREADY doing)
  - the_pattern      (1-2 sentences naming a hidden thread, referencing ≥2 specific items by title/content)
  - the_experiment   (1-2 sentences, ONE concrete action, starts with an imperative verb, names a specific project/note/list item they already have)
  - first_steps      (3 imperative-verb actions, 8-14 words each, each naming a specific item from the input)

RULES (enforced server-side — violations get dropped):

1. OBSERVATION, not product. If the card only makes sense as "combine A with B to make AB", it's a mashup — drop it. A real observation would still land with one of the sources removed.

2. REQUIRED HOOK OPENING: Start with "You" + a present-tense verb. Good: "You keep…", "You already…", "You treat…", "You notice…", "You've been…". BANNED: "Your" (possessive), "You're", "You could/should/would", "I'm looking at", "It feels like", "Imagine", "Picture", "Here's".

3. BANNED PHRASES anywhere: "massive flex", "deeply fascinated", "at the intersection of", "directly combines your X with your Y", "fuses your", "mashes together", "truly beautiful", "quietly brilliant", "leverage", "synergize", "unlock potential", "game-changer", "actionable", "paradigm", "stochastic", "orthogonal", "emergent", "heuristic", "ontological", "epistemological", "isomorphism".

4. NAME SPECIFIC ITEMS. Every reference to a memory/note/project/list item must use its actual title or a direct quote — never "your notes", "your projects", "your list", "one of your X". If you can't name a specific item, you don't have enough signal — drop the card.

5. NO SHORTHAND in first_steps. Each step must reference a specific named item. BAD: "Pick one specific item from your X list" (REJECTED server-side). GOOD: "Reread the brass-doorknob entry in your replaced-objects draft and underline the first sensory detail."

6. EACH FIELD DOES A DIFFERENT JOB. Do not restate:
   - hook: the aha, NOT a restatement of the_pattern
   - the_pattern: names the hidden thread with ≥2 specific items
   - the_experiment: ONE action, imperative verb, specific project, NOT a restatement of the_pattern
   - first_steps: 3 different concrete actions, each naming something specific

7. PLAIN ENGLISH. A 14-year-old should understand every word. If a word has 4+ syllables, double-check.

═══ WHAT I NOTICED IN THEIR NOTES ═══

${observationsBlock}

═══ THEIR TECHNICAL CAPABILITIES ═══
${capabilityList}
${pairWeightsSection}
═══ ACTIVE PROJECTS (don't re-suggest; use as collision material) ═══
${activeProjectsList}
${consumingSection}${avoidSection}${modeSection}
═══ YOUR TASK ═══

Generate up to ${count} crossovers. FEWER IS FINE — never force a weak one. If nothing scores, return [].

For each crossover, the observation must open with what the PERSON is doing across their notes/projects/list items. Ground every field in at least one named specific item. Mix freely across memories, projects, and list items — a cross-surface collision (memory + list item + project on the same idea) is the strongest possible signal.

Return ONLY a JSON array, no preamble, no markdown:

[{
  "crossover_title": "3-6 words naming the mechanism, concrete, not cute",
  "hook": "One sentence starting with 'You' + present-tense verb. The aha. NOT a restatement of the_pattern.",
  "the_pattern": "1-2 sentences naming the hidden thread. References ≥2 specific items by title/content.",
  "the_experiment": "1-2 sentences. ONE thing to try. Starts with an imperative verb. Names a specific project/note/list item they already have.",
  "first_steps": [
    "verb-led, 8-14 words, names a specific item",
    "verb-led, 8-14 words, names a specific item",
    "verb-led, 8-14 words, names a specific item"
  ],
  "observation_basis": "cross_source_echo | capability_gap | memory_cluster | new_project_idea | cross_surface_cluster | synthesis",
  "source_snippets": ["exact memory / article / list-item / project title that triggered this"],
  "capabilityIds": ["uuid-from-capabilities-list-above"],
  "isWildcard": false,
  "non_obvious_score": 1-10
}]

BEFORE RETURNING each item, self-check:
- Does hook start with "You" + present-tense verb (not "Your", not "You're", not conditional)?
- Does the_pattern name ≥2 specific items by title?
- Does the_experiment start with an imperative verb and name a specific item?
- Are all 3 first_steps verb-led, 8-14 words, each naming a specific item?
- Is the_experiment just the_pattern reworded? If yes, rewrite.
- Is the hook just the_pattern reworded? If yes, rewrite.
- Any banned phrase anywhere? If yes, rewrite.

Only return items scoring 7+. Fewer is fine.`

  // Pro: cross-source project suggestion is a high-stakes synthesis task.
  // Runs on-demand / scheduled — not per memory — so the cost is bounded.
  const model = genAI.getGenerativeModel({ model: MODELS.PRO })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  })
  const text = result.response.text()

  try {
    let cleanedText = text.trim()
    const markdownMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (markdownMatch) {
      cleanedText = markdownMatch[1].trim()
    }
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText)
  } catch (e) {
    logger.error({ text }, 'Failed to parse generation JSON')
    return []
  }
}

// ─── Filtering and scoring ────────────────────────────────────────────────────

async function filterAndScoreSuggestions(
  ideas: any[],
  userId: string,
  memories: RichMemory[],
  capabilities: Capability[],
  dismissalPatterns?: DismissalPattern
): Promise<ProjectIdea[]> {
  const { data: history } = await supabase
    .from('project_suggestions')
    .select('title, description, embedding')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const ideaTexts = ideas.map(i => `${i.title}\n${i.description}`)
  const newEmbeddings = await batchGenerateEmbeddings(ideaTexts)

  const finalSuggestions: ProjectIdea[] = []

  // Build a title→id lookup from loaded memories for source resolution
  const memoryTitleToId = new Map<string, string>()
  for (const m of memories) {
    if (m.title) memoryTitleToId.set(m.title.toLowerCase().trim(), m.id)
  }

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    const emb = newEmbeddings[i]

    // Unified schema: synthesis now emits the same crossover shape as the
    // intersection engine (hook / the_pattern / the_experiment / first_steps).
    const title = (idea.crossover_title || idea.title || '').trim()
    const hook = (idea.hook || '').trim()
    const thePattern = (idea.the_pattern || idea.reasoning || '').trim()
    const theExperiment = (idea.the_experiment || '').trim()
    const firstSteps = Array.isArray(idea.first_steps)
      ? idea.first_steps.map((s: unknown) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).slice(0, 3)
      : []

    if (!title || !hook || !thePattern || !theExperiment) {
      logger.warn({ title, hook: !!hook, pattern: !!thePattern, experiment: !!theExperiment }, 'Synthesis idea missing required crossover fields — dropping')
      continue
    }

    const isDuplicate = (history || []).some(h => {
      const embeddingSimilar = h.embedding && cosineSimilarity(emb, h.embedding) > 0.92
      const titleSimilar = h.title?.toLowerCase().trim() === title.toLowerCase().trim()
      return embeddingSimilar || titleSimilar
    })

    if (isDuplicate) {
      logger.info({ title }, 'Skipping duplicate suggestion')
      continue
    }

    // Resolve source snippet titles to memory IDs
    const sourceSnippets: string[] = idea.source_snippets || []
    const memoryIds = sourceSnippets
      .map((snippet: string) => memoryTitleToId.get(snippet.toLowerCase().trim()))
      .filter((id): id is string => !!id)

    // Novelty score based on how many real sources were cited (grounding depth)
    const noveltyScore = Math.min(sourceSnippets.length / 5, 1.0) || 0.6
    const feasibilityScore = (idea.capabilityIds || []).length > 0 ? 0.75 : 0.6
    const interestScore = memoryIds.length > 0 ? Math.min(memoryIds.length / 3, 1.0) : 0.5

    // Penalty for ideas relying heavily on capabilities the user keeps dismissing
    let dismissalPenalty = 0
    if (dismissalPatterns?.dislikedCapabilities.length) {
      const dislikedSet = new Set(dismissalPatterns.dislikedCapabilities)
      const dislikedCount = (idea.capabilityIds || []).filter((id: string) => dislikedSet.has(id)).length
      dismissalPenalty = dislikedCount * 0.08 // Each disliked capability reduces score
    }

    const totalPoints = Math.max(0, Math.round(
      ((noveltyScore * 0.3 + feasibilityScore * 0.4 + interestScore * 0.3) * 100) - (dismissalPenalty * 100)
    ))

    finalSuggestions.push({
      title,
      // Keep description as a short fallback for legacy readers. New UI reads
      // the_pattern / the_experiment / first_steps from crossover instead.
      description: (idea.description || theExperiment).trim(),
      reasoning: thePattern,
      crossover: {
        crossover_title: title,
        hook,
        the_pattern: thePattern,
        the_experiment: theExperiment,
        first_steps: firstSteps,
      },
      observationBasis: idea.observation_basis || 'synthesis',
      sourceSnippets,
      capabilityIds: (idea.capabilityIds || []).filter((id: string) =>
        capabilities.some(c => c.id === id)
      ),
      memoryIds,
      noveltyScore,
      feasibilityScore,
      interestScore,
      totalPoints,
      isWildcard: !!idea.isWildcard,
    })
  }

  return finalSuggestions
}

// ─── Mode constraints ─────────────────────────────────────────────────────────

const modeConstraints: Record<string, string> = {
  'one-skill': 'Each idea must use EXACTLY ONE capability. No combinations.',
  'quick': 'Every idea must be completable in 30 minutes or less. No setup-heavy tasks.',
  'stretch': 'Each idea must combine the user\'s WEAKEST skill with their STRONGEST. Push boundaries.',
  'analog': 'No screens, no code, no digital tools. Physical, analog projects only.',
  'opposite': 'Generate ideas that CONTRADICT the user\'s recent patterns. Surprise them.',
}

// ─── Dismissal pattern analysis ─────────────────────────────────────────────

interface DismissalPattern {
  topReasons: string[]
  avoidObservationTypes: string[]
  dislikedCapabilities: string[]
}

async function analyzeDismissalPatterns(userId: string): Promise<DismissalPattern> {
  const result: DismissalPattern = {
    topReasons: [],
    avoidObservationTypes: [],
    dislikedCapabilities: [],
  }

  try {
    // Get recently dismissed suggestions with their feedback
    const { data: dismissed } = await supabase
      .from('suggestion_ratings')
      .select('feedback, suggestion_id')
      .eq('user_id', userId)
      .eq('rating', -1)
      .order('rated_at', { ascending: false })
      .limit(30)

    if (!dismissed || dismissed.length === 0) return result

    // Extract feedback reasons (ignoring empty/null)
    const reasons = dismissed
      .map(d => d.feedback)
      .filter((f): f is string => !!f && f.trim().length > 0)

    // Count reason frequency
    const reasonCounts = new Map<string, number>()
    for (const reason of reasons) {
      const key = reason.toLowerCase().trim()
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1)
    }
    result.topReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason)

    // Get the dismissed suggestion details to find observation type patterns
    const dismissedIds = dismissed.map(d => d.suggestion_id)
    const { data: dismissedSuggestions } = await supabase
      .from('project_suggestions')
      .select('capability_ids, metadata')
      .in('id', dismissedIds)

    // Track which capabilities keep getting dismissed
    const capDismissals = new Map<string, number>()
    for (const s of dismissedSuggestions || []) {
      for (const capId of s.capability_ids || []) {
        capDismissals.set(capId, (capDismissals.get(capId) || 0) + 1)
      }
    }

    // Capabilities dismissed 3+ times are flagged
    result.dislikedCapabilities = [...capDismissals.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([capId]) => capId)

  } catch (err) {
    logger.warn({ error: err }, 'Dismissal analysis failed (non-fatal)')
  }

  return result
}

// ─── Observation type preference tracking ────────────────────────────────────

interface ObservationPreferences {
  preferred: string[]
  avoided: string[]
}

async function getObservationPreferences(userId: string): Promise<ObservationPreferences> {
  const result: ObservationPreferences = { preferred: [], avoided: [] }

  try {
    // Get suggestions with ratings, grouped by observation basis
    const { data: rated } = await supabase
      .from('project_suggestions')
      .select('metadata, status')
      .eq('user_id', userId)
      .in('status', ['rated', 'built', 'dismissed'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (!rated || rated.length === 0) return result

    const typeCounts: Record<string, { positive: number; negative: number }> = {}

    for (const s of rated) {
      const obsType = s.metadata?.observation_basis || 'unknown'
      if (!typeCounts[obsType]) typeCounts[obsType] = { positive: 0, negative: 0 }
      if (s.status === 'rated' || s.status === 'built') {
        typeCounts[obsType].positive++
      } else if (s.status === 'dismissed') {
        typeCounts[obsType].negative++
      }
    }

    for (const [type, counts] of Object.entries(typeCounts)) {
      const total = counts.positive + counts.negative
      if (total < 3) continue // Not enough data
      const ratio = counts.positive / total
      if (ratio >= 0.7) result.preferred.push(type)
      if (ratio <= 0.3) result.avoided.push(type)
    }
  } catch (err) {
    logger.warn({ error: err }, 'Observation preference analysis failed (non-fatal)')
  }

  return result
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runSynthesis(userId: string, mode?: string) {
  logger.info({ userId, mode }, 'Starting Deep Synthesis')

  // Load full data lake + feedback signals in parallel
  const [memories, articles, projects, capabilities, dismissalPatterns, obsPreferences, listItems] = await Promise.all([
    loadRichMemories(userId),
    loadRichArticles(userId),
    loadRichProjects(userId),
    loadCapabilities(userId),
    analyzeDismissalPatterns(userId),
    getObservationPreferences(userId),
    loadRichListItems(userId),
  ])

  logger.info({
    memories: memories.length,
    articles: articles.length,
    projects: projects.length,
    capabilities: capabilities.length,
    listItems: listItems.length,
    dismissalReasons: dismissalPatterns.topReasons.length,
    preferredObsTypes: obsPreferences.preferred,
  }, 'Data lake + feedback signals loaded')

  if (capabilities.length === 0 && memories.length === 0) {
    logger.warn('No data for synthesis')
    return []
  }

  // Mine patterns from the full data lake — memories, articles, projects,
  // AND list items. The cross_surface_cluster pattern lights up when the
  // same idea appears across all three user-facing surfaces.
  let observations = minePatterns(memories, articles, projects, capabilities, listItems)

  // Boost observations from preferred types and deprioritize avoided types
  if (obsPreferences.preferred.length > 0 || obsPreferences.avoided.length > 0) {
    const preferred = new Set(obsPreferences.preferred)
    const avoided = new Set(obsPreferences.avoided)
    observations.sort((a, b) => {
      const scoreA = preferred.has(a.type) ? 2 : avoided.has(a.type) ? -1 : 0
      const scoreB = preferred.has(b.type) ? 2 : avoided.has(b.type) ? -1 : 0
      return scoreB - scoreA
    })
  }

  // Capability pair weights for personalization
  let pairWeightsSection = ''
  try {
    const { data: pairWeights } = await supabase
      .from('capability_pair_scores')
      .select('capability_a, capability_b, weight')
      .eq('user_id', userId)
      .gt('weight', 0.1)
      .order('weight', { ascending: false })
      .limit(10)

    if (pairWeights && pairWeights.length > 0) {
      pairWeightsSection = `\nThe user particularly enjoys combinations of these capabilities:\n${pairWeights.map((p: any) => `- ${p.capability_a} + ${p.capability_b} (weight: ${p.weight.toFixed(2)})`).join('\n')}\n`
    }
  } catch (pairError) {
    logger.warn({ error: pairError }, 'Failed to fetch pair weights (non-fatal)')
  }

  // Build dismissal feedback section for the prompt
  let dismissalSection = ''
  if (dismissalPatterns.topReasons.length > 0) {
    dismissalSection += `\nPATTERNS FROM PAST FEEDBACK — the user has repeatedly dismissed suggestions for these reasons:\n${dismissalPatterns.topReasons.map(r => `- "${r}"`).join('\n')}\nAvoid generating ideas that would trigger these same objections.\n`
  }

  // Build observation preference section
  let obsPreferenceSection = ''
  if (obsPreferences.preferred.length > 0) {
    obsPreferenceSection += `\nThe user tends to PREFER ideas grounded in: ${obsPreferences.preferred.join(', ')} observations.\n`
  }
  if (obsPreferences.avoided.length > 0) {
    obsPreferenceSection += `The user tends to DISMISS ideas grounded in: ${obsPreferences.avoided.join(', ')} observations. De-emphasize these.\n`
  }

  const modeSection = mode && modeConstraints[mode]
    ? `\nCONSTRAINT MODE: ${modeConstraints[mode]}\n`
    : ''

  // Previous suggestions to avoid repetition
  const { data: recentSuggestions } = await supabase
    .from('project_suggestions')
    .select('title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const previousTitles = (recentSuggestions || []).map(s => s.title)

  // Generate ideas from observations — now with feedback context
  const rawIdeas = await generateFromObservations(
    observations,
    capabilities,
    projects,
    CONFIG.SUGGESTIONS_PER_RUN,
    previousTitles,
    pairWeightsSection + dismissalSection + obsPreferenceSection,
    modeSection,
    listItems
  )

  const scored = await filterAndScoreSuggestions(
    rawIdeas, userId, memories, capabilities, dismissalPatterns
  )

  // Unified critic gate — synthesis now emits the same crossover shape as
  // the intersection engine, so the same auditCandidate() runs here. One
  // quality bar across INSIGHT, MASHUP, and synthesis decks. Audits run in
  // parallel; rejections are logged with reasons so we can tune the prompt.
  const auditResults = await Promise.all(
    scored.map(idea => auditCandidate({
      crossover_title: idea.crossover.crossover_title,
      hook: idea.crossover.hook,
      the_pattern: idea.crossover.the_pattern,
      the_experiment: idea.crossover.the_experiment,
      first_steps: idea.crossover.first_steps,
    }).then(result => ({ idea, result })))
  )
  const suggestions = auditResults
    .filter(({ idea, result }) => {
      if (result.ok) return true
      logger.warn({ title: idea.title, reasons: result.reasons }, 'Synthesis critic rejected suggestion')
      return false
    })
    .map(({ idea }) => idea)

  logger.info({ scored: scored.length, keptAfterCritic: suggestions.length }, 'Synthesis critic complete')

  if (suggestions.length > 0) {
    const { error } = await supabase
      .from('project_suggestions')
      .insert(suggestions.map(s => ({
        user_id: userId,
        title: s.title,
        description: s.description,
        synthesis_reasoning: s.reasoning,
        novelty_score: s.noveltyScore,
        feasibility_score: s.feasibilityScore,
        interest_score: s.interestScore,
        total_points: s.totalPoints,
        capability_ids: s.capabilityIds,
        memory_ids: s.memoryIds,
        is_wildcard: s.isWildcard,
        status: 'pending',
        // Crossover lives in metadata so no DB migration is needed. The UI
        // reads metadata.crossover to render pattern / experiment / steps
        // with the same structure as INSIGHT and MASHUP cards.
        metadata: {
          observation_basis: s.observationBasis,
          crossover: s.crossover,
          source_snippets: s.sourceSnippets,
        },
      })))

    if (error) logger.error({ error }, 'Failed to store suggestions')
  }

  logger.info({ count: suggestions.length }, 'Deep Synthesis Complete')
  return suggestions
}
