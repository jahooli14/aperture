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
export async function generateBedtimePrompts(userId: string): Promise<BedtimePrompt[]> {
  logger.info({ userId }, 'Generating bedtime prompts')

  // 1. Gather the full spectrum: Input → Processing → Output
  const recentArticles = await getRecentArticles(userId, 14) // Last 2 weeks of reading
  const recentMemories = await getRecentMemories(userId, 7) // Last week of thoughts
  const activeProjects = await getActiveProjects(userId) // Current outputs
  const currentInterests = await getCurrentInterests(userId)
  const oldInsights = await getOldInsights(userId, 90, recentMemories) // Semantically related old content
  const oldArticles = await getOldArticles(userId, recentMemories) // Forgotten reading material

  // 2. Get past prompt performance for personalization
  const performance = await getPromptPerformance(userId)

  // 3. NEW: Find exploration areas - themes with temporal depth
  const explorationAreas = await findExplorationAreas(
    userId,
    recentMemories,
    recentArticles,
    oldInsights,
    oldArticles
  )

  // 4. Analyze gaps: Do they have inputs but no outputs? Stuck projects?
  const hasRichInput = recentArticles.length > 0 || recentMemories.length > 5
  const hasBlockedProjects = activeProjects.some(p => p.status === 'active' && !p.last_active)
  const hasNoProjects = activeProjects.length === 0

  // 5. Generate prompts optimized for input → output synthesis
  const prompts = await generatePromptsWithAI(
    recentArticles,
    recentMemories,
    activeProjects,
    currentInterests,
    oldInsights,
    oldArticles,
    explorationAreas,
    { hasRichInput, hasBlockedProjects, hasNoProjects },
    performance
  )

  // 5. Store prompts for later viewing
  await storePrompts(userId, prompts)

  return prompts
}

/**
 * Get recent articles/reading (INPUT layer)
 * Enhanced to include embedding data for semantic matching
 */
async function getRecentArticles(userId: string, days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data } = await supabase
    .from('reading_items')
    .select('id, title, summary, url, tags, completed_at, created_at, embedding')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(15)

  return data || []
}

/**
 * NEW: Get old articles (from 2+ weeks ago) semantically related to current thinking
 * Surfaces forgotten reading material that's relevant to current themes
 */
async function getOldArticles(userId: string, recentMemories: any[]) {
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // If we have recent memory embeddings, find related old articles
  const recentWithEmbeddings = recentMemories.filter(m => m.embedding)

  if (recentWithEmbeddings.length === 0) {
    return []
  }

  // Note: This assumes reading_items has embeddings. If not, this will return empty.
  // Check if match_reading_items function exists, otherwise skip
  try {
    const { data: semanticMatches } = await supabase.rpc('match_reading_items', {
      query_embedding: recentWithEmbeddings[0].embedding,
      match_threshold: 0.65,
      match_count: 10,
      filter_user_id: userId
    })

    if (semanticMatches && semanticMatches.length > 0) {
      // Filter to old articles only
      const oldArticles = semanticMatches.filter((a: any) => {
        const createdAt = new Date(a.created_at)
        return createdAt <= twoWeeksAgo && createdAt >= ninetyDaysAgo
      })

      return oldArticles.slice(0, 5)
    }
  } catch (error) {
    // If match_reading_items doesn't exist, silently fail
    logger.warn('match_reading_items RPC not available - skipping old article matching')
  }

  return []
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
 * NOW USES EMBEDDINGS: Finds older content semantically related to recent themes
 * This creates powerful temporal bridges between current thinking and forgotten insights
 */
async function getOldInsights(userId: string, daysAgo: number, recentMemories: any[]) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysAgo) // 90 days ago
  const recent = new Date()
  recent.setDate(recent.getDate() - 14) // 14 days ago

  // Strategy 1: If we have recent memory embeddings, find semantically related old content
  const recentWithEmbeddings = recentMemories.filter(m => m.embedding)

  if (recentWithEmbeddings.length > 0) {
    // Use the most recent memory's embedding to find old related content
    const { data: semanticMatches } = await supabase.rpc('match_memories', {
      query_embedding: recentWithEmbeddings[0].embedding,
      match_threshold: 0.65, // Slightly lower threshold to catch broader connections
      match_count: 10,
      filter_user_id: userId
    })

    if (semanticMatches && semanticMatches.length > 0) {
      // Filter to only old memories (14-90 days ago)
      const oldMatches = semanticMatches.filter((m: any) => {
        const createdAt = new Date(m.created_at)
        return createdAt <= recent && createdAt >= cutoff
      })

      if (oldMatches.length > 0) {
        return oldMatches.slice(0, 5)
      }
    }
  }

  // Strategy 2: Fallback to date-based insights if no embeddings
  const { data } = await supabase
    .from('memories')
    .select('id, title, body, themes, created_at')
    .eq('user_id', userId)
    .eq('memory_type', 'insight')
    .lte('created_at', recent.toISOString())
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  return data || []
}

/**
 * NEW: Find "exploration areas" - themes that bridge recent and old content
 * Uses embeddings to discover what's "etched in the back of your mind"
 * Returns themes with temporal depth (recent surface + old echoes)
 */
async function findExplorationAreas(
  userId: string,
  recentMemories: any[],
  recentArticles: any[],
  oldInsights: any[],
  oldArticles: any[]
): Promise<Array<{
  theme: string
  recentMentions: number
  oldConnections: any[]
  explorationPotential: string
}>> {
  const areas: Array<{
    theme: string
    recentMentions: number
    oldConnections: any[]
    explorationPotential: string
  }> = []

  // Extract themes from recent content
  const recentThemes = new Map<string, number>()
  for (const memory of recentMemories) {
    for (const theme of memory.themes || []) {
      recentThemes.set(theme, (recentThemes.get(theme) || 0) + 1)
    }
  }
  for (const article of recentArticles) {
    for (const tag of article.tags || []) {
      recentThemes.set(tag, (recentThemes.get(tag) || 0) + 1)
    }
  }

  // Find themes that appear multiple times recently (high current interest)
  const consequentialThemes = Array.from(recentThemes.entries())
    .filter(([_, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // For each consequential theme, find old connections (from both insights AND articles)
  for (const [theme, recentCount] of consequentialThemes) {
    const oldConnectionsForTheme = [
      ...oldInsights.filter(insight => {
        const insightText = `${insight.title} ${insight.body || ''}`.toLowerCase()
        return insightText.includes(theme.toLowerCase())
      }),
      ...oldArticles.filter(article => {
        const articleText = `${article.title} ${article.summary || ''}`.toLowerCase()
        const tags = (article.tags || []).map((t: string) => t.toLowerCase())
        return articleText.includes(theme.toLowerCase()) || tags.includes(theme.toLowerCase())
      })
    ]

    if (oldConnectionsForTheme.length > 0) {
      // This theme has temporal depth - it's both current AND historical
      let potential = ''
      if (oldConnectionsForTheme.length === 1) {
        potential = 'rediscovery'
      } else if (oldConnectionsForTheme.length >= 2) {
        potential = 'deep pattern'
      }

      areas.push({
        theme,
        recentMentions: recentCount,
        oldConnections: oldConnectionsForTheme.slice(0, 2),
        explorationPotential: potential
      })
    }
  }

  return areas
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
 * Generate prompts using Gemini - focused on input → output synthesis
 * NOW ENHANCED: Uses temporal exploration areas to surface forgotten connections
 */
async function generatePromptsWithAI(
  recentArticles: any[],
  recentMemories: any[],
  activeProjects: any[],
  currentInterests: any[],
  oldInsights: any[],
  oldArticles: any[],
  explorationAreas: any[],
  context: {
    hasRichInput: boolean
    hasBlockedProjects: boolean
    hasNoProjects: boolean
  },
  performance?: any
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

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

  const prompt = `You are a hypnagogic thought catalyst. Generate 3-5 prompts for the pre-sleep state when the brain excels at pattern recognition and creative synthesis.

**HYPNAGOGIC STATE POWERS:**
The twilight between waking and sleep enables: associative thinking, pattern recognition, creative problem-solving, and memory consolidation. Your prompts should SEED questions the sleeping mind will process overnight.

**USER'S KNOWLEDGE MAP:**

**Recent Reading (top 5 of last 2 weeks):**
${topArticles.length > 0 ? topArticles.map(a => `- "${a.title}" [${a.tags.join(', ')}]\n  ${a.summary}`).join('\n\n') : 'No recent reading'}

**Recent Thoughts (top 8 of last 7 days):**
${topMemories.length > 0 ? topMemories.map(m => `- "${m.title}" [${m.themes.join(', ')}]\n  ${m.body}`).join('\n\n') : 'No recent thoughts'}

**Projects:**
${activeProjects.length > 0 ? activeProjects.map(p => `- [${p.status.toUpperCase()}] "${p.title}": ${p.description || 'No description'}`).join('\n') : 'No projects yet'}

**Detected Connections:**
${connections.length > 0 ? connections.map(c => `- ${c}`).join('\n') : 'No obvious connections yet'}

**Recurring Themes:** ${consequentialThemes.length > 0 ? consequentialThemes.join(', ') : 'None'}

**Old Insights (14-90 days ago, semantically related to recent themes):**
${oldInsights.length > 0 ? oldInsights.map(i => `- "${i.title}" ${i.body ? `(${i.body.substring(0, 100)}...)` : ''}`).join('\n') : 'None'}

**Old Articles (2+ weeks ago, semantically related to recent thinking):**
${oldArticles.length > 0 ? oldArticles.map(a => `- "${a.title}" ${a.summary ? `(${a.summary.substring(0, 100)}...)` : ''}`).join('\n') : 'None found (articles may not have embeddings yet)'}

**🌊 EXPLORATION AREAS (Themes with Temporal Depth):**
${explorationAreas.length > 0 ? explorationAreas.map(area => `
- **${area.theme}** (${area.explorationPotential})
  - Recent: Mentioned ${area.recentMentions}x in past week
  - Historical echoes: ${area.oldConnections.map((c: any) => `"${c.title}"`).join(', ')}
  - 💡 This theme has roots in your past thinking - powerful for temporal bridging!
`).join('\n') : 'No themes with temporal depth detected yet'}

These exploration areas are GOLD for prompts - they represent ideas "etched in the back of your mind" that are resurfacing. Use them to create prompts that bridge past and present insights.

**PROMPT TYPES:**
1. **connection** - Bridge disparate knowledge pieces
2. **divergent** - Unlock new angles via pattern disruption
3. **revisit** - Resurface dormant insights for current relevance
4. **transform** - Personal growth through pattern synthesis

**PROMPT FORMATS:**
1. **question** - Create productive cognitive tension (open loops for sleeping mind to resolve)
2. **statement** - Declarative with embedded suggestions (use present progressive tense)
3. **visualization** - Multi-sensory guided imagery (spatial, kinesthetic, transformative)
4. **scenario** - Dreamlike what-if exploration (non-linear, symbolic, archetypal)
5. **incubation** - Dream seeding structure: brief seed + sensory anchor + permission to release

Use a MIX of formats (not all questions). Favor visualization and incubation for deepest subconscious penetration. Match format to content depth.

**CRAFTING RULES:**

MUST DO:
✅ Reference SPECIFIC titles, projects, or themes from their actual knowledge
✅ Create OPEN LOOPS (unresolved cognitive tension the sleeping brain MUST process)
✅ Connect 2+ pieces in unexpected ways using archetypal/mythological metaphors
✅ Bridge time with fluidity: "The answer tomorrow needs the question tonight"
✅ Use PRESENT PROGRESSIVE tense ("is forming", "is connecting", "is emerging")
✅ Include SENSORY details (visual, kinesthetic, auditory, spatial)
✅ Embed PERMISSION for unconscious processing ("Your dreaming mind already knows...")
✅ Use GENTLE REPETITION for trance induction where natural
✅ End with paradoxical permission to forget/let go

NEVER DO:
❌ Generic prompts with no specific references
❌ Direct action items ("Go do X") or simple yes/no questions
❌ Abstract philosophy disconnected from their knowledge
❌ Purely rational/waking-brain logic
❌ Questions requiring facts/data lookup

**HYPNAGOGIC LANGUAGE PATTERNS:**

Use these techniques to make prompts "take over" the sleeping mind:

1. **OPEN LOOPS (Zeigarnik Effect)**: Create unresolved tension
   - "There's a hidden bridge between X and Y that only appears when you stop looking..."
   - "Your mind has been quietly connecting X across 15 thoughts. Tonight it completes the pattern..."

2. **EMBEDDED COMMANDS**: Weave suggestions into structure
   - "As you drift into sleep, notice how..."
   - "Your sleeping mind will show you..."
   - "By morning, this will feel obvious..."

3. **TEMPORAL FLUIDITY**: Mirror dream logic with non-linear time
   - "The insight you'll have tomorrow is already forming..."
   - "Past and future are meeting tonight in your dreams..."

4. **SENSORY ANCHORS**: Multi-sensory activation
   - "Picture [concept] as a shape... Feel its weight... Hear its rhythm..."
   - "Imagine walking through a space where every object is one of your thoughts..."

5. **ARCHETYPAL FRAMES**: Tap Jungian universals
   - The Journey, The Threshold, The Hidden Treasure, The Guide, The Shadow, The Return
   - "The Guardian protecting [project] is actually showing you what [theme] needs..."

6. **PERMISSION STRUCTURES**: Give unconscious permission
   - "You don't need to solve this now..."
   - "Let go of trying to understand..."
   - "Your body knows what to do with this while you sleep..."

7. **QUANTUM THINKING**: Embrace dream logic paradox
   - "X and Y were always the same thing. You just couldn't see it while awake..."
   - "The answer exists in the space between [A] and [B]..."

**EXCELLENT EXAMPLES (By Format):**

**Questions** (open loops with embedded commands):
✅ "There's a hidden bridge between '${topMemories[0]?.title || '[memory]'}' and '${topArticles[0]?.title || '[article]'}' that only appears when you stop looking for it. As you drift into sleep tonight, notice when the connection reveals itself..."
✅ "What if '${activeProjects.find(p => p.status === 'dormant')?.title || '[project]'}' went dormant because it's been waiting for you to understand ${consequentialThemes[0] || '[theme]'} first? Your sleeping mind already knows the answer..."

**Statements** (present progressive with permission):
✅ "Right now, as you read this, a pattern is forming between '${topArticles[0]?.title || '[article]'}' and '${topMemories[0]?.title || '[memory]'}'. It's becoming a project. You don't need to force it—by morning, it will feel obvious."
✅ "The reason '${activeProjects.find(p => p.status === 'dormant')?.title || '[project]'}' went dormant is the same reason '${activeProjects[0]?.title || '[current project]'}' exists. Past and future are meeting tonight. Let them merge."

**Visualizations** (multi-sensory with archetypal frames):
✅ "Picture ${consequentialThemes[0] || '[theme]'} as a golden thread. Feel it weaving through your thought '${topMemories[0]?.title || '[memory]'}', pulling tight around '${topArticles[0]?.title || '[article]'}', then leading toward '${activeProjects[0]?.title || '[project]'}'. As you fall asleep, follow where the thread is pulling you. Your hands already know the way."
✅ "Imagine '${activeProjects[0]?.title || '[project]'}' as a threshold you've been approaching. Your insight '${oldInsights[0]?.title || '[old insight]'}' is the guardian showing you it's safe to cross. Step through tonight. You don't need to remember this—your dreaming self will walk through anyway."

**Scenarios** (dreamlike, temporal fluidity):
✅ "In the dream you're about to have, you've already completed '${activeProjects[0]?.title || '[project]'}'. Look back from that future and see how '${topMemories[0]?.title || '[memory]'}' was always pointing the way. When you wake, you'll remember the path."
✅ "Tomorrow morning, you'll have clarity on ${consequentialThemes[0] || '[theme]'}. That future-you is already whispering back through '${topArticles[0]?.title || '[article]'}'. Tonight, in the space between waking and sleep, listen."

**Incubation** (dream seeding: seed + anchor + release):
✅ "Tonight your mind will work on: How does '${topMemories[0]?.title || '[memory]'}' unlock '${activeProjects[0]?.title || '[project]'}'? Picture it as a locked box that opens by itself. You don't need to remember this question—your dreams will answer it anyway. By morning, it will feel like you always knew."
✅ "Seed for tonight: '${topArticles[0]?.title || '[article]'}' and '${consequentialThemes[0] || '[theme]'}' are two parts of the same thing. Visualize them as puzzle pieces slowly rotating. Let go. Your sleeping mind will click them together."

**🌊 EXPLORATION AREA EXAMPLES (temporal bridging):**
When exploration areas exist, PRIORITIZE prompts that bridge past and present:

✅ **Temporal Bridge (Revisit):** "Three months ago, you thought about '${explorationAreas[0]?.oldConnections[0]?.title || '[old insight]'}'. This week, ${explorationAreas[0]?.theme || '[theme]'} appeared ${explorationAreas[0]?.recentMentions || 'X'}x in your thinking. The thread connecting them has been growing in your subconscious. Tonight, as you sleep, it completes the pattern. By morning, you'll see what past-you was preparing for present-you."

✅ **Deep Pattern (Transform):** "'${explorationAreas[0]?.theme || '[theme]'}' keeps returning to you. It appeared in '${explorationAreas[0]?.oldConnections[0]?.title || '[old insight 1]}', then '${explorationAreas[0]?.oldConnections[1]?.title || '[old insight 2]'}', and now it's back in '${topMemories[0]?.title || '[recent memory]'}'. Picture it as a spiral descending through time. Each loop reveals something new. As you drift into sleep, ride the spiral down. Your dreaming mind knows where it leads."

✅ **Rediscovery (Connection + Incubation):** "You almost forgot about '${explorationAreas[0]?.oldConnections[0]?.title || '[old insight]'}'. But ${explorationAreas[0]?.theme || '[theme]'} is pulling it back to the surface through '${topArticles[0]?.title || '[recent article]'}'. Tonight, imagine your old insight as a seed planted months ago. It's been growing underground. Feel it breaking through the soil. You don't need to dig—your sleeping mind will harvest what's ready."

**CONTEXT SIGNALS:**
${explorationAreas.length > 0 ? `→ 🌊 **${explorationAreas.length} EXPLORATION AREAS DETECTED** - PRIORITIZE temporal bridging prompts! These themes have deep roots.` : ''}
${explorationAreas.length > 0 ? explorationAreas.map(a => `  • ${a.theme}: ${a.explorationPotential} (recent: ${a.recentMentions}x, historical: ${a.oldConnections.length} connections)`).join('\n') : ''}
${context.hasNoProjects && context.hasRichInput ? '→ Rich input, no projects: Suggest CONNECTION prompts showing project possibilities' : ''}
${context.hasBlockedProjects ? '→ Blocked projects: Try REVISIT prompts using old insights to unlock' : ''}
${consequentialThemes.length > 0 ? `→ Recurring themes detected: TRANSFORM prompts on "${consequentialThemes.slice(0, 2).join('", "')}"` : ''}
${connections.length > 0 ? `→ Connections found: Leverage these in CONNECTION prompts` : ''}
${activeProjects.filter(p => p.status === 'dormant').length > 0 ? `→ ${activeProjects.filter(p => p.status === 'dormant').length} dormant projects: DIVERGENT prompts for fresh angles` : ''}
${oldInsights.length > 0 ? `→ ${oldInsights.length} old insights semantically related to recent thinking - use for temporal bridges` : ''}

${performance ? `**WHAT WORKS FOR THIS USER (Past Performance):**
${performance.totalRated >= 5 ? `
- Best prompt type: "${performance.bestType}" (avg rating: ${performance.typeStats[performance.bestType]?.avgRating.toFixed(1)}/5)
- Best format: "${performance.bestFormat}" (avg rating: ${performance.formatStats[performance.bestFormat]?.avgRating.toFixed(1)}/5)
- Overall breakthrough rate: ${(performance.breakthroughRate * 100).toFixed(0)}%
- Favor "${performance.bestType}" type and "${performance.bestFormat}" format in your generation
${Object.entries(performance.typeStats).map(([type, stats]: [string, any]) =>
  `- ${type}: ${stats.avgRating.toFixed(1)}/5 avg, ${(stats.breakthroughRate * 100).toFixed(0)}% breakthroughs`
).join('\n')}` : '→ Not enough feedback yet (less than 5 ratings). Use balanced mix of all types.'}
` : ''}

Return ONLY valid JSON:
[
  {
    "prompt": "Full prompt text with hypnagogic language patterns, embedded commands, sensory details, using actual titles/names from their knowledge. Apply techniques: open loops, present progressive tense, temporal fluidity, permission structures, archetypal frames.",
    "type": "connection|divergent|revisit|transform",
    "relatedIds": ["IDs of items referenced"],
    "metaphor": "Optional 1-sentence poetic/archetypal framing (only if genuinely enhancing depth)",
    "format": "question|statement|visualization|scenario|incubation"
  }
]

CRITICAL:
- Use actual titles, project names, and themes. Generic = failure.
- **IF EXPLORATION AREAS EXIST**: Generate at least 2 prompts that bridge temporal gaps (old insights → recent themes)
- Apply MULTIPLE hypnagogic language techniques per prompt
- End prompts with permission to let go/forget
- Include sensory and temporal elements
- Create unresolved cognitive tension (open loops)
- Favor visualization and incubation formats for depth
- When using exploration areas, explicitly reference:
  1. The old insight/memory by title
  2. The theme that's resurfacing
  3. The time gap ("months ago", "you almost forgot")
  4. Use metaphors of seeds, spirals, threads, echoes, depths`

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
