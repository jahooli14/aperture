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
  const oldInsights = await getOldInsights(userId, 90) // 3 months old

  // 2. Analyze gaps: Do they have inputs but no outputs? Stuck projects?
  const hasRichInput = recentArticles.length > 0 || recentMemories.length > 5
  const hasBlockedProjects = activeProjects.some(p => p.status === 'active' && !p.last_active)
  const hasNoProjects = activeProjects.length === 0

  // 3. Generate prompts optimized for input → output synthesis
  const prompts = await generatePromptsWithAI(
    recentArticles,
    recentMemories,
    activeProjects,
    currentInterests,
    oldInsights,
    { hasRichInput, hasBlockedProjects, hasNoProjects }
  )

  // 4. Store prompts for later viewing
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
    .filter(([_, count]) => count >= 2)
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
    .select('id, title, description, status, type, metadata')
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
 */
async function getOldInsights(userId: string, daysAgo: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysAgo)
  const recent = new Date()
  recent.setDate(recent.getDate() - 14) // But not from last 2 weeks

  const { data } = await supabase
    .from('memories')
    .select('id, title, body, themes')
    .eq('user_id', userId)
    .eq('memory_type', 'insight')
    .lte('created_at', cutoff.toISOString())
    .gte('created_at', recent.toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  return data || []
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
  }
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
    .filter(([_, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([theme, count]) => `${theme} (appears ${count}x)`)

  const prompt = `You are a hypnagogic thought catalyst. These prompts will be read during the pre-sleep hypnagogic state—that twilight zone between waking and sleeping where the brain excels at pattern recognition, creative association, and insight generation.

**UNDERSTANDING THE HYPNAGOGIC STATE:**
The hypnagogic state (transition to sleep) uniquely enables:
- **Associative thinking**: Brain makes unexpected connections between disparate concepts
- **Pattern recognition**: Subconscious identifies hidden patterns in accumulated knowledge
- **Creative problem-solving**: Logic relaxes, allowing novel solution pathways to emerge
- **Emotional integration**: Processing experiences and synthesizing meaning
- **Memory consolidation**: Brain reorganizes and connects new information with existing knowledge

Your prompts should SEED questions that the sleeping mind will process overnight, potentially yielding insights upon waking.

**USER'S KNOWLEDGE MAP:**

**Recent Reading (last 2 weeks):**
${recentArticles.length > 0 ? recentArticles.map(a => `- "${a.title}": ${a.summary?.substring(0, 150) || 'no summary'}`).join('\n') : 'No recent reading'}

**Recent Thoughts (last 7 days):**
${recentMemories.length > 0 ? recentMemories.map(m => `- "${m.title}": ${m.body?.substring(0, 150)}`).join('\n') : 'No recent thoughts'}

**All Projects (active, dormant, upcoming, completed):**
${activeProjects.length > 0 ? activeProjects.map(p => `- [${p.status.toUpperCase()}] "${p.title}": ${p.description || 'No description'}`).join('\n') : 'No projects yet'}

**Recurring Themes in Knowledge:**
${consequentialThemes.length > 0 ? consequentialThemes.join(', ') : 'No clear recurring themes yet'}

**Current Interests:** ${currentInterests.map(i => i.name).join(', ') || 'None identified'}

**Old Insights (90 days ago):**
${oldInsights.length > 0 ? oldInsights.map(i => `- "${i.title}"`).join('\n') : 'None'}

**YOUR MISSION:**
Generate 3-5 thought-provoking questions optimized for hypnagogic processing. Each prompt should plant a seed that the subconscious can work on overnight.

**Prompt Types (choose based on their knowledge map):**

1. **connection** - Find hidden bridges between disparate knowledge
   - "What unexpected connection exists between [X] and [Y] in your knowledge map?"
   - "How does [past insight] reframe [current project]?"

2. **divergent** - Unlock creative angles through pattern disruption
   - "If you approached [project/problem] from the opposite direction, what would you see?"
   - "What would [project] look like if the main constraint disappeared?"

3. **revisit** - Resurface dormant insights that may now be relevant
   - "Why did [old insight] matter then? What does it unlock now?"
   - "What was trying to emerge in [dormant project] that you couldn't see before?"

4. **transform** - Personal development through knowledge synthesis
   - "What pattern in your thinking keeps appearing across [themes]?"
   - "If your knowledge map could teach you one thing about yourself, what would it be?"

**CRAFTING PRINCIPLES FOR HYPNAGOGIC PROMPTS:**

✅ **Open-ended exploration**: Questions should invite subconscious wandering, not demand immediate answers
✅ **Concrete anchors**: Reference SPECIFIC items from their knowledge (articles, thoughts, projects) to give the subconscious real material to work with
✅ **Pattern recognition**: Ask questions that require connecting multiple pieces of their knowledge
✅ **Temporal bridges**: Connect past insights with current projects, or dormant ideas with fresh thinking
✅ **Personal growth**: Some prompts should foster self-understanding through their knowledge patterns
✅ **Project breakthroughs**: Seed questions that could unlock dormant/stuck/active projects
✅ **Metaphorical space**: Leave room for dream-logic associations and non-literal thinking

❌ **Avoid:**
- Direct action items ("Go do X") - hypnagogic state is for synthesis, not task lists
- Binary questions (yes/no) - limit associative thinking
- Purely abstract philosophy with no connection to their actual knowledge
- Forced metaphors or poetic language that feels artificial
- Questions that require data/facts the sleeping mind can't access

**EXAMPLES OF EXCELLENT HYPNAGOGIC PROMPTS:**

✅ "Your thoughts on [topic A] from last week and that article about [topic B] you saved—what invisible thread connects them that you haven't consciously noticed yet?"

✅ "That dormant project about [X]—what if the reason it went dormant is actually pointing you toward a deeper insight about [recurring theme in their thoughts]?"

✅ "You've been circling around [theme] in your reading and thinking for weeks. If this pattern could speak, what question is it trying to ask you?"

✅ "Three months ago you had that insight about [old insight]. Looking at your current projects, which one secretly needs that insight to unlock its next phase?"

✅ "What would change if you approached [stuck/dormant project] with the same mindset you had when writing that thought about [specific thought]?"

**CONTEXT-AWARE STRATEGIES:**
${context.hasNoProjects && context.hasRichInput ? '→ CONNECTION/DIVERGENT prompts: Rich knowledge but no projects—help them see project possibilities in their material' : ''}
${context.hasBlockedProjects ? '→ REVISIT/TRANSFORM prompts: Blocked projects may need old insights or different perspectives to unlock' : ''}
${consequentialThemes.length > 0 ? `→ TRANSFORM prompts: Recurring themes (${consequentialThemes.slice(0, 2).join(', ')}) suggest deeper patterns worth exploring` : ''}
${oldInsights.length > 0 ? '→ REVISIT prompts: Old insights may hold keys to current challenges' : ''}
${activeProjects.filter(p => p.status === 'dormant').length > 0 ? `→ DIVERGENT prompts: ${activeProjects.filter(p => p.status === 'dormant').length} dormant project(s) may need fresh angles` : ''}

Return ONLY valid JSON (no markdown):
[
  {
    "prompt": "Thought-provoking question that seeds overnight subconscious processing...",
    "type": "connection|divergent|revisit|transform",
    "relatedIds": ["specific IDs from their knowledge map that this prompt references"],
    "metaphor": "Optional: A subtle metaphor or poetic framing (1 sentence, ONLY if it genuinely enhances the prompt)"
  }
]

**CRITICAL**: Every prompt must reference SPECIFIC items from their knowledge map (use actual titles, themes, project names). Generic prompts will fail. The hypnagogic mind needs concrete anchors to work with.`

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
        created_at: new Date().toISOString()
      }))
    )

  if (error) {
    logger.error({ error }, 'Failed to store bedtime prompts')
  }
}
