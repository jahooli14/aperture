/**
 * Optimized Synthesis Engine
 * Parallelizes data loading, batches idea generation, and minimizes embedding calls.
 */

declare var process: any;

import { getSupabaseClient } from './supabase.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { COST_OPTS } from './optimization-config.js'
import { batchGenerateEmbeddings, cosineSimilarity } from './gemini-embeddings.js'
import { MODELS } from './models.js'

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
  MIN_INTEREST_MENTIONS: 2,
  RECENT_DAYS: 30,
}

interface Capability {
  id: string
  name: string
  description: string
  strength: number
  source_project: string
}

interface Interest {
  id: string
  name: string
  type: string
  strength: number
  mentions: number
}

interface ProjectIdea {
  title: string
  description: string
  reasoning: string
  capabilityIds: string[]
  memoryIds: string[]
  noveltyScore: number
  feasibilityScore: number
  interestScore: number
  totalPoints: number
  isWildcard: boolean
}

async function loadSynthesisContext(userId: string) {
  logger.info({ userId }, 'Loading synthesis context in parallel')
  
  const [memoryInterests, articleInterests, capabilities] = await Promise.all([
    extractInterestsFromMemories(userId),
    extractInterestsFromArticles(userId),
    getCapabilities(userId)
  ])

  const interestMap = new Map<string, Interest>()
  const allInterests = [...memoryInterests, ...articleInterests]

  allInterests.forEach(interest => {
    const key = interest.name.toLowerCase()
    if (interestMap.has(key)) {
      const existing = interestMap.get(key)!
      interestMap.set(key, {
        ...existing,
        strength: Math.max(existing.strength, interest.strength),
        mentions: existing.mentions + interest.mentions
      })
    } else {
      interestMap.set(key, interest)
    }
  })

  return {
    interests: Array.from(interestMap.values()).sort((a, b) => b.strength - a.strength),
    capabilities
  }
}

async function extractInterestsFromMemories(userId: string): Promise<Interest[]> {
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, type')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - CONFIG.RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString())

  if (error) return []

  const entityCounts = (entities || []).reduce((acc, entity) => {
    const key = `${entity.name}::${entity.type}`
    if (!acc[key]) acc[key] = { entity, count: 0 }
    acc[key].count++
    return acc
  }, {} as Record<string, { entity: any; count: number }>)

  return Object.values(entityCounts)
    .filter(({ count }) => count >= CONFIG.MIN_INTEREST_MENTIONS)
    .map(({ entity, count }) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      strength: count / 10,
      mentions: count,
    }))
}

async function extractInterestsFromArticles(userId: string): Promise<Interest[]> {
  const { data: articles, error } = await supabase
    .from('reading_queue')
    .select('entities, themes')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - CONFIG.RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString())

  if (error || !articles) return []

  const topicCounts: Record<string, number> = {}
  articles.forEach(article => {
    const topics = [...(article.entities?.topics || []), ...(article.themes || [])]
    topics.forEach((topic: string) => {
      const key = topic.toLowerCase()
      topicCounts[key] = (topicCounts[key] || 0) + 1
    })
  })

  return Object.entries(topicCounts)
    .filter(([_, count]) => count >= 2)
    .map(([name, count]) => ({
      id: `article_${name.replace(/\s+/g, '_')}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      type: 'topic',
      strength: Math.min(count / 5, 1.0),
      mentions: count
    }))
}

async function getCapabilities(userId: string): Promise<Capability[]> {
  const { data, error } = await supabase
    .from('capabilities')
    .select('id, name, description, strength, source_project')
    .order('strength', { ascending: false })

  if (error) throw error
  return data || []
}

async function generateSuggestionsBatch(
  capabilities: Capability[],
  interests: Interest[],
  count: number,
  previousSuggestions: string[] = []
): Promise<any[]> {
  const capabilityList = capabilities.slice(0, 15).map(c => `- ${c.name}: ${c.description}`).join('\n')
  const interestList = interests.slice(0, 15).map(i => `- ${i.name} (${i.type})`).join('\n')

  // Include previous suggestions to avoid repetition
  const avoidSection = previousSuggestions.length > 0
    ? `\nAVOID THESE (already suggested before):\n${previousSuggestions.map(s => `- ${s}`).join('\n')}\n`
    : ''

  const prompt = `You are a high-speed strategic synthesis engine. Generate ${count} diverse project concepts that bridge the user's technical capabilities and personal interests.

CONTEXT:
Technical Capabilities:
${capabilityList}

Interests & Themes:
${interestList}
${avoidSection}
TASK:
Create ${count} COMPLETELY NEW and unique project ideas.${previousSuggestions.length > 0 ? ' Do NOT repeat or closely resemble any ideas from the AVOID list above.' : ''}
For each idea, assign 1-3 relevant capabilities from the list above.
Diversity requirements:
- 1 idea must be a "Wildcard" (high novelty, unexpected combo).
- 1 idea must be "Creative" (focus on artistic/writing output over tech).
- The rest should be high-impact practical tools.

Return ONLY a JSON array of objects:
[{
  "title": "Short punchy name",
  "description": "1-2 sentence value prop",
  "reasoning": "Why this specific combo matters",
  "capabilityIds": ["uuid1", "uuid2"],
  "isWildcard": false,
  "isCreative": false
}]`

  const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
  const result = await model.generateContent(prompt)
  const text = result.response.text()

  try {
    // Strip markdown code fences if present
    let cleanedText = text.trim()
    const markdownMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (markdownMatch) {
      cleanedText = markdownMatch[1].trim()
    }

    // Extract JSON array
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText)
  } catch (e) {
    logger.error({ text }, 'Failed to parse batch JSON')
    return []
  }
}

async function filterAndScoreSuggestions(
  ideas: any[],
  userId: string,
  interests: Interest[],
  capabilities: Capability[]
): Promise<ProjectIdea[]> {
  // Fetch more history for better deduplication, but use less strict threshold
  const { data: history } = await supabase
    .from('project_suggestions')
    .select('title, description, embedding')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const ideaTexts = ideas.map(i => `${i.title}\n${i.description}`)
  const newEmbeddings = await batchGenerateEmbeddings(ideaTexts)

  const finalSuggestions: ProjectIdea[] = []

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    const emb = newEmbeddings[i]

    // Use a more lenient threshold (0.92 instead of 0.85) to allow similar-ish but not identical ideas
    // Also check title similarity to catch near-duplicates
    const isDuplicate = (history || []).some(h => {
      // Check embedding similarity
      const embeddingSimilar = h.embedding && cosineSimilarity(emb, h.embedding) > 0.92
      // Also check title similarity (case-insensitive)
      const titleSimilar = h.title?.toLowerCase().trim() === idea.title?.toLowerCase().trim()
      return embeddingSimilar || titleSimilar
    })

    if (isDuplicate) {
      logger.info({ title: idea.title }, 'Skipping duplicate suggestion')
      continue
    }

    const noveltyScore = 0.7 + (Math.random() * 0.3)
    const feasibilityScore = idea.isCreative ? 0.9 : 0.6
    const interestScore = (history || []).length > 0 
      ? Math.max(...(history || []).map(h => h.embedding ? cosineSimilarity(emb, h.embedding) : 0)) 
      : 0.7

    const totalPoints = Math.round((noveltyScore * 0.3 + feasibilityScore * 0.4 + interestScore * 0.3) * 100)

    finalSuggestions.push({
      title: idea.title,
      description: idea.description,
      reasoning: idea.reasoning,
      capabilityIds: idea.capabilityIds || [],
      memoryIds: [],
      noveltyScore,
      feasibilityScore,
      interestScore,
      totalPoints,
      isWildcard: !!idea.isWildcard
    })
  }

  return finalSuggestions
}

export async function runSynthesis(userId: string) {
  logger.info({ userId }, 'Starting Optimized Synthesis')
  const { interests, capabilities } = await loadSynthesisContext(userId)

  if (capabilities.length === 0 && interests.length === 0) {
    logger.warn('No data for synthesis')
    return []
  }

  // Fetch recent suggestions to avoid repetition (last 50 titles)
  const { data: recentSuggestions } = await supabase
    .from('project_suggestions')
    .select('title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const previousTitles = (recentSuggestions || []).map(s => s.title)
  logger.info({ count: previousTitles.length }, 'Loaded previous suggestions to avoid')

  const rawIdeas = await generateSuggestionsBatch(capabilities, interests, CONFIG.SUGGESTIONS_PER_RUN, previousTitles)
  const suggestions = await filterAndScoreSuggestions(rawIdeas, userId, interests, capabilities)

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
        is_wildcard: s.isWildcard,
        status: 'pending'
      })))

    if (error) logger.error({ error }, 'Failed to store suggestions')
  }

  logger.info({ count: suggestions.length }, 'Synthesis Complete')
  return suggestions
}
