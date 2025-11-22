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
import { getSupabaseConfig, getGeminiConfig } from './env.js'
import { logger } from './logger.js'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

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

  const prompt = `You are seeding dreams. Not generating prompts—inviting the sleeping mind into the strange places where these things are already meeting.

**WHAT'S ALIVE RIGHT NOW:**
${inputsList}

Your job: Find the dream that's already happening in the space between these. Don't announce what you're doing. Don't apply rules. Just walk into the forest and notice what's there.

Generate 2-4 prompts. Each one is a doorway. Not a question with an expected answer. Not a scenario you've constructed. A moment where something shifts.

Some might be concrete (you can touch it, see it, hear it). Some might be the feeling of understanding something you didn't know you knew. Some might be about time folding. Some might be spatial—the way objects relate. Some might be almost-memories.

The only rule: it has to pull from the actual titles and things here. Not generic. Specific to what's actually in the system.

Don't end with a question mark if it doesn't belong. Don't narrate. Let the dream speak. If there's a sensory detail that matters, it'll be there naturally—not because you added it as a requirement.

Tone: Like you're half-asleep yourself. Noticing. Not explaining.

Return ONLY valid JSON:
[
  {
    "prompt": "The full prompt—could be 1 sentence or 4. Could ask something or just state a moment. Whatever the dream needs.",
    "type": "connection|divergent|revisit|transform",
    "format": "visualization|scenario|incubation|question|statement"
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

  const prompt = `You are a hypnagogic thought catalyst. Generate 3-5 prompts for the pre-sleep state when the brain excels at pattern recognition and creative synthesis.

**HYPNAGOGIC STATE POWERS:**
The twilight between waking and sleep enables: associative thinking, pattern recognition, creative problem-solving, and memory consolidation. Your prompts should SEED questions the sleeping mind will process overnight.

**USER'S KNOWLEDGE MAP:**

**Recent Reading (top 5 of last 2 weeks):**
${topArticles.length > 0 ? topArticles.map(a => `- "${a.title}" [${a.tags.join(', ')}]\n  ${a.summary}`).join('\n\n') : 'No recent reading'}

**Recent Thoughts (top 8 of last 7 days):**
${topMemories.length > 0 ? topMemories.map(m => `- "${m.title}" [${m.themes.join(', ')}]\n  ${m.body}`).join('\n\n') : 'No recent thoughts'}

**Projects (Outputs):**
${projectContext}

**Detected Connections:**
${connections.length > 0 ? connections.map(c => `- ${c}`).join('\n') : 'No obvious connections yet'}

**Recurring Themes:** ${consequentialThemes.length > 0 ? consequentialThemes.join(', ') : 'None'}

**Old Insights (14-90 days ago):**
${oldInsights.length > 0 ? oldInsights.map(i => `- "${i.title}"`).join('\n') : 'None'}

**PROMPT TYPES:**
1. **connection** - Bridge disparate knowledge pieces
2. **divergent** - Unlock new angles via pattern disruption
3. **revisit** - Resurface dormant insights for current relevance
4. **transform** - Personal growth through pattern synthesis
5. **strategic_insight** - Connect a project's deep MOTIVATION with a recent thought/article

**PROMPT FORMATS:**
1. **question** - Create productive cognitive tension (open loops for sleeping mind to resolve)
2. **statement** - Declarative with embedded suggestions (use present progressive tense)
3. **visualization** - Multi-sensory guided imagery (spatial, kinesthetic, transformative)
4. **scenario** - Dreamlike what-if exploration (non-linear, symbolic, archetypal)
5. **incubation** - Dream seeding structure: brief seed + sensory anchor + permission to release

**CRAFTING RULES (CRITICAL):**
- **NO FORMULAIC COMBINATIONS**: Do NOT just say "Combine Project X and Article Y". That is boring.
- **FOCUS ON THE "WHY"**: Use the project MOTIVATION. If they want to "build a legacy", connect *that* desire to a recent article about "long-term thinking", not just the project title.
- **USE METAPHOR**: Instead of "combine", use words like "weaving", "echoing", "colliding", "fertilizing".
- **BE SPECIFIC**: Reference actual details from the summaries/bodies, not just titles.

**HYPNAGOGIC LANGUAGE PATTERNS:**
1. **OPEN LOOPS**: "There's a hidden bridge between X and Y that only appears when you stop looking..."
2. **TEMPORAL FLUIDITY**: "The answer tomorrow needs the question tonight..."
3. **SENSORY ANCHORS**: "Picture [concept] as a shape... Feel its weight..."
4. **PERMISSION**: "You don't need to solve this now... Your dreaming mind knows what to do."

**EXCELLENT EXAMPLES:**
✅ "You wrote that you want to '${activeProjects[0]?.metadata?.motivation || 'change the world'}' with '${activeProjects[0]?.title || 'Project A'}'. That feeling is the same shape as the idea in '${topArticles[0]?.title || 'Article B'}'. Tonight, let them overlap."
✅ "The reason '${activeProjects.find(p => p.status === 'dormant')?.title || 'Project X'}' is stuck isn't technical. It's waiting for the insight you had in '${topMemories[0]?.title || 'Memory Y'}'. As you sleep, watch the blockage dissolve."

**CONTEXT SIGNALS:**
${context.hasNoProjects && context.hasRichInput ? '→ Rich input, no projects: Suggest CONNECTION prompts showing project possibilities' : ''}
${context.hasBlockedProjects ? '→ Blocked projects: Try REVISIT prompts using old insights to unlock' : ''}

${performance ? `**WHAT WORKS FOR THIS USER:**
- Best type: "${performance.bestType}"
- Best format: "${performance.bestFormat}"
` : ''}

Return ONLY valid JSON:
[
  {
    "prompt": "Full prompt text...",
    "type": "connection|divergent|revisit|transform|strategic_insight",
    "relatedIds": ["IDs of items referenced"],
    "metaphor": "Optional 1-sentence poetic framing",
    "format": "question|statement|visualization|scenario|incubation"
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
