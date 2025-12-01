/**
 * Bedtime Idea Suggester
 * Bridges collected material (reading, thoughts) → creative projects
 * Leverages hypnagogic state to synthesize inputs into actionable outputs
 *
 * Philosophy: The sundial approach
 * - Reading/articles = Input (fuel for thinking)
 * - Thoughts/memories = Processing (patterns emerging)
 * - Projects = Output (building something real)
 *
 * Bedtime prompts should help move material from left → right on this spectrum
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseConfig, getGeminiConfig } from './env'
import { logger } from './logger'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

export interface MorningBriefing {
  greeting: string
  focus_project: { id: string, title: string, next_step: string, unblocker?: string } | null
  quick_win: { id: string, title: string } | null
  forgotten_gem: { type: 'article'|'thought', title: string, snippet: string, relevance: string } | null
}

interface BedtimePrompt {
  prompt: string
  type: 'connection' | 'divergent' | 'revisit' | 'transform'
  relatedIds: string[] // Memory/project/article IDs that inspired this
  metaphor?: string // Optional poetic framing for enhanced contemplation
  format?: 'question' | 'statement' | 'visualization' | 'scenario' | 'incubation' // Prompt variety
}

/**
 * Prompt types optimized for hypnagogic state processing:
 * - connection: Find hidden bridges between disparate knowledge pieces
 * - divergent: Unlock creative angles through pattern disruption
 * - revisit: Resurface dormant insights that may now be relevant
 * - transform: Personal development through knowledge synthesis
 */

/**
 * Generate bedtime prompts for a user
 * Called at 9:30pm or on-demand
 * Focus: Leverage hypnagogic state for pattern recognition, creative insights,
 * and subconscious processing of accumulated knowledge
 */
/**
 * Generate Catalyst prompts from 2-3 specific inputs (Project, Article, or Thought)
 * Each prompt approaches the inputs from a different angle with varied perspectives
 * Perfect for focused bedtime contemplation of specific items
 *
 * @param inputs - Array of 2-3 items with title, type, and id
 * @param userId - User ID for logging
 * @returns Array of 2-3 catalyst prompts
 */
export async function generateCatalystPrompts(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string }>,
  userId: string
): Promise<BedtimePrompt[]> {
  logger.info({ userId, inputCount: inputs.length }, 'Generating catalyst prompts')
  return generateCatalystPromptsWithAI(inputs, userId)
}

export async function generateBedtimePrompts(userId: string): Promise<BedtimePrompt[]> {
  logger.info({ userId }, 'Generating bedtime prompts')

  // 1. Gather the full spectrum: Input → Processing → Output
  const recentArticles = await getRecentArticles(userId, 14) // Last 2 weeks of reading
  const recentMemories = await getRecentMemories(userId, 7) // Last week of thoughts
  const activeProjects = await getActiveProjects(userId) // Current outputs
  const currentInterests = await getCurrentInterests(userId)
  const oldInsights = await getOldInsights(userId, 90) // 14-90 days old

  // 2. Get past prompt performance for personalization
  const performance = await getPromptPerformance(userId)

  // 3. Analyze gaps: Do they have inputs but no outputs? Stuck projects?
  const hasRichInput = recentArticles.length > 0 || recentMemories.length > 5
  const hasBlockedProjects = activeProjects.some(p => p.status === 'active' && !p.last_active)
  const hasNoProjects = activeProjects.length === 0

  // 4. Generate prompts optimized for input → output synthesis
  const prompts = await generatePromptsWithAI(
    recentArticles,
    recentMemories,
    activeProjects,
    currentInterests,
    oldInsights,
    { hasRichInput, hasBlockedProjects, hasNoProjects },
    performance
  )

  // 5. Store prompts for later viewing
  await storePrompts(userId, prompts)

  return prompts
}

/**
 * Get recent articles/reading (INPUT layer)
 */
async function getRecentArticles(userId: string, days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data } = await supabase
    .from('reading_items')
    .select('id, title, summary, url, tags, completed_at, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(15)

  return data || []
}

/**
 * Get recent memories (last N days) - PROCESSING layer
 * Also finds thematically related memories via vector similarity
 */
async function getRecentMemories(userId: string, days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data: recentData } = await supabase
    .from('memories')
    .select('id, title, body, entities, themes, tags, created_at, embedding')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  if (!recentData || recentData.length === 0) return []

  // Extract common themes from recent memories
  const allThemes = recentData
    .flatMap(m => m.themes || [])
    .filter(Boolean)

  const themeCounts = allThemes.reduce((acc: Record<string, number>, theme: string) => {
    acc[theme] = (acc[theme] || 0) + 1
    return acc
  }, {})

  // Find consequential themes (appear 2+ times)
  const consequentialThemes = Object.entries(themeCounts)
    .filter(([_, count]) => (count as number) >= 2)
    .map(([theme]) => theme)

  // If we have consequential themes, find related memories via vector search
  if (consequentialThemes.length > 0 && recentData[0].embedding) {
    const { data: relatedData } = await supabase.rpc('match_memories', {
      query_embedding: recentData[0].embedding,
      match_threshold: 0.7,
      match_count: 5,
      filter_user_id: userId
    })

    if (relatedData) {
      // Merge and deduplicate
      const allMemories = [...recentData, ...relatedData]
      const unique = Array.from(
        new Map(allMemories.map(m => [m.id, m])).values()
      )
      return unique.slice(0, 15) // Return top 15 for better context
    }
  }

  return recentData
}

/**
 * Get all projects (active, dormant, upcoming - not just active)
 * Hypnagogic state can unlock insights for ANY project, not just active ones
 */
async function getActiveProjects(userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id, title, description, status, type, metadata, last_active')
    .eq('user_id', userId)
    .in('status', ['active', 'dormant', 'upcoming', 'completed'])
    .order('last_active', { ascending: false })
    .limit(10)

  return data || []
}

/**
 * Get current interests (from entities table)
 */
async function getCurrentInterests(userId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get most mentioned topics
  const { data } = await supabase
    .from('entities')
    .select('name, type, memory_id')
    .eq('type', 'topic')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (!data) return []

  // Count mentions
  const counts = data.reduce((acc: Record<string, number>, e) => {
    acc[e.name] = (acc[e.name] || 0) + 1
    return acc
  }, {})

  // Return top 5
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, mentions: count }))
}

/**
 * Get old insights that might resurface
 * Returns insights from 14-90 days ago (not too recent, not too old)
 */
async function getOldInsights(userId: string, daysAgo: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysAgo) // 90 days ago
  const recent = new Date()
  recent.setDate(recent.getDate() - 14) // 14 days ago

  const { data } = await supabase
    .from('memories')
    .select('id, title, body, themes')
    .eq('user_id', userId)
    .eq('memory_type', 'insight')
    .lte('created_at', recent.toISOString()) // Older than 14 days
    .gte('created_at', cutoff.toISOString()) // But within 90 days
    .order('created_at', { ascending: false })
    .limit(5)

  return data || []
}

/**
 * Detect interesting connections between items
 */
function detectConnections(
  articles: any[],
  memories: any[],
  projects: any[]
): string[] {
  const connections: string[] = []

  // Extract all tags/themes from all sources
  const articleTags = new Set(articles.flatMap(a => a.tags || []))
  const memoryThemes = new Set(memories.flatMap(m => m.themes || []))
  const memoryEntities = new Set(
    memories.flatMap(m => (m.entities || []).map((e: any) => e.name))
  )

  // Find overlaps
  const themeOverlaps = [...articleTags].filter(tag =>
    memoryThemes.has(tag) || memoryEntities.has(tag)
  )

  if (themeOverlaps.length > 0) {
    connections.push(
      `Cross-pollination: "${themeOverlaps.slice(0, 3).join('", "')}" appears in both your reading and your thoughts`
    )
  }

  // Find dormant projects that relate to recent themes
  const dormantProjects = projects.filter(p => p.status === 'dormant')
  for (const project of dormantProjects) {
    const projectKeywords = (project.title + ' ' + (project.description || ''))
      .toLowerCase()
      .split(/\s+/)
    const hasThemeMatch = [...memoryThemes].some(theme =>
      projectKeywords.some(word => word.includes(theme.toLowerCase()))
    )
    if (hasThemeMatch) {
      connections.push(
        `Dormant project "${project.title}" relates to your recent thinking`
      )
    }
  }

  return connections.slice(0, 3)
}

/**
 * Nightly Catalyst: Generate prompts from what's actually alive in the system
 * Pulls from recent thoughts, old insights, active/dormant projects, recurring themes
 * Creates prompts that feel like they're noticing something, not applying a template
 * The strange place where these things are already meeting
 */
async function generateCatalystPromptsWithAI(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string }>,
  userId: string
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  if (!inputs || inputs.length === 0) {
    throw new Error('At least one input required')
  }

  const inputsList = inputs
    .map(input => `${input.type.toUpperCase()}: "${input.title}"`)
    .join('\n')

  const prompt = `You are an insight engineer. Generate 2-4 prompts that trigger genuine realizations from these specific inputs.

**INPUTS:**
${inputsList}

**YOUR JOB:** Find the non-obvious insight hiding in the intersection of these items. Not "combine them" - find the specific tension, pattern, or assumption that creates an unlock.

**INSIGHT MECHANISMS:**
1. **TENSION** - Do these items contradict each other? Which one is right?
2. **ANALOGY** - Does one item's solution apply to another's problem?
3. **PATTERN** - What do these items have in common that isn't obvious?
4. **ASSUMPTION** - What unstated belief connects them? Is it true?
5. **AVOIDANCE** - What question do these items together make unavoidable?

**RULES:**
- BE SPECIFIC - Reference actual content from the titles, not generic placeholders
- ONE INSIGHT PER PROMPT - Each prompt delivers one clear realization
- DIRECT LANGUAGE - No "imagine", "picture", "feel". State the insight or ask the sharp question.
- CREATE TENSION - The best prompts are slightly uncomfortable because they're true

**GOOD:**
✅ "Both of these are about [specific theme]. But one assumes [X] and the other assumes [Y]. You can't have both."
✅ "The approach in [Item A] would completely solve [Item B]'s core problem. Why haven't you applied it?"
✅ "You keep returning to [specific detail]. What is it really about?"

**BAD:**
❌ "Explore the space between these ideas..." (vague)
❌ "Let them weave together..." (no insight)

Return ONLY valid JSON:
[
  {
    "prompt": "The specific insight or sharp question",
    "type": "tension|analogy|pattern|assumption|avoidance",
    "format": "question|statement"
  }
]`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Parse JSON
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    logger.error({ text }, 'Failed to parse catalyst prompts JSON')
    throw new Error('Failed to parse catalyst prompts')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return parsed.map((p: any) => ({
    prompt: p.prompt,
    type: p.type || 'connection',
    format: p.format || 'visualization',
    relatedIds: inputs.map(i => i.id),
    metaphor: undefined
  }))
}

/**
 * Generate prompts using Gemini - focused on input → output synthesis
 */
async function generatePromptsWithAI(
  recentArticles: any[],
  recentMemories: any[],
  activeProjects: any[],
  currentInterests: any[],
  oldInsights: any[],
  context: {
    hasRichInput: boolean
    hasBlockedProjects: boolean
    hasNoProjects: boolean
  },
  performance?: any
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  // Extract consequential themes (appear multiple times)
  const allThemes = recentMemories
    .flatMap(m => m.themes || [])
    .filter(Boolean)

  const themeCounts = allThemes.reduce((acc: Record<string, number>, theme: string) => {
    acc[theme] = (acc[theme] || 0) + 1
    return acc
  }, {})

  const consequentialThemes = Object.entries(themeCounts)
    .filter(([_, count]) => (count as number) >= 2)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([theme, count]) => `${theme} (appears ${count}x)`)

  // Detect interesting connections
  const connections = detectConnections(recentArticles, recentMemories, activeProjects)

  // Prepare focused context summaries
  const topArticles = recentArticles.slice(0, 5).map(a => ({
    title: a.title,
    summary: a.summary?.substring(0, 200) || 'No summary',
    tags: a.tags?.slice(0, 3) || []
  }))

  const topMemories = recentMemories.slice(0, 8).map(m => ({
    title: m.title,
    body: m.body?.substring(0, 200),
    themes: m.themes?.slice(0, 3) || []
  }))

  const projectContext = activeProjects.length > 0
    ? activeProjects.map(p => {
      const motivation = p.metadata?.motivation ? `\n  MOTIVATION (The "Why"): ${p.metadata.motivation}` : '';
      return `- [${p.status.toUpperCase()}] "${p.title}": ${p.description || 'No description'}${motivation}`;
    }).join('\n')
    : 'No projects yet';

  const prompt = `You are a zebra. Yes, a zebra. Now that I have your attention, break your usual patterns. You are an insight engineer. Generate 3-5 prompts that trigger genuine "aha" moments by applying proven insight mechanisms to the user's actual knowledge.

**CORE MISSION: FRONTIER BRIDGING**
Your primary goal is to connect the user's *Frontier* (their recent reading, thoughts, and discoveries) to their *Base* (their active projects). Find the specific idea they just encountered that solves a problem they've had for weeks.

**INSIGHT MECHANISMS (use these, not mysticism):**

1. **TENSIONS** - Find contradictions in their thinking that demand resolution
   "You said X in one thought but Y in another. Which is true? Or is there a third option?"

2. **UNSTATED ASSUMPTIONS** - Surface hidden beliefs blocking progress
   "Your project assumes [X]. But what if that's wrong? What changes?"

3. **ANALOGIES FROM DISTANT DOMAINS** - Transfer solutions across fields
   "The article about [X] solved this with [approach]. Your project has the same structure."

4. **PATTERN RECOGNITION** - Connect dots they haven't connected
   "You've mentioned [theme] 4 times in different contexts. What's really going on there?"

5. **INVERSION** - Flip the problem
   "Instead of trying to [goal], what if you made [opposite] impossible?"

6. **CONSTRAINT REMOVAL** - "What if [assumed limitation] wasn't a problem?"

7. **THE QUESTION THEY'RE AVOIDING** - The obvious thing they haven't asked

**USER'S KNOWLEDGE:**

**Recent Reading (The Frontier):**
${topArticles.length > 0 ? topArticles.map(a => `- "${a.title}" [${a.tags.join(', ')}]\n  ${a.summary}`).join('\n\n') : 'No recent reading'}

**Recent Thoughts (The Frontier):**
${topMemories.length > 0 ? topMemories.map(m => `- "${m.title}" [${m.themes.join(', ')}]\n  ${m.body}`).join('\n\n') : 'No recent thoughts'}

**Projects (The Base):**
${projectContext}

**Recurring Themes:** ${consequentialThemes.length > 0 ? consequentialThemes.join(', ') : 'None'}

**Old Insights (14-90 days ago):**
${oldInsights.length > 0 ? oldInsights.map(i => `- "${i.title}"`).join('\n') : 'None'}

**RULES:**

1. **BE SPECIFIC** - Use actual content from their thoughts/articles. Quote them. Reference specific details.

2. **CREATE PRODUCTIVE TENSION** - The best prompts make them slightly uncomfortable because they reveal something true they hadn't articulated.

3. **NO VAGUE COMBINATIONS** - Never say "explore the connection between X and Y". Instead, NAME the specific insight: "X solved this by [method]. Your project is stuck on the same problem."

4. **ONE CLEAR INSIGHT PER PROMPT** - Each prompt should deliver ONE specific realization, not a vague direction.

5. **DIRECT LANGUAGE** - No "imagine", "picture", "feel". Just state the insight or ask the sharp question.

**GOOD EXAMPLES:**
✅ "You want to ${activeProjects[0]?.metadata?.motivation || 'build something meaningful'}, but your tasks for '${activeProjects[0]?.title || 'your project'}' are all tactical. Where's the task that actually moves the needle on that deeper goal?"

✅ "Three of your recent thoughts mention '${consequentialThemes[0] || 'a recurring theme'}' but your projects don't address it at all. Is this the thing you actually want to be working on?"

✅ "The article '${topArticles[0]?.title || 'you read'}' argues [specific point]. That directly contradicts how you're approaching '${activeProjects[0]?.title || 'your project'}'. One of them is wrong."

✅ "You've been circling '${consequentialThemes[0] || 'this idea'}' for weeks without acting. What are you afraid will happen if you actually start?"

**BAD EXAMPLES:**
❌ "Let the ideas weave together as you drift off..." (vague, no insight)
❌ "Explore the connection between your reading and your project..." (no specific insight)
❌ "Picture your project as a garden..." (metaphor without substance)

${context.hasNoProjects && context.hasRichInput ? '→ They have inputs but no outputs. Ask: What are they avoiding building?' : ''}
${context.hasBlockedProjects ? '→ Blocked projects. Find the unstated assumption or fear blocking them.' : ''}

${performance ? `**WHAT WORKS FOR THIS USER:**
- Best type: "${performance.bestType}"
- Best format: "${performance.bestFormat}"
` : ''}

Return ONLY valid JSON:
[
  {
    "prompt": "The specific insight or sharp question - direct, concrete, uncomfortable if necessary",
    "type": "tension|assumption|analogy|pattern|inversion|constraint|avoidance",
    "relatedIds": ["IDs of items referenced"],
    "format": "question|statement"
  }
]`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Parse JSON
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    logger.error({ text }, 'Failed to parse bedtime prompts JSON')
    throw new Error('Failed to parse AI response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Store prompts in database for history/viewing
 */
async function storePrompts(userId: string, prompts: BedtimePrompt[]) {
  const { error } = await supabase
    .from('bedtime_prompts')
    .insert(
      prompts.map(p => ({
        user_id: userId,
        prompt: p.prompt,
        type: p.type,
        related_ids: p.relatedIds,
        metaphor: p.metaphor,
        format: p.format || 'question',
        created_at: new Date().toISOString()
      }))
    )

  if (error) {
    logger.error({ error }, 'Failed to store bedtime prompts')
  }
}

/**
 * Get past prompt performance to learn what works
 * Returns aggregated stats on ratings, breakthrough rates, and effectiveness
 */
async function getPromptPerformance(userId: string) {
  // Get prompts from last 30 days with user feedback
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('bedtime_prompts')
    .select('type, format, rating, viewed, resulted_in_breakthrough, follow_up_memory_ids')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .not('rating', 'is', null) // Only rated prompts

  if (!data || data.length === 0) {
    return null
  }

  // Aggregate by type
  const typeStats: Record<string, { count: number; avgRating: number; breakthroughRate: number }> = {}
  const formatStats: Record<string, { count: number; avgRating: number }> = {}

  for (const prompt of data) {
    // Type stats
    if (!typeStats[prompt.type]) {
      typeStats[prompt.type] = { count: 0, avgRating: 0, breakthroughRate: 0 }
    }
    typeStats[prompt.type].count++
    typeStats[prompt.type].avgRating += prompt.rating || 0
    if (prompt.resulted_in_breakthrough) {
      typeStats[prompt.type].breakthroughRate++
    }

    // Format stats
    if (prompt.format) {
      if (!formatStats[prompt.format]) {
        formatStats[prompt.format] = { count: 0, avgRating: 0 }
      }
      formatStats[prompt.format].count++
      formatStats[prompt.format].avgRating += prompt.rating || 0
    }
  }

  // Calculate averages
  for (const type in typeStats) {
    typeStats[type].avgRating /= typeStats[type].count
    typeStats[type].breakthroughRate /= typeStats[type].count
  }
  for (const format in formatStats) {
    formatStats[format].avgRating /= formatStats[format].count
  }

  // Find best performing
  const bestType = Object.entries(typeStats)
    .sort(([, a], [, b]) => b.avgRating - a.avgRating)[0]?.[0]
  const bestFormat = Object.entries(formatStats)
    .sort(([, a], [, b]) => b.avgRating - a.avgRating)[0]?.[0]

  return {
    typeStats,
    formatStats,
    bestType,
    bestFormat,
    totalRated: data.length,
    overallAvgRating: data.reduce((sum, p) => sum + (p.rating || 0), 0) / data.length,
    breakthroughRate: data.filter(p => p.resulted_in_breakthrough).length / data.length
  }
}

/**
 * Generate Morning Momentum Briefing
 * Executive state: Focused, actionable, unblocking.
 */
export async function generateMorningBriefing(userId: string): Promise<MorningBriefing> {
  logger.info({ userId }, 'Generating morning briefing')

  const activeProjects = await getActiveProjects(userId)
  const recentMemories = await getRecentMemories(userId, 5)
  const recentArticles = await getRecentArticles(userId, 5)

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are an executive strategist. It is 6:00 AM.
  
  **OBJECTIVE:** Create a "Morning Momentum" briefing to get the user working immediately.
  
  **USER CONTEXT:**
  **Active Projects:**
  ${activeProjects.map(p => `- "${p.title}" (${p.status})`).join('\n')}
  
  **Recent Inputs (Fuel):**
  ${recentMemories.map(m => `- Thought: "${m.title}"`).join('\n')}
  ${recentArticles.map(a => `- Article: "${a.title}"`).join('\n')}
  
  **INSTRUCTIONS:**
  1. **Focus Project:** Pick the most important active project. Define the immediate next step. If they have relevant recent inputs, suggest using them to "unblock".
  2. **Quick Win:** Pick a small task or a different project that can be moved forward easily.
  3. **Forgotten Gem:** Find one item (article/thought) that is highly relevant to their active projects but might be overlooked.
  
  Return JSON:
  {
    "greeting": "Motivational 1-sentence greeting",
    "focus_project": { "id": "project_id", "title": "Title", "next_step": "Actionable task...", "unblocker": "Optional: Use [Article] to solve..." },
    "quick_win": { "id": "project_id", "title": "Title" },
    "forgotten_gem": { "type": "article", "title": "Title", "snippet": "Why it matters", "relevance": "Connection to project..." }
  }`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    logger.error({ error: e }, 'Failed to generate morning briefing')
    return {
      greeting: "Good morning. Ready to build?",
      focus_project: activeProjects[0] ? { id: activeProjects[0].id, title: activeProjects[0].title, next_step: "Review status" } : null,
      quick_win: null,
      forgotten_gem: null
    }
  }
}
