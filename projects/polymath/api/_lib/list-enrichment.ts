/**
 * AI List Enrichment Agent v3
 *
 * Comprehensive architecture for all list types:
 *
 * 1. Use Gemini WITH Google Search grounding for real metadata
 * 2. Category-specific image APIs:
 *    - book: Open Library (free, no key)
 *    - film: TMDB (free key)
 *    - music: MusicBrainz + Cover Art Archive (free, no key)
 *    - game: RAWG (free, no key)
 *    - place/tech/software/event/generic: Wikipedia (free, no key)
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, DynamicRetrievalMode } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

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

// ============================================================================
// IMAGE FETCHERS - One per category, all free
// ============================================================================

/**
 * Books: Open Library (free, no key)
 */
async function fetchBookCover(title: string, author?: string): Promise<string | null> {
    try {
        const query = author ? `${title} ${author}` : title
        const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`

        const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) return null

        const data = await response.json() as { docs?: Array<{ cover_i?: number; isbn?: string[] }> }
        if (!data.docs || data.docs.length === 0) return null

        const book = data.docs[0]
        if (book.cover_i) {
            return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        }
        if (book.isbn && book.isbn.length > 0) {
            return `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`
        }
        return null
    } catch (error) {
        console.error('[BookCover] Failed:', error)
        return null
    }
}

/**
 * Films: TMDB (free key required)
 */
async function fetchMoviePoster(title: string, year?: string): Promise<string | null> {
    const tmdbKey = process.env.TMDB_API_KEY
    if (!tmdbKey) {
        console.log('[MoviePoster] No TMDB_API_KEY, trying Wikipedia fallback')
        return fetchWikipediaImage(title)
    }

    try {
        const yearParam = year ? `&year=${year}` : ''
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}${yearParam}`

        const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) return null

        const data = await response.json() as { results?: Array<{ poster_path?: string }> }
        if (!data.results || data.results.length === 0) return null

        const movie = data.results[0]
        if (movie.poster_path) {
            return `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        }
        return null
    } catch (error) {
        console.error('[MoviePoster] Failed:', error)
        return null
    }
}

/**
 * Music: MusicBrainz + Cover Art Archive (free, no key)
 */
async function fetchAlbumCover(query: string): Promise<string | null> {
    try {
        // Search MusicBrainz for release
        const searchUrl = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=1&fmt=json`

        const response = await fetch(searchUrl, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Aperture/1.0 (polymath app)' } // MusicBrainz requires User-Agent
        })
        if (!response.ok) return null

        const data = await response.json() as { releases?: Array<{ id: string }> }
        if (!data.releases || data.releases.length === 0) return null

        const releaseId = data.releases[0].id

        // Get cover from Cover Art Archive
        const coverUrl = `https://coverartarchive.org/release/${releaseId}/front-500`

        // Check if cover exists (CAA returns redirect to actual image)
        const coverResponse = await fetch(coverUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000),
            redirect: 'follow'
        })

        if (coverResponse.ok) {
            return coverUrl
        }
        return null
    } catch (error) {
        console.error('[AlbumCover] Failed:', error)
        return null
    }
}

/**
 * Games: RAWG (free, no key for basic use)
 */
async function fetchGameImage(title: string): Promise<string | null> {
    try {
        // RAWG allows limited requests without API key
        const searchUrl = `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&page_size=1`

        const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) return null

        const data = await response.json() as { results?: Array<{ background_image?: string }> }
        if (!data.results || data.results.length === 0) return null

        return data.results[0].background_image || null
    } catch (error) {
        console.error('[GameImage] Failed:', error)
        return null
    }
}

/**
 * Wikipedia: Universal fallback for places, tech, software, events, generic
 * Uses Wikipedia API to find page and extract main image
 */
async function fetchWikipediaImage(query: string): Promise<string | null> {
    try {
        // Search Wikipedia for the page
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`

        const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
        if (!searchResponse.ok) return null

        const searchData = await searchResponse.json() as {
            query?: { search?: Array<{ pageid: number; title: string }> }
        }

        if (!searchData.query?.search || searchData.query.search.length === 0) return null

        const pageTitle = searchData.query.search[0].title

        // Get page images using pageimages API
        const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`

        const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) })
        if (!imageResponse.ok) return null

        const imageData = await imageResponse.json() as {
            query?: { pages?: Record<string, { thumbnail?: { source: string } }> }
        }

        if (!imageData.query?.pages) return null

        // Get first page's thumbnail
        const pages = Object.values(imageData.query.pages)
        if (pages.length > 0 && pages[0].thumbnail?.source) {
            return pages[0].thumbnail.source
        }

        return null
    } catch (error) {
        console.error('[WikipediaImage] Failed:', error)
        return null
    }
}

// ============================================================================
// MAIN IMAGE ROUTER
// ============================================================================

async function fetchImageForCategory(
    category: string,
    content: string,
    metadata: { subtitle?: string; specs?: Record<string, string> }
): Promise<string | null> {
    console.log(`[ImageFetch] Category: ${category}, Item: "${content}"`)

    let image: string | null = null

    switch (category) {
        case 'book': {
            const authorMatch = metadata.subtitle?.match(/by\s+(.+)/i)
            image = await fetchBookCover(content, authorMatch?.[1])
            break
        }

        case 'film': {
            const year = metadata.specs?.Year || metadata.specs?.year
            image = await fetchMoviePoster(content, year)
            break
        }

        case 'music': {
            image = await fetchAlbumCover(content)
            break
        }

        case 'game': {
            image = await fetchGameImage(content)
            break
        }

        case 'place':
        case 'tech':
        case 'software':
        case 'event':
        case 'generic':
        default: {
            image = await fetchWikipediaImage(content)
            break
        }
    }

    // Fallback to Wikipedia if category-specific failed
    if (!image && category !== 'generic' && category !== 'place' && category !== 'tech') {
        console.log(`[ImageFetch] Trying Wikipedia fallback for ${category}`)
        image = await fetchWikipediaImage(content)
    }

    console.log(`[ImageFetch] Result: ${image ? 'found' : 'not found'}`)
    return image
}

// ============================================================================
// GEMINI WITH GOOGLE SEARCH GROUNDING
// ============================================================================

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
            tools: [{
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: DynamicRetrievalMode.MODE_DYNAMIC,
                        dynamicThreshold: 0.3,
                    },
                },
            }],
        },
        { apiVersion: 'v1beta' }
    )

    // Category-specific prompts for better results
    const categoryPrompts: Record<string, string> = {
        book: 'author, publication year, genre, page count, publisher',
        film: 'director, release year, runtime, genre, rating',
        music: 'artist/band, album, release year, genre, record label',
        game: 'developer, publisher, release year, platform, genre',
        place: 'location, country, type (city/landmark/etc), notable features',
        tech: 'company/creator, release year, category, key features',
        software: 'developer, platform, category, pricing (free/paid)',
        event: 'date, location, organizer, type',
        generic: 'relevant details, category, notable attributes',
    }

    const categoryHint = categoryPrompts[category] || categoryPrompts.generic

    const prompt = `Find information about "${content}" (category: ${category}).

Return a JSON object with:
- title: The official/full title
- subtitle: Key info (${categoryHint})
- year: Release/publication year if applicable
- tags: Array of 3 relevant tags
- specs: Object with details like {${categoryHint.split(', ').slice(0, 3).map(s => `"${s}": "..."`).join(', ')}}
- link: Official or authoritative URL (Wikipedia, IMDb, official site, etc.)

Use real, current information from search. Return ONLY valid JSON.`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.1,
            responseMimeType: 'application/json',
        },
    })

    const text = result.response.text()
    console.log(`[Grounding] Response for "${content}":`, text.slice(0, 150))

    // Extract sources from grounding metadata
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata
    const chunks = (groundingMetadata as { groundingChuncks?: Array<{ web?: { uri?: string } }> })?.groundingChuncks || []
    const sources = chunks.map(c => c.web?.uri).filter(Boolean) as string[]

    // Parse response
    let jsonStr = text.trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) jsonStr = jsonMatch[0]

    const parsed = JSON.parse(jsonStr)

    return {
        title: parsed.title || content,
        subtitle: parsed.subtitle || '',
        image: null,
        link: parsed.link || sources[0] || null,
        tags: parsed.tags || [],
        specs: parsed.specs || {},
        sources,
    }
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

export async function enrichListItem(
    userId: string,
    listId: string,
    itemId: string,
    content: string,
    listType?: string
): Promise<Record<string, unknown> | null> {
    console.log(`[Enrichment] Starting: "${content}"`)

    try {
        const supabase = getSupabaseClient()

        // 1. Get list type
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

        // 2. Get grounded metadata from Gemini
        const metadata = await getGroundedMetadata(content, category)

        // 3. Fetch image from reliable source
        const imageUrl = await fetchImageForCategory(category, content, {
            subtitle: metadata.subtitle,
            specs: metadata.specs,
        })

        // 4. Build final result
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

        // 5. Save to database
        const { error } = await supabase
            .from('list_items')
            .update({
                metadata: finalMetadata,
                enrichment_status: 'complete'
            })
            .eq('id', itemId)
            .eq('user_id', userId)

        if (error) throw error

        console.log(`[Enrichment] Success: "${content}" (image: ${imageUrl ? 'yes' : 'no'})`)
        return finalMetadata

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Enrichment] Failed for "${content}":`, msg)

        try {
            const supabase = getSupabaseClient()
            await supabase
                .from('list_items')
                .update({
                    enrichment_status: 'failed',
                    metadata: { error: msg }
                })
                .eq('id', itemId)
                .eq('user_id', userId)
        } catch (dbErr) {
            console.error('[Enrichment] Could not update status:', dbErr)
        }
        return null
    }
}
