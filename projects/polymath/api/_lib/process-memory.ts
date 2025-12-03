import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import type { Memory, Entities, MemoryType, ExtractedMetadata } from '../../src/types'
import { normalizeTags } from './tag-normalizer.js'
import { cosineSimilarity } from './gemini-embeddings.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

const logger = {
  info: (objOrMsg: any, msg?: string) => console.log(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
  warn: (objOrMsg: any, msg?: string) => console.warn(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
  error: (objOrMsg: any, msg?: string) => console.error(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
  debug: (objOrMsg: any, msg?: string) => console.debug(msg || objOrMsg, typeof objOrMsg === 'object' && msg ? objOrMsg : ''),
}

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

    // 2. Extract entities and metadata using Gemini (also generates summary title and insightful body)
    logger.info({ memory_id: memoryId }, '🔄 Extracting metadata...')
    const metadata = await extractMetadata(memory.title, memory.body)
    logger.info({ memory_id: memoryId, summary_title: metadata.summary_title }, '✅ Metadata extracted')

    // 3. Generate embedding for the processed memory content
    const embeddingText = `${metadata.summary_title}\n\n${metadata.insightful_body}`
    logger.info({ memory_id: memoryId, text_length: embeddingText.length }, '🔄 Generating embedding...')
    const embedding = await generateEmbedding(embeddingText)
    logger.info({ memory_id: memoryId, embedding_length: embedding.length, embedding_sample: embedding.slice(0, 5) }, '✅ Embedding generated')

    // 4. Update the memory with extracted metadata and processed content
    logger.info({ memory_id: memoryId }, '🔄 Updating memory in database...')
    const { error: updateError } = await supabase
      .from('memories')
      .update({
        title: metadata.summary_title,
        body: metadata.insightful_body,
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
      logger.error({ memory_id: memoryId, error: updateError }, '🚨 Failed to update memory')
      throw new Error(`Failed to update memory: ${updateError.message}`)
    }
    logger.info({ memory_id: memoryId }, '✅ Memory updated in database')

    // 5. Store individual entities in the entities table
    logger.info({ memory_id: memoryId }, '🔄 Storing entities...')
    await storeEntities(memoryId, metadata.entities)
    logger.info({ memory_id: memoryId }, '✅ Entities stored')

    // 5b. Store skills as capabilities in the capabilities table
    logger.info({ memory_id: memoryId }, '🔄 Storing capabilities from skills...')
    await storeCapabilities(memoryId, metadata.entities?.skills || [], metadata.summary_title)
    logger.info({ memory_id: memoryId }, '✅ Capabilities stored')

    // 6. Auto-suggest and create connections
    logger.info({ memory_id: memoryId }, '🔄 Finding and creating connections...')
    // Use hardcoded user_id (single-user app, memories table doesn't have user_id)
    const userId = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'
    await findAndCreateConnections(memoryId, userId, embedding, metadata.summary_title, metadata.insightful_body)
    logger.info({ memory_id: memoryId }, '✅ Connections processed')

    logger.info({
      memory_id: memoryId,
      summary_title: metadata.summary_title,
      type: metadata.memory_type,
      entities: metadata.entities,
      themes: metadata.themes,
      connections_processing: true
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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Clean up this voice note into something natural and readable.

Raw Voice Transcript:
Title: ${title}
Body: ${body}

Extract the following in JSON format:
{
  "summary_title": "A clear, specific title (max 80 chars)",
  "insightful_body": "Rewrite in plain, conversational English. Keep the same ideas and tone, just make it readable. Remove filler words and 'um's but don't make it formal or flowery. Write how a smart person would naturally explain this idea to a friend. First person. No jargon unless it was in the original.",
  "memory_type": "foundational" | "event" | "insight",
  "entities": {
    "people": ["names of specific people mentioned"],
    "places": ["names of specific locations"],
    "topics": ["specific technologies, activities, or concepts - e.g. 'React', 'meditation', 'cooking'],
    "skills": ["user's abilities, skills, or capabilities mentioned - e.g. 'woodworking', 'Python programming', 'video editing', 'cooking', 'teaching']
  },
  "themes": ["high-level life themes - max 3"],
  "tags": ["searchable tags - 3-5 tags"],
  "emotional_tone": "brief emotional description"
}

Rules:
- summary_title: What's this about? Be specific, not generic.
- insightful_body: Clean up the rambling but keep it conversational. Don't use words like "nascent", "formative", "preliminary", "profound", "revelatory". Just write like a normal person who happens to have interesting thoughts. Natural language only.
- memory_type: "foundational" = core belief/value, "event" = something that happened, "insight" = realization/idea
- entities.people: Only actual names (e.g., "Sarah", "Alex"), not generic terms
- entities.places: Only specific locations (e.g., "London", "Central Park")
- entities.topics: Specific nouns - technologies, tools, activities, subjects (e.g., "TypeScript", "yoga", "parenting")
- entities.skills: User's abilities, expertise, or things they can do. Extract if user says "I can", "I know how to", "I'm good at", or describes doing something skillfully (e.g., "woodworking", "Python", "cooking", "teaching", "video editing")
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
    summary_title: parsed.summary_title?.substring(0, 60),
    insightful_body_length: parsed.insightful_body?.length || 0,
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
  for (const skill of entities.skills || []) {
    allEntities.push({ name: skill, type: 'skill', memory_id: memoryId })
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
 * Store or update capabilities from extracted skills
 * Upserts to capabilities table with strength tracking
 */
async function storeCapabilities(memoryId: string, skills: string[], memoryTitle: string): Promise<void> {
  if (!skills || skills.length === 0) {
    logger.debug('No skills to store as capabilities')
    return
  }

  logger.info({ memory_id: memoryId, skills_count: skills.length, skills }, 'Storing capabilities from skills')

  for (const skillName of skills) {
    try {
      // Check if capability already exists
      const { data: existing, error: fetchError } = await supabase
        .from('capabilities')
        .select('id, strength, last_used')
        .eq('name', skillName)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.warn({ skill: skillName, error: fetchError }, 'Error fetching capability')
        continue
      }

      if (existing) {
        // Update existing capability: increment strength and update last_used
        const newStrength = existing.strength + 0.1 // Increment by 0.1 each time mentioned
        const { error: updateError } = await supabase
          .from('capabilities')
          .update({
            strength: newStrength,
            last_used: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          logger.warn({ skill: skillName, error: updateError }, 'Error updating capability')
        } else {
          logger.debug({ skill: skillName, old_strength: existing.strength, new_strength: newStrength }, 'Updated capability strength')
        }
      } else {
        // Create new capability
        // Generate embedding for the skill
        const embedding = await generateEmbedding(skillName)

        const { error: insertError } = await supabase
          .from('capabilities')
          .insert({
            name: skillName,
            description: `User capability: ${skillName}`, // Simple description
            source_project: 'user',
            code_references: [{ memory_id: memoryId, memory_title: memoryTitle }],
            strength: 1.0, // Initial strength
            last_used: new Date().toISOString(),
            embedding,
          })

        if (insertError) {
          logger.warn({ skill: skillName, error: insertError }, 'Error inserting capability')
        } else {
          logger.info({ skill: skillName }, 'Created new capability')
        }
      }
    } catch (error) {
      logger.warn({ skill: skillName, error }, 'Error processing capability')
    }
  }
}

/**
 * Find and create connections for a new memory
 */
async function findAndCreateConnections(
  memoryId: string,
  userId: string,
  embedding: number[],
  title: string,
  body: string
): Promise<void> {
  try {
    logger.info({ memory_id: memoryId }, 'Finding connections for memory')

    const candidates: Array<{ type: 'project' | 'thought' | 'article'; id: string; title: string; similarity: number }> = []

    // Search projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, description, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(50)

    if (projectsError) {
      logger.warn({ memory_id: memoryId, error: projectsError }, 'Error querying projects for connections')
    }

    if (projects) {
      for (const p of projects) {
        if (p.embedding) {
          const similarity = cosineSimilarity(embedding, p.embedding)
          // Lowered threshold from 0.7 to 0.55 for consistency with connections API
          if (similarity > 0.55) {
            candidates.push({ type: 'project', id: p.id, title: p.title, similarity })
          }
        }
      }
    }

    // Search other memories (memories table has no user_id column - single user app)
    const { data: memories, error: memoriesError } = await supabase
      .from('memories')
      .select('id, title, body, embedding')
      .neq('id', memoryId)
      .not('embedding', 'is', null)
      .limit(50)

    if (memoriesError) {
      logger.warn({ memory_id: memoryId, error: memoriesError }, 'Error querying memories for connections')
    }

    if (memories) {
      for (const m of memories) {
        if (m.embedding) {
          const similarity = cosineSimilarity(embedding, m.embedding)
          // Lowered threshold from 0.7 to 0.55 for consistency with connections API
          if (similarity > 0.55) {
            candidates.push({ type: 'thought', id: m.id, title: m.title || m.body?.slice(0, 50) + '...', similarity })
          }
        }
      }
    }

    // Search articles (stored in reading_queue table)
    const { data: articles, error: articlesError } = await supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(50)

    if (articlesError) {
      logger.warn({ memory_id: memoryId, error: articlesError }, 'Error querying articles for connections')
    }

    if (articles) {
      for (const a of articles) {
        if (a.embedding) {
          const similarity = cosineSimilarity(embedding, a.embedding)
          // Lowered threshold from 0.7 to 0.55 for consistency with connections API
          if (similarity > 0.55) {
            candidates.push({ type: 'article', id: a.id, title: a.title, similarity })
          }
        }
      }
    }

    // Sort by similarity
    candidates.sort((a, b) => b.similarity - a.similarity)

    logger.info({ memory_id: memoryId, candidates_found: candidates.length }, 'Found connection candidates')

    // Auto-link >85%, suggest 55-85%
    const autoLinked = []
    const suggestions = []

    for (const candidate of candidates.slice(0, 10)) {
      if (candidate.similarity > 0.85) {
        // Auto-create connection (with deduplication check)
        const { data: existing } = await supabase
          .from('connections')
          .select('id')
          .or(`and(source_type.eq.thought,source_id.eq.${memoryId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.thought,target_id.eq.${memoryId})`)
          .maybeSingle()

        if (!existing) {
          await supabase
            .from('connections')
            .insert({
              source_type: 'thought',
              source_id: memoryId,
              target_type: candidate.type,
              target_id: candidate.id,
              connection_type: 'relates_to',
              created_by: 'ai',
              ai_reasoning: `${Math.round(candidate.similarity * 100)}% semantic match`
            })
          autoLinked.push(candidate)
        }
      } else if (candidate.similarity > 0.55) {
        suggestions.push(candidate)
      }
    }

    logger.info({ memory_id: memoryId, auto_linked: autoLinked.length, suggestions: suggestions.length }, 'Created connections')

    // Store suggestions
    if (suggestions.length > 0) {
      const suggestionInserts = suggestions.map(s => ({
        from_item_type: 'thought',
        from_item_id: memoryId,
        to_item_type: s.type,
        to_item_id: s.id,
        reasoning: `${Math.round(s.similarity * 100)}% semantic similarity`,
        confidence: s.similarity,
        user_id: userId,
        status: 'pending'
      }))

      await supabase
        .from('connection_suggestions')
        .insert(suggestionInserts)
    }

  } catch (error) {
    logger.warn({
      memory_id: memoryId,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      error_type: error instanceof Error ? error.constructor.name : typeof error
    }, 'Failed to find connections (non-fatal)')
  }
}
