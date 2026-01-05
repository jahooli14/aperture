import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import type { Memory, Entities, MemoryType, ExtractedMetadata } from '../../src/types'
import { normalizeTags } from './tag-normalizer.js'
import { updateItemConnections } from './connection-logic.js'
import { MODELS } from './models.js'

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
    // Fetch active projects to help with triage
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description')
      .eq('status', 'active')

    logger.info({ memory_id: memoryId }, '🔄 Extracting metadata...')
    const metadata = await extractMetadata(memory.title, memory.body, projects || [])
    logger.info({ memory_id: memoryId, summary_title: metadata.summary_title, triage: metadata.triage?.category }, '✅ Metadata extracted')

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
        triage: metadata.triage,
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
    // Use user_id from the memory itself, or fallback to default
    const userId = memory.user_id || 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'
    // Use shared logic for Top 5 Dynamic connections
    await updateItemConnections(memoryId, 'thought', embedding, userId)
    logger.info({ memory_id: memoryId }, '✅ Connections processed')

    // 7. Act on Triage
    if (metadata.triage) {
      const { category, project_id } = metadata.triage
      if (category === 'task_update' && project_id) {
        logger.info({ project_id }, '🔄 Adding task to project from triage...')
        // Fetch project to get current tasks
        const { data: project } = await supabase
          .from('projects')
          .select('metadata')
          .eq('id', project_id)
          .single()

        if (project) {
          const currentTasks = project.metadata?.tasks || []
          const newTask = {
            id: crypto.randomUUID(),
            text: metadata.summary_title,
            done: false,
            created_at: new Date().toISOString(),
            order: currentTasks.length
          }
          const updatedMetadata = {
            ...project.metadata,
            tasks: [...currentTasks, newTask]
          }
          await supabase
            .from('projects')
            .update({ metadata: updatedMetadata, last_active: new Date().toISOString() })
            .eq('id', project_id)
          logger.info({ project_id }, '✅ Task added to project')
        }
      } else if (category === 'reading_lead') {
        logger.info('🔄 Adding to reading queue from triage...')
        await supabase
          .from('reading_queue')
          .insert({
            user_id: userId,
            title: metadata.summary_title,
            excerpt: metadata.insightful_body.slice(0, 200),
            status: 'unread',
            url: metadata.entities?.topics?.[0] || 'thought://' + memoryId // Pseudo-URL
          })
        logger.info('✅ Added to reading queue')
      }
    }

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
async function extractMetadata(title: string, body: string, projects: any[]): Promise<ExtractedMetadata> {
  const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT }) // Consistent model usage

  const projectList = projects.map(p => `- ${p.title} (ID: ${p.id}): ${p.description}`).join('\n')

  const prompt = `Process this voice note transcription into a clean thought.

TRANSCRIPTION: "${title}" - ${body}

INSTRUCTIONS:
1. summary_title: Distill the CORE IDEA into a short, punchy title (3-8 words). NOT the first sentence truncated. Summarize the insight.
   - Bad: "There's definite crossover between the thought of..."
   - Good: "Babies as ideas machines"

2. insightful_body: Clean up the transcription:
   - Remove filler words (um, uh, like, you know, so, I mean)
   - Remove false starts and repetition
   - Fix grammar while keeping natural, first-person voice
   - Keep it concise but preserve the full meaning

3. Extract entities, themes, and tags from the content.

Projects for triage: ${projectList || 'None'}

Return JSON:
{
  "summary_title": "short punchy title capturing the core idea",
  "insightful_body": "cleaned up version with filler removed, natural first-person voice",
  "memory_type": "foundational|event|insight",
  "entities": {
    "people": ["actual names mentioned"],
    "places": ["specific locations"],
    "topics": ["technologies, activities, concepts"],
    "skills": ["abilities demonstrated or discussed"]
  },
  "themes": ["max 3 from: career/health/creativity/relationships/learning/family"],
  "tags": ["3-5 specific tags - technologies, activities, domains. NOT generic words like 'note', 'thought', 'idea'"],
  "emotional_tone": "short phrase",
  "triage": {"category": "task_update|new_thought|reading_lead", "project_id": "uuid or null", "confidence": 0-1}
}`

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
