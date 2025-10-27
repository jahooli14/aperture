/**
 * Tag Normalization System
 * Semantic clustering for consistent tag vocabulary
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig, getGeminiConfig } from './env.js'
import { logger } from './logger.js'

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

interface CanonicalTag {
  id: string
  tag: string
  category: string | null
  usage_count: number
  embedding: number[] | null
}

/**
 * Normalize an array of raw tags to canonical forms
 * Uses semantic similarity to map to existing tags or creates new ones
 */
export async function normalizeTags(rawTags: string[]): Promise<string[]> {
  if (!rawTags || rawTags.length === 0) return []

  const normalizedTags: string[] = []

  for (const rawTag of rawTags) {
    const cleaned = rawTag.trim().toLowerCase()
    if (!cleaned) continue

    try {
      // 1. Check exact match first (fast path)
      const { data: exactMatch } = await supabase
        .from('canonical_tags')
        .select('tag')
        .eq('tag', cleaned)
        .single()

      if (exactMatch) {
        normalizedTags.push(exactMatch.tag)
        await incrementTagUsage(exactMatch.tag)
        continue
      }

      // 2. Check aliases (fast path)
      const { data: aliasMatch } = await supabase
        .from('tag_aliases')
        .select('canonical_tag_id, canonical_tags(tag)')
        .eq('alias', cleaned)
        .single()

      if (aliasMatch && aliasMatch.canonical_tags) {
        const canonicalTag = (aliasMatch.canonical_tags as any).tag
        normalizedTags.push(canonicalTag)
        await incrementTagUsage(canonicalTag)
        continue
      }

      // 3. Generate embedding and find similar canonical tag
      const embedding = await generateEmbedding(cleaned)

      const { data: similarTag } = await supabase
        .rpc('find_similar_tag', {
          query_embedding: embedding,
          similarity_threshold: 0.85 // High threshold = very similar
        })
        .limit(1)
        .single()

      if (similarTag && similarTag.tag) {
        // Found similar canonical tag, use it
        normalizedTags.push(similarTag.tag)
        await incrementTagUsage(similarTag.tag)

        // Store this as an alias for future fast lookups
        await supabase
          .from('tag_aliases')
          .insert({
            alias: cleaned,
            canonical_tag_id: similarTag.id
          })
          .select()

        logger.info({ raw: cleaned, canonical: similarTag.tag, similarity: similarTag.similarity }, 'Mapped tag to canonical form')
        continue
      }

      // 4. No similar tag found, create new canonical tag
      const category = await inferCategory(cleaned)

      const { data: newTag, error } = await supabase
        .from('canonical_tags')
        .insert({
          tag: cleaned,
          category,
          embedding,
          usage_count: 1,
          is_seed: false
        })
        .select()
        .single()

      if (error) {
        logger.warn({ tag: cleaned, error }, 'Failed to create canonical tag, skipping')
        continue
      }

      normalizedTags.push(cleaned)
      logger.info({ tag: cleaned, category }, 'Created new canonical tag')

    } catch (error) {
      logger.warn({ tag: cleaned, error }, 'Error normalizing tag, skipping')
      continue
    }
  }

  return normalizedTags
}

/**
 * Generate embedding for a tag
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

/**
 * Increment usage count for a canonical tag
 */
async function incrementTagUsage(tag: string): Promise<void> {
  await supabase.rpc('increment_tag_usage', { tag_text: tag })
}

/**
 * Infer category for a new tag using Gemini
 */
async function inferCategory(tag: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Categorize this tag into ONE of these categories:
- Technology
- Health
- Business
- Creative
- Learning
- Personal

Tag: "${tag}"

Respond with ONLY the category name, nothing else.`

  try {
    const result = await model.generateContent(prompt)
    const category = result.response.text().trim()

    // Validate category
    const validCategories = ['Technology', 'Health', 'Business', 'Creative', 'Learning', 'Personal']
    if (validCategories.includes(category)) {
      return category
    }

    // Fallback
    return 'Personal'
  } catch (error) {
    logger.warn({ tag, error }, 'Failed to infer category, using default')
    return 'Personal'
  }
}

/**
 * Generate embeddings for all seed tags (run once after migration)
 * Call this from a one-time initialization endpoint
 */
export async function generateSeedEmbeddings(): Promise<void> {
  logger.info('Generating embeddings for seed tags...')

  const { data: seedTags, error: fetchError } = await supabase
    .from('canonical_tags')
    .select('id, tag')
    .eq('is_seed', true)
    .is('embedding', null)

  if (fetchError) {
    throw new Error(`Failed to fetch seed tags: ${fetchError.message}`)
  }

  if (!seedTags || seedTags.length === 0) {
    logger.info('All seed tags already have embeddings')
    return
  }

  logger.info({ count: seedTags.length }, 'Processing seed tags')

  let processed = 0
  for (const tag of seedTags) {
    try {
      const embedding = await generateEmbedding(tag.tag)

      await supabase
        .from('canonical_tags')
        .update({ embedding })
        .eq('id', tag.id)

      processed++
      logger.debug({ tag: tag.tag, progress: `${processed}/${seedTags.length}` }, 'Generated embedding')

      // Rate limiting: wait 100ms between API calls
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      logger.error({ tag: tag.tag, error }, 'Failed to generate embedding')
    }
  }

  logger.info({ processed, total: seedTags.length }, 'Completed seed embedding generation')
}
