/**
 * Tag Normalization System
 * Semantic clustering for consistent tag vocabulary
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

// Use process.env directly, similar to other API lib modules
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

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

      if (similarTag && typeof similarTag === 'object' && 'tag' in similarTag) {
        // Found similar canonical tag, use it
        const tag = (similarTag as any).tag
        const id = (similarTag as any).id
        const similarity = (similarTag as any).similarity

        normalizedTags.push(tag)
        await incrementTagUsage(tag)

        // Store this as an alias for future fast lookups
        await supabase
          .from('tag_aliases')
          .insert({
            alias: cleaned,
            canonical_tag_id: id
          })
          .select()

        console.log(`[Tag Normalizer] Mapped tag '${cleaned}' to '${tag}' (similarity: ${similarity})`)
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
        console.warn(`[Tag Normalizer] Failed to create canonical tag '${cleaned}':`, error)
        continue
      }

      normalizedTags.push(cleaned)
      console.log(`[Tag Normalizer] Created new canonical tag '${cleaned}' in category '${category}'`)

    } catch (error) {
      console.warn(`[Tag Normalizer] Error normalizing tag '${cleaned}':`, error)
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
  const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

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
    console.warn(`[Tag Normalizer] Failed to infer category for '${tag}', using default. Error:`, error)
    return 'Personal'
  }
}

/**
 * Generate embeddings for all seed tags (run once after migration)
 * Call this from a one-time initialization endpoint
 */
export async function generateSeedEmbeddings(): Promise<void> {
  console.log('[Tag Normalizer] Generating embeddings for seed tags...')

  const { data: seedTags, error: fetchError } = await supabase
    .from('canonical_tags')
    .select('id, tag')
    .eq('is_seed', true)
    .is('embedding', null)

  if (fetchError) {
    throw new Error(`Failed to fetch seed tags: ${fetchError.message}`)
  }

  if (!seedTags || seedTags.length === 0) {
    console.log('[Tag Normalizer] All seed tags already have embeddings')
    return
  }

  console.log(`[Tag Normalizer] Processing ${seedTags.length} seed tags`)

  let processed = 0
  for (const tag of seedTags) {
    try {
      const embedding = await generateEmbedding(tag.tag)

      await supabase
        .from('canonical_tags')
        .update({ embedding })
        .eq('id', tag.id)

      processed++
      // Rate limiting: wait 100ms between API calls
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`[Tag Normalizer] Failed to generate embedding for '${tag.tag}':`, error)
    }
  }

  console.log(`[Tag Normalizer] Completed seed embedding generation (${processed}/${seedTags.length})`)
}

/**
 * Identify similar tags that should be merged (Graph Hygiene)
 */
export async function identifyTagMerges(): Promise<any[]> {
  const { data: tags } = await supabase
    .from('canonical_tags')
    .select('id, tag, usage_count')
    .order('usage_count', { ascending: false })
    .limit(500)

  if (!tags || tags.length < 5) return []

  const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
  const tagList = tags.map(t => t.tag).join('\n')

  const prompt = `Identify clusters of tags that mean the exact same thing and should be merged. 
  
  TAGS:
  ${tagList}
  
  Rules:
  - Only group tags that are semantically IDENTICAL (e.g. "ai" and "artificial intelligence", "ux" and "user experience").
  - Ignore related but distinct concepts.
  - Select the best "canonical" name for the group (usually the most common or shortest). 
  
  Return JSON:
  [
    { "canonical": "ai", "merge_candidates": ["artificial intelligence", "ai models"] },
    ...
  ]`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/[\[][\s\S]*[/\]]/)
    if (!jsonMatch) return []

    const clusters = JSON.parse(jsonMatch[0])

    return clusters.map((c: any) => ({
      ...c,
      ids: tags.filter(t => c.merge_candidates.includes(t.tag) || t.tag === c.canonical).map(t => t.id)
    })).filter((c: any) => c.ids.length > 1)
  } catch (e) {
    console.error('[Tag Normalizer] Failed to identify tag merges:', e)
    return []
  }
}