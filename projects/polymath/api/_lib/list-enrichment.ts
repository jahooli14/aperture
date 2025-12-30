/**
 * AI List Enrichment Agent
 * Uses external APIs (OMDb, Google Books, Wikipedia) + Gemini fallback
 */

import { generateText } from './gemini-chat.js'
import { getSupabaseClient } from './supabase.js'
import { enrichFilm, enrichBook, enrichFromWikipedia } from './enrichment-apis.js'
import { generateEmbedding } from './gemini-embeddings.js'
import { updateItemConnections } from './connection-logic.js'

export async function enrichListItem(userId: string, listId: string, itemId: string, content: string, listType?: string) {
    console.log(`[Enrichment] Starting for item: ${content}`)
    console.log(`[Enrichment] Environment check:`, {
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        hasOmdbKey: !!process.env.OMDB_API_KEY,
        hasGoogleBooksKey: !!process.env.GOOGLE_BOOKS_API_KEY
    })

    try {
        const supabase = getSupabaseClient()

        // 1. Resolve List Type if not provided
        let category = listType
        if (!category) {
            const { data: list } = await supabase
                .from('lists')
                .select('type')
                .eq('id', listId)
                .single()
            category = list?.type || 'generic'
        }

        // 2. Try external APIs first, then fallback chain
        let metadata = null

        // Try category-specific API first
        if (category === 'film' || category === 'tv' || category === 'movie') {
            console.log(`[Enrichment] Trying OMDb for film: ${content}`)
            metadata = await enrichFilm(content)
        } else if (category === 'book') {
            console.log(`[Enrichment] Trying Google Books for book: ${content}`)
            metadata = await enrichBook(content)
        }

        // Fallback to Wikipedia if category API didn't work or no category API
        if (!metadata) {
            console.log(`[Enrichment] Trying Wikipedia for: ${content}`)
            // For films, try searching with "(film)" suffix to avoid disambiguation pages
            const searchTerm = (category === 'film' || category === 'tv' || category === 'movie')
                ? `${content} (film)`
                : content
            metadata = await enrichFromWikipedia(searchTerm)
        }

        // Final fallback to Gemini if all APIs failed
        if (!metadata) {
            console.log(`[Enrichment] All APIs failed, using Gemini for: ${content}`)
            metadata = await enrichWithGemini(content, category)
        }

        // Ensure metadata has required fields
        if (!metadata || !metadata.subtitle) {
            throw new Error('Enrichment produced no valid metadata')
        }

        // 3. Generate embedding for semantic connections
        // This enables the "Rothko article → paint pouring project" cross-pollination
        const embeddingText = `${content}. ${metadata.subtitle || ''}. ${metadata.description || ''}. ${(metadata.tags || []).join(', ')}`
        let embedding: number[] | null = null

        try {
            embedding = await generateEmbedding(embeddingText)
            console.log(`[Enrichment] Generated embedding for: ${content}`)
        } catch (embErr) {
            console.warn(`[Enrichment] Embedding generation failed for ${content}:`, embErr)
            // Continue without embedding - enrichment still succeeds
        }

        // 4. Update the item in Supabase (with embedding if available)
        const updateData: any = {
            metadata,
            enrichment_status: 'complete'
        }
        if (embedding) {
            updateData.embedding = embedding
        }

        let { error } = await supabase
            .from('list_items')
            .update(updateData)
            .eq('id', itemId)
            .eq('user_id', userId)

        // Graceful fallback if the 'embedding' column is missing from list_items
        if (error?.code === '42703' && updateData.embedding) {
            console.warn('[Enrichment] Database missing list_items.embedding column. Retrying without embedding.')
            const fallbackData = { ...updateData }
            delete fallbackData.embedding
            const { error: retryError } = await supabase
                .from('list_items')
                .update(fallbackData)
                .eq('id', itemId)
                .eq('user_id', userId)
            error = retryError
        }

        if (error) throw error

        // 5. Create semantic connections to projects/thoughts/articles
        // This is where "film you saved" can inspire "your paint pouring project"
        if (embedding) {
            try {
                await updateItemConnections(itemId, 'list_item', embedding, userId)
                console.log(`[Enrichment] Created connections for: ${content}`)
            } catch (connErr) {
                console.warn(`[Enrichment] Connection creation failed for ${content}:`, connErr)
                // Non-fatal - item is still enriched
            }
        }

        console.log(`[Enrichment] Successfully enriched: ${content} (source: ${metadata.source})`)
        return metadata

    } catch (error: any) {
        console.error(`[Enrichment] Failed for ${content}:`, error)
        console.error('[Enrichment] Error details:', {
            name: error?.name,
            message: error?.message,
            stack: error?.stack?.split('\n').slice(0, 3).join('\n')
        })

        // Set to failed so we don't keep spinner forever
        try {
            const supabase = getSupabaseClient()
            await supabase
                .from('list_items')
                .update({
                    enrichment_status: 'failed',
                    metadata: {
                        error: error.message || 'Unknown error',
                        errorType: error.name,
                        timestamp: new Date().toISOString()
                    }
                })
                .eq('id', itemId)
                .eq('user_id', userId)
        } catch (dbErr) {
            console.error('[Enrichment] Total failure - could not even update status:', dbErr)
        }
        throw error
    }
}

/**
 * Gemini fallback - for when APIs don't have data
 */
async function enrichWithGemini(content: string, category: string) {
    const prompt = `Provide enrichment metadata for this ${category}:

"${content}"

Return JSON with these exact fields:
- subtitle: One descriptive line (e.g., "Director: Name" for films, "Author: Name" for books)
- description: Brief 2-line description of what it's about (max 140 chars)
- tags: Array of exactly 3 relevant tags
- specs: Object with 2-3 key details (e.g., {"Year": "2010", "Runtime": "148min"} for films)

Return ONLY valid JSON, no markdown, no explanation.

Example format:
{"subtitle": "Director: Christopher Nolan", "description": "A thief who enters dreams to steal secrets faces his toughest job: planting an idea in someone's mind.", "tags": ["Sci-Fi", "Thriller", "Complex"], "specs": {"Year": "2010", "Runtime": "148min"}}`

    const response = await generateText(prompt, {
        responseFormat: 'json',
        temperature: 0.0,
        maxTokens: 1500
    })

    // Robust JSON extraction
    let jsonStr = response.trim()
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error(`No valid JSON found in Gemini response: ${response.slice(0, 200)}`)
    }
    jsonStr = jsonMatch[0]

    const metadata = JSON.parse(jsonStr)

    // Ensure tags is an array
    if (!Array.isArray(metadata.tags)) {
        metadata.tags = []
    }

    // Add source
    metadata.source = 'gemini'

    return metadata
}
