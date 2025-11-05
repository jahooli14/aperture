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
 */
async function getRecentMemories(userId: string, days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data } = await supabase
    .from('memories')
    .select('id, title, body, entities, themes, tags, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  return data || []
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
 * Generate prompts using Gemini with trippy, memorable style
 */
async function generatePromptsWithAI(
  recentMemories: any[],
  activeProjects: any[],
  currentInterests: any[],
  oldInsights: any[]
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  const prompt = `You are a creative prompt generator for bedtime ideation. Generate 3-5 trippy, memorable prompts to ponder while falling asleep.

**Context:**
Recent thoughts (last 7 days):
${recentMemories.map(m => `- "${m.title}": ${m.body?.substring(0, 200)}`).join('\n')}

Active projects:
${activeProjects.map(p => `- "${p.title}": ${p.description}`).join('\n')}

Current interests: ${currentInterests.map(i => i.name).join(', ')}

Old insights (forgotten wisdom):
${oldInsights.map(i => `- "${i.title}": ${i.body?.substring(0, 100)}`).join('\n')}

**Goal:** Generate prompts that:
1. Make unexpected connections between projects/thoughts/interests
2. Use vivid metaphors and surreal imagery (dreams, transformations, impossible scenarios)
3. Are MEMORABLE - stick in the mind as you drift off
4. Access the creative subconscious - not logical problem-solving
5. Open-ended - not "solve X" but "what if X became Y?"

**Styles to mix:**
- 🌊 Poetic: "Your dashboard is a garden..."
- 🔮 Surreal: "Imagine types as musical notes..."
- 💭 Dream logic: "In a dream, frustration is a locked door..."
- 🎨 Visual metaphor: "Picture projects as planets orbiting..."
- 🧬 Transformation: "What if [concept] was made of water/light/sound?"

**IMPORTANT:**
- Don't give solutions - give **seeds to ponder**
- Be weird and memorable
- Each prompt should feel like a mini zen koan
- Reference specific things from their context
- Make them want to think about it as they fall asleep

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
