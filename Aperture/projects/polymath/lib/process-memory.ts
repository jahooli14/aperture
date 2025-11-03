import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import type { Memory, Entities, MemoryType, ExtractedMetadata } from '../src/types'
import { getSupabaseConfig, getGeminiConfig } from './env.js'
import { logger } from './logger.js'
import { normalizeTags } from './tag-normalizer.js'

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

/**
 * Process a memory: extract entities, generate embeddings, store results
 */
export async function processMemory(memoryId: string): Promise<void> {
  logger.info({ memory_id: memoryId }, 'Starting memory processing')

  try {
    // 1. Get the memory from database
    const { data: memory, error: fetchError } = await supabase
      .from('memories')
      .select('*')
      .eq('id', memoryId)
      .single()

    if (fetchError || !memory) {
      throw new Error(`Failed to fetch memory: ${fetchError?.message}`)
    }

    logger.info({ memory_id: memoryId, title: memory.title }, 'Processing memory')

    // 2. Extract entities and metadata using Gemini
    const metadata = await extractMetadata(memory.title, memory.body)

    // 3. Generate embedding for the memory content
    const embedding = await generateEmbedding(
      `${memory.title}\n\n${memory.body}`
    )

    // 4. Update the memory with extracted metadata
    const { error: updateError } = await supabase
      .from('memories')
      .update({
        memory_type: metadata.memory_type,
        entities: metadata.entities,
        themes: metadata.themes,
        tags: metadata.tags || [], // Use raw tags from Gemini (skip normalization bottleneck)
        emotional_tone: metadata.emotional_tone,
        embedding,
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('id', memoryId)

    if (updateError) {
      throw new Error(`Failed to update memory: ${updateError.message}`)
    }

    // 5. Store individual entities in the entities table
    await storeEntities(memoryId, metadata.entities)

    // 6. Skip connection detection for now (too slow - ~10-15s)
    // Can be added as separate background job later if needed

    logger.info({
      memory_id: memoryId,
      type: metadata.memory_type,
      entities: metadata.entities,
      themes: metadata.themes
    }, 'Successfully processed memory')

  } catch (error) {
    logger.error({ memory_id: memoryId, error }, 'Error processing memory')

    // Store error in database
    await supabase
      .from('memories')
      .update({
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', memoryId)

    throw error
  }
}

/**
 * Extract metadata using Gemini (rationalized to avoid duplication)
 */
async function extractMetadata(title: string, body: string): Promise<ExtractedMetadata> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

  const prompt = `Analyze this voice note and extract structured metadata.

Title: ${title}
Body: ${body}

Extract the following in JSON format:
{
  "memory_type": "foundational" | "event" | "insight",
  "entities": {
    "people": ["names of specific people mentioned"],
    "places": ["names of specific locations"],
    "topics": ["specific technologies, activities, or concepts - e.g. 'React', 'meditation', 'cooking']
  },
  "themes": ["high-level life themes - max 3"],
  "tags": ["searchable tags - 3-5 tags"],
  "emotional_tone": "brief emotional description"
}

Rules:
- memory_type: "foundational" = core belief/value, "event" = something that happened, "insight" = realization/idea
- entities.people: Only actual names (e.g., "Sarah", "Alex"), not generic terms
- entities.places: Only specific locations (e.g., "London", "Central Park")
- entities.topics: Specific nouns - technologies, tools, activities, subjects (e.g., "TypeScript", "yoga", "parenting")
- themes: Broad life categories ONLY (max 3) - e.g., "career", "health", "creativity", "relationships", "learning", "family"
- tags: Short searchable keywords (3-5) - overlap with topics is OK but keep minimal. Use for: mood, context, or specifics not captured elsewhere
- emotional_tone: One short phrase (e.g., "excited", "reflective and calm", "frustrated")

**Key difference:**
- topics = what is this about? (nouns: React, meditation, design)
- themes = what life area? (categories: career, health, creativity)
- tags = additional searchable context (e.g., "breakthrough", "side-project", "morning-routine")

Return ONLY the JSON, no other text.`

  const result = await model.generateContent(prompt)
  const response = result.response.text().trim()

  logger.info({
    memory_title: title.substring(0, 50),
    response_length: response.length,
    response_preview: response.substring(0, 200)
  }, 'Gemini metadata extraction response')

  // Parse JSON (Gemini usually returns clean JSON)
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    logger.error({ response }, 'Failed to parse Gemini response as JSON')
    throw new Error('Failed to parse Gemini response as JSON')
  }

  const parsed = JSON.parse(jsonMatch[0])
  logger.info({
    parsed_entities_count: (parsed.entities?.people?.length || 0) + (parsed.entities?.places?.length || 0) + (parsed.entities?.topics?.length || 0),
    parsed_themes_count: parsed.themes?.length || 0,
    parsed_tags_count: parsed.tags?.length || 0
  }, 'Parsed metadata from Gemini')

  return parsed
}

/**
 * Generate embedding using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

/**
 * Store individual entities in the entities table
 */
async function storeEntities(memoryId: string, entities: Entities): Promise<void> {
  const allEntities: Array<{ name: string; type: string; memory_id: string }> = []

  // Flatten entities into individual records
  for (const person of entities.people || []) {
    allEntities.push({ name: person, type: 'person', memory_id: memoryId })
  }
  for (const place of entities.places || []) {
    allEntities.push({ name: place, type: 'place', memory_id: memoryId })
  }
  for (const topic of entities.topics || []) {
    allEntities.push({ name: topic, type: 'topic', memory_id: memoryId })
  }

  if (allEntities.length === 0) {
    logger.debug('No entities to store')
    return
  }

  // Insert entities
  const { error } = await supabase
    .from('entities')
    .insert(allEntities.map(e => ({
      ...e,
      created_at: new Date().toISOString(),
    })))

  if (error) {
    logger.warn({ error }, 'Error storing entities')
    // Don't throw - entity storage is non-critical
  } else {
    logger.debug({ count: allEntities.length }, 'Stored entities')
  }
}

/**
 * Trigger connection detection for new memory (async, non-blocking)
 */
async function triggerConnectionDetection(
  memoryId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    // Get base URL from environment
    const host = process.env.VERCEL_URL || 'localhost:5173'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    logger.debug({ memory_id: memoryId }, 'Triggering connection detection')

    // Call connection detection API
    await fetch(`${baseUrl}/api/connections/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: 'memory',
        contentId: memoryId,
        contentText: `${title}\n\n${body}`,
        contentTitle: title
      })
    })

    logger.debug({ memory_id: memoryId }, 'Connection detection triggered')
  } catch (error) {
    // Log but don't throw - connection detection is non-critical
    logger.warn({ memory_id: memoryId, error }, 'Failed to trigger connection detection')
  }
}
