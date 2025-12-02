/**
 * Bedtime Idea Suggester
 * Bridges collected material (reading, thoughts) → creative projects
 * Leverages hypnagogic state to synthesize inputs into actionable outputs
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'

const supabase = getSupabaseClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
 * Generate Catalyst prompts from 2-3 specific inputs
 */
export async function generateCatalystPrompts(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string }>, 
  userId: string
): Promise<BedtimePrompt[]> {
  console.log(`[Bedtime] Generating catalyst prompts for user ${userId} with ${inputs.length} inputs`)
  return generateCatalystPromptsWithAI(inputs, userId)
}

export async function generateBedtimePrompts(userId: string): Promise<BedtimePrompt[]> {
  console.log(`[Bedtime] Generating bedtime prompts for user ${userId}`)

  // 1. Gather the full spectrum: Input → Processing → Output
  const recentArticles = await getRecentArticles(userId, 14) // Last 2 weeks of reading
  const recentMemories = await getRecentMemories(userId, 7) // Last week of thoughts
  const activeProjects = await getActiveProjects(userId) // Current outputs
  const currentInterests = await getCurrentInterests(userId)
  const oldInsights = await getOldInsights(userId, 90) // 14-90 days old

  // 2. Get past prompt performance for personalization
  const performance = await getPromptPerformance(userId)

  // 3. Analyze gaps
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
      const allMemories = [...recentData, ...relatedData]
      const unique = Array.from(
        new Map(allMemories.map(m => [m.id, m])).values()
      )
      return unique.slice(0, 15)
    }
  }

  return recentData
}

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

async function getCurrentInterests(userId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('entities')
    .select('name, type, memory_id')
    .eq('type', 'topic')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (!data) return []

  const counts = data.reduce((acc: Record<string, number>, e: any) => {
    acc[e.name] = (acc[e.name] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([name, count]) => ({ name, mentions: count }))
}

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

function detectConnections(
  articles: any[],
  memories: any[],
  projects: any[]
): string[] {
  const connections: string[] = []

  const articleTags = new Set(articles.flatMap(a => a.tags || []))
  const memoryThemes = new Set(memories.flatMap(m => m.themes || []))
  const memoryEntities = new Set(
    memories.flatMap(m => (m.entities || []).map((e: any) => e.name))
  )

  const themeOverlaps = [...articleTags].filter(tag =>
    memoryThemes.has(tag as string) || memoryEntities.has(tag as string)
  )

  if (themeOverlaps.length > 0) {
    connections.push(
      `Cross-pollination: "${themeOverlaps.slice(0, 3).join('", "')}" appears in both your reading and your thoughts`
    )
  }

  const dormantProjects = projects.filter(p => p.status === 'dormant')
  for (const project of dormantProjects) {
    const projectKeywords = (project.title + ' ' + (project.description || ''))
      .toLowerCase()
      .split(/\s+/) // Corrected escape for regex
    const hasThemeMatch = [...memoryThemes].some(theme =>
      projectKeywords.some(word => word.includes((theme as string).toLowerCase()))
    )
    if (hasThemeMatch) {
      connections.push(
        `Dormant project "${project.title}" relates to your recent thinking`
      )
    }
  }

  return connections.slice(0, 3)
}

async function generateCatalystPromptsWithAI(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string } >,
  userId: string
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  if (!inputs || inputs.length === 0) {
    throw new Error('At least one input required')
  }

  const inputsList = inputs
    .map(input => `${input.type.toUpperCase()}: "${input.title}"`) // Corrected escape for quote
    .join('\n') // Corrected escape for newline

  const prompt = `You are an insight engineer. Generate 2-4 prompts that trigger genuine realizations from these specific inputs.

**INPUTS:**
${inputsList}

**YOUR JOB:** Find the non-obvious insight hiding in the intersection of these items. Not
`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/[[\]][\s\S]*[[\]]/)
  if (!jsonMatch) {
    console.error('[Bedtime] Failed to parse catalyst prompts JSON:', text)
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
      const motivation = p.metadata?.motivation ? `\n  MOTIVATION (The \"Why\"): ${p.metadata.motivation}` : '';
      return `- [${p.status.toUpperCase()}] \"${p.title}\": ${p.description || 'No description'}${motivation}`;
    }).join('\n')