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
  type: 'synthesis' | 'activation' | 'connection' | 'blocker'
  relatedIds: string[] // Memory/project/article IDs that inspired this
  actionHint?: string // What output could emerge from this prompt
  metaphor?: string
}

/**
 * Prompt types optimized for input → output flow:
 * - synthesis: "You've been reading about X and thinking about Y. What could you build?"
 * - activation: "You have these ingredients sitting unused. What emerges if you combine them?"
 * - connection: "These disparate inputs share a hidden thread. What does it unlock?"
 * - blocker: "This project is stuck. What input are you missing?"
 */

/**
 * Generate bedtime prompts for a user
 * Called at 9:30pm or on-demand
 * Focus: Bridge collected inputs (reading, thoughts) → creative outputs (projects)
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
 * Get active projects
 */
async function getActiveProjects(userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id, title, description, type, metadata')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_active', { ascending: false })
    .limit(5)

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

  const prompt = `You are a creative synthesis agent helping someone transform collected material into creative projects.

**THE SUNDIAL PHILOSOPHY:**
This app follows a flow: Reading/Input → Thoughts/Processing → Projects/Output
Your job: Generate bedtime prompts that help move material from LEFT (inputs) to RIGHT (outputs).

**USER'S CURRENT STATE:**
- Has rich input material: ${context.hasRichInput ? 'YES - plenty of reading/thoughts to work with' : 'NO - needs more input first'}
- Has blocked projects: ${context.hasBlockedProjects ? 'YES - needs unsticking' : 'NO'}
- Has active projects: ${context.hasNoProjects ? 'NO - pure consumption mode' : 'YES - building things'}

**INPUTS (Reading - last 2 weeks):**
${recentArticles.length > 0 ? recentArticles.map(a => `- "${a.title}": ${a.summary?.substring(0, 150) || 'no summary'}`).join('\n') : 'No recent reading'}

**PROCESSING (Thoughts - last 7 days):**
${recentMemories.length > 0 ? recentMemories.map(m => `- "${m.title}": ${m.body?.substring(0, 150)}`).join('\n') : 'No recent thoughts'}

**OUTPUTS (Active Projects):**
${activeProjects.length > 0 ? activeProjects.map(p => `- "${p.title}": ${p.description}`).join('\n') : 'No active projects yet'}

**Recurring Themes:**
${consequentialThemes.length > 0 ? consequentialThemes.join(', ') : 'No clear recurring themes yet'}

**Current interests:** ${currentInterests.map(i => i.name).join(', ') || 'None identified'}

**Old insights:**
${oldInsights.length > 0 ? oldInsights.map(i => `- "${i.title}"`).join('\n') : 'None'}

**YOUR MISSION:**
Generate 3-5 prompts that help synthesize INPUTS → OUTPUTS. Choose prompt types based on their state:

**Prompt Types:**
1. **synthesis** - They have rich input but no output → "You've been reading/thinking about X. What could you build with this?"
2. **activation** - They have dormant material → "These pieces are sitting unused. What emerges if you activate them?"
3. **connection** - Multiple inputs, no bridge → "These inputs share a thread. What project does it suggest?"
4. **blocker** - Stuck project → "This project needs an input you haven't found yet. What is it?"

**Prompt Crafting Principles:**
- **Bridge the gap**: Always connect specific inputs (articles, thoughts) to potential outputs (projects)
- **Be concrete**: Reference actual material they've collected, but only if it suggests an actionable output
- **Ask synthesis questions**: "What could you build?" "What project emerges?" "What's the output here?"
- **Avoid pure contemplation**: Not "What does this mean?" but "What does this enable you to CREATE?"
- **One thread, actionable end**: Each prompt should point toward something they could actually make

**Context-Aware Strategies:**
${context.hasNoProjects && context.hasRichInput ? '→ SYNTHESIS prompts: They\'re consuming without creating. Push them to build something.' : ''}
${context.hasBlockedProjects ? '→ BLOCKER prompts: Help unstick their projects by identifying missing inputs.' : ''}
${!context.hasRichInput ? '→ Skip this - they need to read/think more before synthesizing.' : ''}

**Good Examples:**
✅ "You've saved 5 articles about habit formation and written 3 thoughts about motivation. What simple app could you build to test these ideas on yourself?"
✅ "Your reading about design systems and your thoughts about accessibility keep circling each other. What component library wants to exist here?"
✅ "That project about X is stuck because you're missing Y insight. Which article in your queue might have it?"

**Bad Examples (avoid these):**
❌ "What does productivity mean to you?" (pure navel-gazing, no output)
❌ "Imagine your React components as a symphony..." (forced metaphor, no actionable synthesis)
❌ "Reflect on your journey..." (self-help fluff, doesn't create anything)

Return ONLY valid JSON (no markdown):
[
  {
    "prompt": "Synthesis-oriented prompt connecting inputs to potential outputs...",
    "type": "synthesis|activation|connection|blocker",
    "relatedIds": ["article_id", "memory_id", "project_id"],
    "actionHint": "What specific project/output this might lead to (1 sentence)"
  },
  ...
]

**Remember:** Every prompt should move them from consuming → creating. The prompt should feel like it's unlocking a project idea, not just philosophical musing.`

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
        action_hint: p.actionHint, // What project/output this could lead to
        metaphor: p.metaphor,
        created_at: new Date().toISOString()
      }))
    )

  if (error) {
    logger.error({ error }, 'Failed to store bedtime prompts')
  }
}
