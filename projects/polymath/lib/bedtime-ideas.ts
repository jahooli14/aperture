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
 * Nightly Catalyst: Generate 2-3 focused prompts from specific inputs
 * Takes concrete items (projects, articles, thoughts) and creates varied-angle prompts
 * Each prompt uses a different perspective (object, problem, environment, etc.)
 * Each ends with a request for one specific sensory detail
 */
async function generateCatalystPromptsWithAI(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string }>,
  userId: string
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  // Validate we have 2-3 inputs
  if (inputs.length < 2 || inputs.length > 3) {
    throw new Error('Catalyst prompts require 2-3 inputs (project, article, or thought)')
  }

  const inputsList = inputs
    .map(
      input =>
        `${input.type.toUpperCase()}: "${input.title}"`
    )
    .join('\n')

  const prompt = `You are a master of creative incubation. Your task: Take these 2-3 specific inputs and generate 2-3 vivid, concrete prompts that approach them from DIFFERENT ANGLES.

**INPUTS:**
${inputsList}

**YOUR CONSTRAINTS:**

1. **Vary the Angles** - Each prompt uses a different perspective:
   - ANGLE 1: Something as a PHYSICAL OBJECT or DEVICE (tangible, can be held/seen/manipulated)
   - ANGLE 2: Something as a PROBLEM or CHALLENGE (stuck state, puzzle, constraint)
   - ANGLE 3 (optional): Something as an ENVIRONMENT or SPACE (a room, landscape, or atmosphere where things happen)

2. **Make It Concrete** - Turn abstract inputs into tangible scenes:
   - Use specific sensory details (color, texture, sound, weight, temperature)
   - Create a scenario or interaction that feels physically real
   - Place things in relationship to each other in space or causation
   - Avoid abstract philosophy or generic advice

3. **Keep It Brief** - 2-3 sentences per prompt (not paragraphs)

4. **End with ONE Sensory Question** - Each prompt must end with a concrete sensory question:
   - Ask about a SPECIFIC visual detail ("What color is it?", "Which fox's color is casting the shadow?")
   - Ask about a SPECIFIC tactile/kinesthetic detail ("What does it feel like to tap it?", "How much weight does it have?")
   - Ask about a SPECIFIC auditory detail ("What sound does it make?", "What's the rhythm you hear?")
   - Ask about a SPECIFIC spatial detail ("Where is it pointing?", "What's the first thing you touch?")
   - Make the question SPECIFIC to your scenario, not generic

5. **No Clichés** - Avoid:
   - ❌ Portals, whispers, shadows as metaphor
   - ❌ Identity-based prompts ("As a PM..." or "As a designer...")
   - ❌ Generic templates
   - ❌ Trying too hard to be "deep"

6. **Be Weird & Specific** - Let the connection between inputs create unexpected scenarios:
   - Don't make a generic prompt about all three items equally
   - Let one item influence how you present another
   - Create productive cognitive tension by combining them in surprising ways

**TONE:** Dreamlike but grounded. Curious but concrete. Suggestive but not mystical.

**RETURN FORMAT:**
Return ONLY valid JSON (no markdown, no explanation):
[
  {
    "prompt": "The full 2-3 sentence prompt with the sensory question at the end",
    "type": "connection|divergent|revisit|transform",
    "format": "visualization|scenario|incubation",
    "relatedIds": ["id1", "id2", "id3"]
  }
]

**CRITICAL:**
- Use the ACTUAL titles/names from the inputs (not "the project" but "'${inputs[0]?.title}'" etc.)
- End EVERY prompt with a concrete, specific sensory question
- Each prompt should feel like a mini-scene or interaction, not abstract advice
- Vary your approaches—don't use the same angle twice`

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

**Old Insights (14-90 days ago):**
${oldInsights.length > 0 ? oldInsights.map(i => `- "${i.title}"`).join('\n') : 'None'}

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

**CONTEXT SIGNALS:**
${context.hasNoProjects && context.hasRichInput ? '→ Rich input, no projects: Suggest CONNECTION prompts showing project possibilities' : ''}
${context.hasBlockedProjects ? '→ Blocked projects: Try REVISIT prompts using old insights to unlock' : ''}
${consequentialThemes.length > 0 ? `→ Recurring themes detected: TRANSFORM prompts on "${consequentialThemes.slice(0, 2).join('", "')}"` : ''}
${connections.length > 0 ? `→ Connections found: Leverage these in CONNECTION prompts` : ''}
${activeProjects.filter(p => p.status === 'dormant').length > 0 ? `→ ${activeProjects.filter(p => p.status === 'dormant').length} dormant projects: DIVERGENT prompts for fresh angles` : ''}

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
- Apply MULTIPLE hypnagogic language techniques per prompt
- End prompts with permission to let go/forget
- Include sensory and temporal elements
- Create unresolved cognitive tension (open loops)
- Favor visualization and incubation formats for depth`

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
