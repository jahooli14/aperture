/**
 * Synthesis Engine
 * Generates novel project suggestions by combining capabilities + interests
 * Implements point allocation, diversity injection, and suggestion storage
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseConfig, getGeminiConfig } from './env.js'
import { logger } from './logger.js'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

// Synthesis configuration
const CONFIG = {
  SUGGESTIONS_PER_RUN: 10,
  WILDCARD_FREQUENCY: 4, // Every 4th suggestion is a wildcard
  NOVELTY_WEIGHT: 0.3,
  FEASIBILITY_WEIGHT: 0.4,
  INTEREST_WEIGHT: 0.3,
  MIN_INTEREST_MENTIONS: 3, // Entity mentioned this many times = interest
  RECENT_DAYS: 30, // Look back this far for interests
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

/**
 * Generate embedding for text using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

/**
 * Extract interests from recent MemoryOS memories
 */
async function extractInterests(): Promise<Interest[]> {
  logger.info('Extracting interests from MemoryOS')

  // Get entities that appear frequently
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, type')
    .gte('created_at', new Date(Date.now() - CONFIG.RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString())

  if (error) throw error

  // Count entity occurrences
  const entityCounts = entities.reduce((acc, entity) => {
    const key = `${entity.name}::${entity.type}`
    if (!acc[key]) {
      acc[key] = { entity, count: 0 }
    }
    acc[key].count++
    return acc
  }, {} as Record<string, { entity: any; count: number }>)

  // Filter to interests (mentioned multiple times)
  const interests: Interest[] = Object.values(entityCounts)
    .filter(({ count }) => count >= CONFIG.MIN_INTEREST_MENTIONS)
    .map(({ entity, count }) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      strength: count / 10, // Simple strength calculation
      mentions: count,
    }))
    .sort((a, b) => b.strength - a.strength)

  logger.info(
    { count: interests.length, min_mentions: CONFIG.MIN_INTEREST_MENTIONS },
    'Found interests'
  )

  if (logger.level === 'debug') {
    interests.slice(0, 5).forEach(interest => {
      logger.debug(
        { name: interest.name, mentions: interest.mentions, strength: interest.strength },
        'Interest detail'
      )
    })
  }

  // Batch update entities table with interest markers
  if (interests.length > 0) {
    // Build a batch update using upsert
    const updates = interests.map(interest => ({
      id: interest.id,
      is_interest: true,
      interest_strength: interest.strength,
      last_mentioned: new Date().toISOString()
    }))

    const { error: updateError } = await supabase
      .from('entities')
      .upsert(updates, { onConflict: 'id' })

    if (updateError) {
      logger.warn({ error: updateError }, 'Failed to batch update interest markers')
    } else {
      logger.debug({ count: interests.length }, 'Updated interest markers')
    }
  }

  return interests
}

/**
 * Get all capabilities from database
 */
async function getCapabilities(): Promise<Capability[]> {
  logger.info('Loading capabilities')

  const { data, error } = await supabase
    .from('capabilities')
    .select('id, name, description, strength, source_project')
    .order('strength', { ascending: false })

  if (error) throw error

  logger.info({ count: data.length }, 'Loaded capabilities')
  return data
}

/**
 * Calculate novelty score for capability combination
 * Higher score = more novel (never or rarely suggested before)
 * Lower score = less novel (suggested many times, especially if dismissed)
 */
async function calculateNovelty(capabilityIds: string[]): Promise<number> {
  const supabase = createSupabaseClient()

  // Sort capability IDs for consistent lookup
  const sortedIds = [...capabilityIds].sort()

  // Query capability_combinations table to check if this combo exists
  const { data: combo, error } = await supabase
    .from('capability_combinations')
    .select('times_suggested, times_rated_negative, penalty_score')
    .eq('capability_ids', sortedIds)
    .single()

  if (error || !combo) {
    // Never suggested before = maximum novelty
    return 1.0
  }

  // Calculate novelty based on:
  // 1. Times suggested (more = less novel)
  // 2. Times rated negative (dismissals reduce novelty significantly)
  // 3. Accumulated penalty score

  const baseNovelty = 1.0 / (1 + Math.log(combo.times_suggested + 1))
  const dismissalPenalty = combo.times_rated_negative * 0.2
  const accumulatedPenalty = combo.penalty_score || 0

  const noveltyScore = Math.max(0, baseNovelty - dismissalPenalty - accumulatedPenalty)

  return Math.max(0.1, noveltyScore) // Minimum 0.1 to give everything a chance
}

/**
 * Calculate feasibility score for capability combination
 */
function calculateFeasibility(capabilities: Capability[]): number {
  // Simple heuristic: average strength + bonus for same project
  const avgStrength = capabilities.reduce((sum, c) => sum + c.strength, 0) / capabilities.length
  const normalizedStrength = Math.min(avgStrength / 10, 1) // Normalize to 0-1

  // Bonus if capabilities are from the same project (easy integration)
  const projects = new Set(capabilities.map(c => c.source_project))
  const integrationBonus = projects.size === 1 ? 0.3 : 0

  // Penalty for complexity (more capabilities = more complex)
  const complexityPenalty = Math.min((capabilities.length - 2) * 0.1, 0.3)

  return Math.max(0, Math.min(1,
    (normalizedStrength * 0.5) +
    integrationBonus +
    (1 - complexityPenalty) * 0.2
  ))
}

/**
 * Calculate interest alignment score using vector similarity
 */
async function calculateInterestScore(
  projectDescription: string,
  interests: Interest[]
): Promise<number> {
  if (interests.length === 0) return 0.5 // Neutral if no interests

  const supabase = createSupabaseClient()

  // Generate embedding for project description
  const projectEmbedding = await generateEmbedding(projectDescription)

  // Find memories related to these interests (entities are extracted from memories)
  const interestNames = interests.map(i => i.name)

  const { data: relatedMemories, error } = await supabase
    .from('memories')
    .select('id, embedding')
    .not('embedding', 'is', null)
    .limit(50) // Get recent memories for similarity comparison

  if (error || !relatedMemories || relatedMemories.length === 0) {
    // Fallback to simple name matching
    const descLower = projectDescription.toLowerCase()
    let maxScore = 0
    for (const interest of interests) {
      if (descLower.includes(interest.name.toLowerCase())) {
        maxScore = Math.max(maxScore, interest.strength / 10)
      }
    }
    return Math.min(maxScore, 1)
  }

  // Calculate cosine similarity with all memory embeddings
  let maxSimilarity = 0
  for (const memory of relatedMemories) {
    const similarity = cosineSimilarity(projectEmbedding, memory.embedding)
    maxSimilarity = Math.max(maxSimilarity, similarity)
  }

  // Boost score based on interest strength
  const avgInterestStrength = interests.reduce((sum, i) => sum + i.strength, 0) / interests.length
  const strengthBoost = Math.min(avgInterestStrength / 10, 0.3)

  return Math.min(maxSimilarity + strengthBoost, 1)
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (normA * normB)
}

/**
 * Find memories that inspired a project idea using vector similarity
 */
async function findInspiringMemories(projectDescription: string): Promise<string[]> {
  const supabase = createSupabaseClient()

  // Generate embedding for project description
  const projectEmbedding = await generateEmbedding(projectDescription)

  // Query memories with embeddings
  const { data: memories, error } = await supabase
    .from('memories')
    .select('id, embedding, transcript')
    .not('embedding', 'is', null)
    .limit(100) // Check recent memories

  if (error || !memories || memories.length === 0) {
    return []
  }

  // Calculate similarity scores and get top 3
  const memoriesWithScores = memories
    .map(memory => ({
      id: memory.id,
      similarity: cosineSimilarity(projectEmbedding, memory.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3) // Top 3 most similar memories
    .filter(m => m.similarity > 0.3) // Only include if reasonably similar

  return memoriesWithScores.map(m => m.id)
}

/**
 * Generate creative (non-technical) project idea from interests only
 * Interest × Interest mode for pure creative pursuits
 */
async function generateCreativeProject(
  interests: Interest[]
): Promise<{ title: string; description: string; reasoning: string }> {
  const interestList = interests.slice(0, 5).map(i => `- ${i.name} (${i.type}, ${i.mentions} mentions)`).join('\n')

  const prompt = `You are a creative synthesis engine that generates novel creative project ideas.

Given these user interests (from voice notes):
${interestList}

Generate ONE creative project idea that combines these interests in a unique way.

IMPORTANT: This should be a CREATIVE project (art, writing, music, crafts, etc.), NOT a technical/coding project.

Examples of creative projects:
- "Paint an abstract art collection on the theme of communism"
- "Write a series of short stories exploring memory and identity"
- "Create a photo essay documenting local architecture"
- "Compose ambient music inspired by nature sounds"

Requirements:
- NO coding, NO technical implementation
- Should feel energizing and inspiring, not like work
- Should combine 2-3 interests in a novel way
- Title should be catchy and clear
- Description should be 2-3 sentences, focusing on WHY this is interesting
- Reasoning should explain why these interests work together

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "...",
  "description": "...",
  "reasoning": "..."
}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 1.0, // Higher temp for more creative ideas
      maxOutputTokens: 1024,
    }
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')

  return JSON.parse(jsonMatch[0])
}

/**
 * Generate project idea using Gemini (Tech × Tech or Tech × Interest)
 */
async function generateProjectIdea(
  capabilities: Capability[],
  interests: Interest[]
): Promise<{ title: string; description: string; reasoning: string }> {
  const capabilityList = capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n')
  const interestList = interests.slice(0, 5).map(i => `- ${i.name} (${i.type}, ${i.mentions} mentions)`).join('\n')

  const prompt = `You are a creative synthesis engine that generates novel project ideas.

Given these technical capabilities:
${capabilityList}

And these user interests (from MemoryOS):
${interestList}

Generate ONE novel project idea that combines these capabilities in a unique way, aligned with the user's interests.

Requirements:
- Must use ALL listed capabilities
- Should feel energizing, not like work
- Title should be catchy and clear
- Description should be 2-3 sentences, focusing on WHY this is interesting
- Reasoning should explain the Venn diagram overlap (why this combination is special)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "...",
  "description": "...",
  "reasoning": "..."
}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
    }
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Extract JSON from response (handles markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')

  return JSON.parse(jsonMatch[0])
}

/**
 * Generate wildcard suggestion (anti-echo-chamber)
 */
async function generateWildcard(
  capabilities: Capability[],
  interests: Interest[],
  iteration: number
): Promise<ProjectIdea> {
  logger.info('Generating wildcard suggestion')

  // Rotate through strategies
  const strategies = ['unpopular', 'novel-combo', 'inverted', 'random']
  const strategy = strategies[iteration % strategies.length]

  let selectedCapabilities: Capability[]

  switch (strategy) {
    case 'unpopular':
      // Use least-used capabilities
      selectedCapabilities = capabilities
        .sort((a, b) => a.strength - b.strength)
        .slice(0, 2)
      break

    case 'novel-combo':
      // Find capability pair never suggested together
      // For MVP, just pick random weak capabilities
      selectedCapabilities = capabilities
        .filter(c => c.strength < 3)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
      break

    case 'inverted':
      // High novelty, low interest alignment
      selectedCapabilities = capabilities
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
      break

    case 'random':
    default:
      // Pure randomness
      selectedCapabilities = capabilities
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
  }

  // Generate idea
  const idea = await generateProjectIdea(selectedCapabilities, interests)

  // Calculate scores (will be lower than normal suggestions)
  const noveltyScore = await calculateNovelty(selectedCapabilities.map(c => c.id))
  const feasibilityScore = calculateFeasibility(selectedCapabilities)
  const interestScore = await calculateInterestScore(idea.description, interests)

  const totalPoints = Math.round(
    (noveltyScore * CONFIG.NOVELTY_WEIGHT +
      feasibilityScore * CONFIG.FEASIBILITY_WEIGHT +
      interestScore * CONFIG.INTEREST_WEIGHT) * 100
  )

  // Find memories that inspired this suggestion
  const memoryIds = await findInspiringMemories(idea.description)

  return {
    title: idea.title,
    description: idea.description,
    reasoning: idea.reasoning,
    capabilityIds: selectedCapabilities.map(c => c.id),
    memoryIds,
    noveltyScore,
    feasibilityScore,
    interestScore,
    totalPoints,
    isWildcard: true,
  }
}

/**
 * Generate creative suggestion (Interest × Interest, no tech)
 */
async function generateCreativeSuggestion(
  interests: Interest[]
): Promise<ProjectIdea> {
  logger.info('Generating creative (non-tech) suggestion')

  if (interests.length < 2) {
    throw new Error('Need at least 2 interests for creative suggestions')
  }

  // Generate pure creative idea
  const idea = await generateCreativeProject(interests)

  // Score differently for creative projects
  const noveltyScore = 0.8 // Creative combos are inherently novel
  const feasibilityScore = 0.9 // No code = highly feasible
  const interestScore = 1.0 // Directly from interests = perfect alignment

  const totalPoints = Math.round(
    (noveltyScore * CONFIG.NOVELTY_WEIGHT +
      feasibilityScore * CONFIG.FEASIBILITY_WEIGHT +
      interestScore * CONFIG.INTEREST_WEIGHT) * 100
  )

  // Find memories that inspired this creative suggestion
  const memoryIds = await findInspiringMemories(idea.description)

  return {
    title: idea.title,
    description: idea.description,
    reasoning: idea.reasoning,
    capabilityIds: [], // No capabilities for creative projects
    memoryIds,
    noveltyScore,
    feasibilityScore,
    interestScore,
    totalPoints,
    isWildcard: false,
  }
}

/**
 * Generate normal suggestion (Tech × Tech or Tech × Interest)
 */
async function generateSuggestion(
  capabilities: Capability[],
  interests: Interest[]
): Promise<ProjectIdea> {
  // Pick 2-3 capabilities, weighted by strength
  const numCapabilities = Math.random() > 0.5 ? 2 : 3

  // Weighted random selection (stronger capabilities more likely)
  const selectedCapabilities: Capability[] = []
  const weightedCaps = capabilities.flatMap(c =>
    Array(Math.max(1, Math.floor(c.strength))).fill(c)
  )

  for (let i = 0; i < numCapabilities; i++) {
    const randomCap = weightedCaps[Math.floor(Math.random() * weightedCaps.length)]
    if (!selectedCapabilities.find(c => c.id === randomCap.id)) {
      selectedCapabilities.push(randomCap)
    }
  }

  // Ensure we have enough
  while (selectedCapabilities.length < numCapabilities && selectedCapabilities.length < capabilities.length) {
    const remaining = capabilities.filter(c =>
      !selectedCapabilities.find(s => s.id === c.id)
    )
    if (remaining.length === 0) break
    selectedCapabilities.push(remaining[Math.floor(Math.random() * remaining.length)])
  }

  // Generate idea
  const idea = await generateProjectIdea(selectedCapabilities, interests)

  // Calculate scores
  const noveltyScore = await calculateNovelty(selectedCapabilities.map(c => c.id))
  const feasibilityScore = calculateFeasibility(selectedCapabilities)
  const interestScore = await calculateInterestScore(idea.description, interests)

  const totalPoints = Math.round(
    (noveltyScore * CONFIG.NOVELTY_WEIGHT +
      feasibilityScore * CONFIG.FEASIBILITY_WEIGHT +
      interestScore * CONFIG.INTEREST_WEIGHT) * 100
  )

  // Find memories that inspired this suggestion
  const memoryIds = await findInspiringMemories(idea.description)

  return {
    title: idea.title,
    description: idea.description,
    reasoning: idea.reasoning,
    capabilityIds: selectedCapabilities.map(c => c.id),
    memoryIds,
    noveltyScore,
    feasibilityScore,
    interestScore,
    totalPoints,
    isWildcard: false,
  }
}

/**
 * Record capability combination
 */
async function recordCombination(capabilityIds: string[]) {
  const sortedIds = [...capabilityIds].sort()

  // Try to insert, if it fails due to unique constraint, that's okay
  const { error } = await supabase
    .from('capability_combinations')
    .insert({
      capability_ids: sortedIds,
      times_suggested: 1,
      last_suggested_at: new Date().toISOString(),
    })

  // If unique constraint violation, update the existing record
  if (error && error.code === '23505') {
    // Use raw SQL to update since array comparison is complex
    await supabase.rpc('increment_combination_count', {
      cap_ids: sortedIds
    })
  }
}

/**
 * Main synthesis function
 */
export async function runSynthesis(userId: string) {
  logger.info({ user_id: userId }, 'Starting weekly synthesis')

  // 1. Extract interests
  const interests = await extractInterests()

  // 2. Load capabilities
  const capabilities = await getCapabilities()

  if (capabilities.length < 2) {
    logger.error('Need at least 2 capabilities to generate suggestions')
    return
  }

  // 3. Generate suggestions
  logger.info({ count: CONFIG.SUGGESTIONS_PER_RUN }, 'Generating suggestions')

  const suggestions: ProjectIdea[] = []

  for (let i = 0; i < CONFIG.SUGGESTIONS_PER_RUN; i++) {
    // Every Nth suggestion is a wildcard
    const isWildcardSlot = (i + 1) % CONFIG.WILDCARD_FREQUENCY === 0

    // Every 3rd non-wildcard suggestion is creative (Interest × Interest)
    const isCreativeSlot = !isWildcardSlot && ((i + 1) % 3 === 0) && interests.length >= 2

    try {
      let suggestion: ProjectIdea

      if (isWildcardSlot) {
        suggestion = await generateWildcard(capabilities, interests, i)
      } else if (isCreativeSlot) {
        suggestion = await generateCreativeSuggestion(interests)
      } else {
        suggestion = await generateSuggestion(capabilities, interests)
      }

      suggestions.push(suggestion)

      logger.info(
        {
          index: i + 1,
          title: suggestion.title,
          points: suggestion.totalPoints,
          is_wildcard: suggestion.isWildcard,
          novelty: (suggestion.noveltyScore * 100).toFixed(0),
          feasibility: (suggestion.feasibilityScore * 100).toFixed(0),
          interest: (suggestion.interestScore * 100).toFixed(0)
        },
        'Generated suggestion'
      )

      // Record combination (commented out for now - array format issue)
      // await recordCombination(suggestion.capabilityIds)

    } catch (error) {
      logger.error({ index: i + 1, error }, 'Error generating suggestion')
    }
  }

  // 4. Store suggestions in database
  logger.info({ count: suggestions.length, user_id: userId }, 'Storing suggestions')

  let storedCount = 0
  for (const suggestion of suggestions) {
    const { data, error } = await supabase
      .from('project_suggestions')
      .insert({
        user_id: userId,
        title: suggestion.title,
        description: suggestion.description,
        synthesis_reasoning: suggestion.reasoning,
        novelty_score: suggestion.noveltyScore,
        feasibility_score: suggestion.feasibilityScore,
        interest_score: suggestion.interestScore,
        total_points: suggestion.totalPoints,
        capability_ids: suggestion.capabilityIds,
        memory_ids: suggestion.memoryIds,
        is_wildcard: suggestion.isWildcard,
        status: 'pending',
      })
      .select()

    if (error) {
      logger.error({ error, title: suggestion.title }, 'Error storing suggestion')
      throw new Error(`Failed to store suggestion: ${error.message}`)
    } else {
      storedCount++
      logger.debug({ stored: storedCount, total: suggestions.length, title: suggestion.title }, 'Stored suggestion')
    }
  }

  logger.info({ stored: storedCount, total: suggestions.length }, 'Synthesis complete')

  return suggestions
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const userId = process.env.USER_ID || 'default-user'

  runSynthesis(userId)
    .then(() => {
      logger.info('Weekly synthesis complete')
      process.exit(0)
    })
    .catch((error) => {
      logger.fatal({ error }, 'Synthesis failed')
      process.exit(1)
    })
}
