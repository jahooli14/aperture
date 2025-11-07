/**
 * Bedtime Idea Suggester
 * Generates trippy, memorable prompts to ponder while falling asleep
 * Leverages hypnagogic state for creative breakthroughs
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
  relatedIds: string[] // Memory/project IDs that inspired this
  metaphor?: string
}

/**
 * Generate bedtime prompts for a user
 * Called at 9:30pm or on-demand
 */
export async function generateBedtimePrompts(userId: string): Promise<BedtimePrompt[]> {
  logger.info({ userId }, 'Generating bedtime prompts')

  // 1. Gather recent context (last 7 days)
  const recentMemories = await getRecentMemories(userId, 7)
  const activeProjects = await getActiveProjects(userId)
  const currentInterests = await getCurrentInterests(userId)
  const oldInsights = await getOldInsights(userId, 90) // 3 months old

  // 2. Generate prompts using Gemini
  const prompts = await generatePromptsWithAI(
    recentMemories,
    activeProjects,
    currentInterests,
    oldInsights
  )

  // 3. Store prompts for later viewing
  await storePrompts(userId, prompts)

  return prompts
}

/**
 * Get recent memories (last N days)
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
 * Generate prompts using Gemini with insightful, natural style
 */
async function generatePromptsWithAI(
  recentMemories: any[],
  activeProjects: any[],
  currentInterests: any[],
  oldInsights: any[]
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

  const prompt = `You are a creative prompt generator for bedtime ideation. Generate 3-5 insightful, evocative prompts to ponder while falling asleep.

**Consequential Themes (recurring patterns to explore):**
${consequentialThemes.length > 0 ? consequentialThemes.join(', ') : 'No clear recurring themes yet'}

**Context:**
Recent thoughts (last 7 days):
${recentMemories.map(m => `- "${m.title}": ${m.body?.substring(0, 200)}`).join('\n')}

Active projects:
${activeProjects.map(p => `- "${p.title}": ${p.description}`).join('\n')}

Current interests: ${currentInterests.map(i => i.name).join(', ')}

Old insights (forgotten wisdom):
${oldInsights.map(i => `- "${i.title}": ${i.body?.substring(0, 100)}`).join('\n')}

**Goal:** Generate prompts that:
1. Identify GENUINE thematic threads across their thoughts - don't force connections
2. Use evocative metaphors that feel natural, not contrived
3. Are MEMORABLE and resonate emotionally
4. Access the creative subconscious through curiosity, not instruction
5. Open-ended questions that invite wondering, not problem-solving

**Principles:**
- Look for consequential themes that appear multiple times organically
- Only reference specific content if there's a genuine insight to explore
- Prefer universal, resonant questions over forced name-dropping
- Use metaphors that illuminate patterns, not decorate
- Quality over cleverness - some prompts can be simple and profound

**Styles (use naturally):**
- 🌊 Poetic: Natural imagery that reflects real patterns
- 🔮 Philosophical: Deep questions that emerge from their work
- 💭 Contemplative: Gentle invitations to notice patterns
- 🎨 Metaphorical: Only when it genuinely clarifies a theme
- 🧬 Exploratory: "What emerges when..." not "What if you forced..."

**CRITICAL - Avoid:**
- Forced references to project names just to prove you read the context
- Overly clever wordplay that distracts from insight
- Generic self-help platitudes
- Prescriptive solutions disguised as questions
- Cramming multiple unrelated concepts into one prompt

**Do this instead:**
- Start with the CONSEQUENTIAL THEMES listed above - these are real patterns
- Find ONE genuine thread and explore it with depth
- Let prompts breathe - simple can be profound
- Reference specifics ONLY when they reveal a larger pattern
- Trust that organic connections are more powerful than forced ones
- If no strong themes emerge, create universal contemplative questions

**Example of good vs bad:**
❌ Bad: "What if your React project became a symphony and your TypeScript types were musical notes?"
✅ Good: "What patterns repeat across the things you're building? What if those patterns are trying to tell you something?"

❌ Bad: "Imagine your dashboard project as a garden where each component is a flower..."
✅ Good: "When you notice yourself organizing things, what are you really searching for?"

Return ONLY valid JSON (no markdown):
[
  {
    "prompt": "Trippy, memorable prompt here...",
    "type": "connection|divergent|revisit|transform",
    "relatedIds": ["memory_id or project_id"],
    "metaphor": "Brief description of the metaphor used"
  },
  ...
]

Types:
- connection: Links two unrelated things
- divergent: "What if the opposite were true?"
- revisit: Brings back old insight in new light
- transform: Imagines concept in different form`

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
