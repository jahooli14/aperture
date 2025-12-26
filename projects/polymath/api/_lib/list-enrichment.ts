/**
 * AI List Enrichment Agent v2
 *
 * Architecture:
 * 1. Use Gemini WITH Google Search grounding to get real, current metadata
 * 2. For images, use reliable free APIs:
 *    - Books: Open Library Covers API (free, no key needed)
 *    - Films: TMDB API (free key) or OMDB
 *    - General: Image URL from search grounding
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, DynamicRetrievalMode } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface EnrichmentResult {
    title: string
    subtitle: string
    image: string | null
    link: string | null
    tags: string[]
    specs: Record<string, string>
    sources?: string[]
}

/**
 * Fetch book cover from Open Library (free, no API key needed)
 */
async function fetchBookCover(title: string, author?: string): Promise<string | null> {
    try {
        // Search Open Library for the book
        const query = author ? `${title} ${author}` : title
        const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`

        const response = await fetch(searchUrl)
        if (!response.ok) return null

        const data = await response.json() as { docs?: Array<{ cover_i?: number; isbn?: string[] }> }
        if (!data.docs || data.docs.length === 0) return null

        const book = data.docs[0]

        // Get cover from cover_i (cover ID) or isbn
        if (book.cover_i) {
            return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        }
        if (book.isbn && book.isbn.length > 0) {
            return `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`
        }

        return null
    } catch (error) {
        console.error('[BookCover] Open Library fetch failed:', error)
        return null
    }
}

/**
 * Fetch movie poster from TMDB (requires free API key)
 */
async function fetchMoviePoster(title: string, year?: string): Promise<string | null> {
    const tmdbKey = process.env.TMDB_API_KEY
    if (!tmdbKey) {
        console.log('[MoviePoster] No TMDB_API_KEY, skipping poster fetch')
        return null
    }

    try {
        const query = encodeURIComponent(title)
        const yearParam = year ? `&year=${year}` : ''
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${query}${yearParam}`

        const response = await fetch(searchUrl)
        if (!response.ok) return null

        const data = await response.json() as { results?: Array<{ poster_path?: string }> }
        if (!data.results || data.results.length === 0) return null

        const movie = data.results[0]
        if (movie.poster_path) {
            return `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        }

        return null
    } catch (error) {
        console.error('[MoviePoster] TMDB fetch failed:', error)
        return null
    }
}

/**
 * Use Gemini WITH Google Search grounding to get real metadata
 */
async function getGroundedMetadata(content: string, category: string): Promise<EnrichmentResult> {
    const model = genAI.getGenerativeModel(
        {
            model: MODELS.DEFAULT_CHAT,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            // Enable Google Search grounding
            tools: [{
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: DynamicRetrievalMode.MODE_DYNAMIC,
                        dynamicThreshold: 0.3, // Low threshold = more likely to search
                    },
                },
            }],
        },
        { apiVersion: 'v1beta' } // Required for grounding
    )

    const prompt = `Find information about "${content}" (category: ${category}).

Return a JSON object with these fields:
- title: The official/full title
- subtitle: A descriptive line (e.g., "Directed by Christopher Nolan" for films, "by George Orwell" for books)
- year: The release/publication year
- tags: Array of 3 relevant genre/category tags
- specs: Object with category-specific details (e.g., {"Runtime": "148 min", "Rating": "8.8/10"} for films)
- link: An official or authoritative URL (IMDb, Goodreads, Wikipedia, etc.)
- author_or_creator: The author, director, artist, or creator name

IMPORTANT: Use real, current information from your search. Return ONLY valid JSON.`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.1,
            responseMimeType: 'application/json',
        },
    })

    const text = result.response.text()
    console.log(`[Grounding] Raw response for "${content}":`, text.slice(0, 200))

    // Extract grounding metadata for sources
    // Note: The SDK has a typo - it's "groundingChuncks" not "groundingChunks"
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata
    const chunks = (groundingMetadata as { groundingChuncks?: Array<{ web?: { uri?: string } }> })?.groundingChuncks || []
    const sources = chunks
        .map((chunk) => chunk.web?.uri)
        .filter(Boolean) as string[]

    if (sources.length > 0) {
        console.log(`[Grounding] Found ${sources.length} sources:`, sources.slice(0, 3))
    }

    // Parse JSON response
    let jsonStr = text.trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        jsonStr = jsonMatch[0]
    }

    const parsed = JSON.parse(jsonStr)

    return {
        title: parsed.title || content,
        subtitle: parsed.subtitle || '',
        image: null, // We'll fetch this separately from reliable sources
        link: parsed.link || (sources.length > 0 ? sources[0] : null),
        tags: parsed.tags || [],
        specs: parsed.specs || {},
        sources,
    }
}

/**
 * Main enrichment function
 */
export async function enrichListItem(
    userId: string,
    listId: string,
    itemId: string,
    content: string,
    listType?: string
): Promise<Record<string, unknown> | null> {
    console.log(`[Enrichment] Starting for item: "${content}"`)

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
        console.log(`[Enrichment] Category: ${category}`)

        // 2. Get grounded metadata from Gemini with search
        const metadata = await getGroundedMetadata(content, category)
        console.log(`[Enrichment] Got metadata:`, {
            title: metadata.title,
            subtitle: metadata.subtitle,
            tags: metadata.tags,
            hasSources: (metadata.sources?.length || 0) > 0
        })

        // 3. Fetch image from reliable source based on category
        let imageUrl: string | null = null

        if (category === 'book') {
            // Extract author from subtitle if available
            const authorMatch = metadata.subtitle.match(/by\s+(.+)/i)
            const author = authorMatch ? authorMatch[1] : undefined
            imageUrl = await fetchBookCover(content, author)
            console.log(`[Enrichment] Book cover from Open Library:`, imageUrl ? 'found' : 'not found')
        } else if (category === 'film') {
            // Extract year from specs if available
            const year = metadata.specs?.Year || metadata.specs?.year
            imageUrl = await fetchMoviePoster(content, year)
            console.log(`[Enrichment] Movie poster from TMDB:`, imageUrl ? 'found' : 'not found')
        }

        // 4. Build final metadata object
        const finalMetadata = {
            title: metadata.title,
            subtitle: metadata.subtitle,
            image: imageUrl,
            link: metadata.link,
            tags: metadata.tags,
            specs: metadata.specs,
            enriched_at: new Date().toISOString(),
            grounded: (metadata.sources?.length || 0) > 0,
        }

        // 5. Update the item in Supabase
        const { error } = await supabase
            .from('list_items')
            .update({
                metadata: finalMetadata,
                enrichment_status: 'complete'
            })
            .eq('id', itemId)
            .eq('user_id', userId)

        if (error) throw error

        console.log(`[Enrichment] Successfully enriched: "${content}"`)
        return finalMetadata

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Enrichment] Failed for "${content}":`, error)

        // Set to failed so we don't keep spinner forever
        try {
            const supabase = getSupabaseClient()
            await supabase
                .from('list_items')
                .update({
                    enrichment_status: 'failed',
                    metadata: { error: errorMessage }
                })
                .eq('id', itemId)
                .eq('user_id', userId)
        } catch (dbErr) {
            console.error('[Enrichment] Total failure - could not even update status:', dbErr)
        }
        return null
    }
}
