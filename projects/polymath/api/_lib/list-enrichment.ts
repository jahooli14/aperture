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
        let listTitle = ''
        if (!category) {
            console.log(`[Enrichment] Fetching list type for listId: ${listId}`)
            const { data: list, error: listError } = await supabase
                .from('lists')
                .select('type, title')
                .eq('id', listId)
                .eq('user_id', userId)
                .single()

            if (listError) {
                console.error(`[Enrichment] Failed to fetch list type:`, listError)
            }
            category = list?.type || 'generic'
            listTitle = list?.title || ''
            console.log(`[Enrichment] List category resolved to: ${category}, title: "${listTitle}"`)
        }

        // 2. Try external APIs first, then fallback chain
        let metadata = null

        // Quotes/phrases go directly to Gemini with specialized prompt
        if (category === 'quote') {
            console.log(`[Enrichment] Using quote-specific enrichment for: ${content}`)
            metadata = await enrichQuote(content)
        }
        // Try category-specific API first
        else if (category === 'film' || category === 'tv' || category === 'movie' || category === 'show') {
            console.log(`[Enrichment] Trying OMDb for film: ${content}`)
            metadata = await enrichFilm(content)
        } else if (category === 'book') {
            console.log(`[Enrichment] Trying Google Books for book: ${content}`)
            metadata = await enrichBook(content)
        }

        // Fallback to Wikipedia if category API didn't work or no category API
        if (!metadata) {
            console.log(`[Enrichment] Trying Wikipedia for: ${content}`)

            // For film/TV, try multiple search strategies in order of likelihood
            if (category === 'film' || category === 'tv' || category === 'movie' || category === 'show') {
                // Try exact title first (works for most content)
                metadata = await enrichFromWikipedia(content)

                // If no result, try with "(TV series)" suffix (for shows/miniseries)
                if (!metadata) {
                    console.log(`[Enrichment] Trying Wikipedia with TV series suffix for: ${content}`)
                    metadata = await enrichFromWikipedia(`${content} (TV series)`)
                }

                // If still no result, try with "(film)" suffix
                if (!metadata) {
                    console.log(`[Enrichment] Trying Wikipedia with film suffix for: ${content}`)
                    metadata = await enrichFromWikipedia(`${content} (film)`)
                }
            } else {
                metadata = await enrichFromWikipedia(content)
            }
        }

        // Final fallback to Gemini if all APIs failed
        if (!metadata) {
            console.log(`[Enrichment] All APIs failed, trying Gemini for: ${content}`)
            try {
                metadata = await enrichWithGemini(content, category)
            } catch (geminiError) {
                console.error(`[Enrichment] Gemini fallback failed:`, geminiError)
                // Ultimate fallback: create basic metadata from content
                metadata = {
                    subtitle: `${category || 'Item'}`,
                    description: content,
                    tags: [],
                    specs: {},
                    source: 'gemini'
                }
                console.log(`[Enrichment] Using basic metadata for: ${content}`)
            }
        }

        // Ensure metadata has required fields
        if (!metadata || !metadata.subtitle) {
            // Create minimal valid metadata as final fallback
            metadata = {
                subtitle: category || 'Item',
                description: content,
                tags: [],
                specs: {},
                source: 'gemini'
            }
            console.log(`[Enrichment] Created minimal metadata for: ${content}`)
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

        console.log(`[Enrichment] Updating database for item ${itemId} with metadata from ${metadata.source}`)

        let { error } = await supabase
            .from('list_items')
            .update(updateData)
            .eq('id', itemId)
            .eq('user_id', userId)

        // Graceful fallback if the 'embedding' column is missing from list_items
        // Error codes: 42703 (PostgreSQL), PGRST204 (PostgREST schema cache)
        if ((error?.code === '42703' || error?.code === 'PGRST204') && updateData.embedding) {
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

        if (error) {
            console.error(`[Enrichment] Database update failed for item ${itemId}:`, {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            })
            throw error
        }

        console.log(`[Enrichment] Database updated successfully for: ${content}`)

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
    // Validate API key exists
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured')
    }

    const prompt = `Provide enrichment metadata for this ${category || 'item'}:

"${content}"

Return JSON with these exact fields:
- subtitle: One descriptive line (e.g., "Director: Name" for films, "Author: Name" for books)
- description: Brief 2-line description of what it's about (max 140 chars)
- tags: Array of exactly 3 relevant tags
- specs: Object with 2-3 key details (e.g., {"Year": "2010", "Runtime": "148min"} for films)

Return ONLY valid JSON, no markdown, no explanation.

Example format:
{"subtitle": "Director: Christopher Nolan", "description": "A thief who enters dreams to steal secrets faces his toughest job: planting an idea in someone's mind.", "tags": ["Sci-Fi", "Thriller", "Complex"], "specs": {"Year": "2010", "Runtime": "148min"}}`

    try {
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
            console.error(`[Gemini] Invalid response format: ${response.slice(0, 200)}`)
            throw new Error(`No valid JSON found in Gemini response`)
        }
        jsonStr = jsonMatch[0]

        const metadata = JSON.parse(jsonStr)

        // Validate required fields
        if (!metadata.subtitle) {
            metadata.subtitle = category || 'Item'
        }

        // Ensure tags is an array
        if (!Array.isArray(metadata.tags)) {
            metadata.tags = []
        }

        // Ensure specs is an object
        if (!metadata.specs || typeof metadata.specs !== 'object') {
            metadata.specs = {}
        }

        // Add source
        metadata.source = 'gemini'

        return metadata
    } catch (error) {
        console.error(`[Gemini] Enrichment error:`, error)
        throw error
    }
}

/**
 * Quote/Phrase enrichment - tries to identify source and generate mood tags
 */
async function enrichQuote(content: string) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured')
    }

    const prompt = `Analyze this phrase or text snippet:

"${content}"

Your task:
1. If this is a known quote, identify the author/source
2. If it's not a known quote, that's fine - leave author/source empty
3. Generate evocative tags that capture the mood, theme, or feeling of the phrase
4. Write a brief poetic interpretation or reflection on why someone might find this phrase beautiful

Return JSON with these exact fields:
- subtitle: If it's a known quote, the author name (e.g., "Virginia Woolf"). If unknown, leave as empty string ""
- description: A brief (1-2 sentence) reflection on the beauty or meaning of this phrase
- tags: Array of 3-4 evocative tags capturing mood/theme (e.g., ["Melancholy", "Longing", "Time", "Memory"])
- specs: Object with optional details. Include {"Author": "Name"} if known, {"Source": "Book/Work"} if known, or leave empty {}

Return ONLY valid JSON, no markdown, no explanation.

Example for a known quote:
{"subtitle": "F. Scott Fitzgerald", "description": "A meditation on the impossible pursuit of the past, and how we're forever reaching toward what we've lost.", "tags": ["Longing", "Time", "Memory", "Hope"], "specs": {"Author": "F. Scott Fitzgerald", "Source": "The Great Gatsby"}}

Example for an unknown phrase:
{"subtitle": "", "description": "There's something quietly devastating about this image - the way it captures a moment of loss without melodrama.", "tags": ["Stillness", "Loss", "Observation", "Quiet"], "specs": {}}`

    try {
        const response = await generateText(prompt, {
            responseFormat: 'json',
            temperature: 0.3,
            maxTokens: 1500
        })

        let jsonStr = response.trim()
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')

        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.error(`[Quote Enrichment] Invalid response format: ${response.slice(0, 200)}`)
            throw new Error(`No valid JSON found in quote enrichment response`)
        }
        jsonStr = jsonMatch[0]

        const metadata = JSON.parse(jsonStr)

        // Ensure tags is an array
        if (!Array.isArray(metadata.tags)) {
            metadata.tags = []
        }

        // Ensure specs is an object
        if (!metadata.specs || typeof metadata.specs !== 'object') {
            metadata.specs = {}
        }

        metadata.source = 'gemini'
        console.log(`[Quote Enrichment] Successfully enriched phrase`)
        return metadata

    } catch (error) {
        console.error(`[Quote Enrichment] Error:`, error)
        // Return minimal metadata for quotes
        return {
            subtitle: '',
            description: '',
            tags: ['Phrase', 'Collected'],
            specs: {},
            source: 'gemini'
        }
    }
}
