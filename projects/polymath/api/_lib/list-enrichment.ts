/**
 * AI List Enrichment Agent v4
 *
 * Pragmatic architecture:
 * 1. Use Gemini for metadata (training data is sufficient for films/books/etc.)
 * 2. Use reliable free APIs for images (the key improvement)
 * 3. Robust error handling with graceful degradation
 *
 * Image sources (all free):
 * - book: Open Library
 * - film: TMDB (with key) or Wikipedia
 * - music: MusicBrainz + Cover Art Archive
 * - game: RAWG
 * - others: Wikipedia
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// ============================================================================
// IMAGE FETCHERS - Reliable free APIs
// ============================================================================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(url, { ...options, signal: controller.signal })
        return response
    } finally {
        clearTimeout(timeout)
    }
}

/** Books: Open Library (free, no key) */
async function fetchBookCover(title: string, author?: string): Promise<string | null> {
    try {
        const query = author ? `${title} ${author}` : title
        const response = await fetchWithTimeout(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`
        )
        if (!response.ok) return null

        const data = await response.json() as { docs?: Array<{ cover_i?: number; isbn?: string[] }> }
        const book = data.docs?.[0]
        if (!book) return null

        if (book.cover_i) return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        if (book.isbn?.[0]) return `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`
        return null
    } catch (e) {
        console.error('[BookCover]', e)
        return null
    }
}

/** Films: TMDB (free key) with Wikipedia fallback */
async function fetchMoviePoster(title: string, year?: string): Promise<string | null> {
    const tmdbKey = process.env.TMDB_API_KEY
    if (tmdbKey) {
        try {
            const yearParam = year ? `&year=${year}` : ''
            const response = await fetchWithTimeout(
                `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}${yearParam}`
            )
            if (response.ok) {
                const data = await response.json() as { results?: Array<{ poster_path?: string }> }
                if (data.results?.[0]?.poster_path) {
                    return `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`
                }
            }
        } catch (e) {
            console.error('[MoviePoster TMDB]', e)
        }
    }
    // Fallback to Wikipedia
    return fetchWikipediaImage(title + ' film')
}

/** Music: MusicBrainz + Cover Art Archive (free, no key) */
async function fetchAlbumCover(query: string): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(
            `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=1&fmt=json`,
            { headers: { 'User-Agent': 'Aperture/1.0 (contact@example.com)' } }
        )
        if (!response.ok) return null

        const data = await response.json() as { releases?: Array<{ id: string }> }
        const releaseId = data.releases?.[0]?.id
        if (!releaseId) return null

        // Cover Art Archive - just return the URL, let the browser handle it
        return `https://coverartarchive.org/release/${releaseId}/front-500`
    } catch (e) {
        console.error('[AlbumCover]', e)
        return null
    }
}

/** Games: RAWG (free tier) */
async function fetchGameImage(title: string): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(
            `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&page_size=1`
        )
        if (!response.ok) return null

        const data = await response.json() as { results?: Array<{ background_image?: string }> }
        return data.results?.[0]?.background_image || null
    } catch (e) {
        console.error('[GameImage]', e)
        return null
    }
}

/** Wikipedia: Universal fallback */
async function fetchWikipediaImage(query: string): Promise<string | null> {
    try {
        // Step 1: Search for page
        const searchResponse = await fetchWithTimeout(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`
        )
        if (!searchResponse.ok) return null

        const searchData = await searchResponse.json() as {
            query?: { search?: Array<{ title: string }> }
        }
        const pageTitle = searchData.query?.search?.[0]?.title
        if (!pageTitle) return null

        // Step 2: Get page thumbnail
        const imageResponse = await fetchWithTimeout(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`
        )
        if (!imageResponse.ok) return null

        const imageData = await imageResponse.json() as {
            query?: { pages?: Record<string, { thumbnail?: { source: string } }> }
        }
        const pages = Object.values(imageData.query?.pages || {})
        return pages[0]?.thumbnail?.source || null
    } catch (e) {
        console.error('[WikipediaImage]', e)
        return null
    }
}

// ============================================================================
// IMAGE ROUTER
// ============================================================================

async function fetchImageForCategory(category: string, content: string, metadata: { subtitle?: string; specs?: Record<string, string> }): Promise<string | null> {
    console.log(`[Image] Fetching for ${category}: "${content}"`)

    let image: string | null = null

    switch (category) {
        case 'book': {
            const authorMatch = metadata.subtitle?.match(/by\s+(.+)/i)
            image = await fetchBookCover(content, authorMatch?.[1])
            break
        }
        case 'film': {
            image = await fetchMoviePoster(content, metadata.specs?.Year || metadata.specs?.year)
            break
        }
        case 'music': {
            image = await fetchAlbumCover(content)
            if (!image) image = await fetchWikipediaImage(content + ' album')
            break
        }
        case 'game': {
            image = await fetchGameImage(content)
            if (!image) image = await fetchWikipediaImage(content + ' video game')
            break
        }
        default: {
            image = await fetchWikipediaImage(content)
            break
        }
    }

    // Final fallback to Wikipedia for all categories
    if (!image && !['place', 'tech', 'software', 'event', 'generic'].includes(category)) {
        image = await fetchWikipediaImage(content)
    }

    console.log(`[Image] Result: ${image ? 'found' : 'not found'}`)
    return image
}

// ============================================================================
// METADATA FROM GEMINI (using training data, no grounding needed)
// ============================================================================

interface Metadata {
    title: string
    subtitle: string
    tags: string[]
    specs: Record<string, string>
    link: string | null
}

async function getMetadataFromGemini(content: string, category: string): Promise<Metadata> {
    const categoryHints: Record<string, string> = {
        book: 'Include author name in subtitle (e.g., "by George Orwell"). Specs: Year, Pages, Genre.',
        film: 'Include director in subtitle (e.g., "Directed by Christopher Nolan"). Specs: Year, Runtime, Genre, Rating.',
        music: 'Include artist in subtitle (e.g., "by Pink Floyd"). Specs: Year, Genre, Label.',
        game: 'Include developer in subtitle. Specs: Year, Platform, Genre.',
        place: 'Include location/country in subtitle. Specs: Country, Type, Population.',
        tech: 'Include company in subtitle. Specs: Year, Category.',
        software: 'Include developer in subtitle. Specs: Platform, Price, Category.',
        event: 'Include date/location in subtitle. Specs: Date, Location, Type.',
        generic: 'Include key info in subtitle. Specs: relevant attributes.',
    }

    const prompt = `Provide metadata for "${content}" (category: ${category}).

${categoryHints[category] || categoryHints.generic}

Return JSON:
{
  "title": "Official/full title",
  "subtitle": "Key descriptive line",
  "tags": ["tag1", "tag2", "tag3"],
  "specs": {"Key": "Value", ...},
  "link": "Wikipedia or official URL"
}

Return ONLY valid JSON, no other text.`

    try {
        const model = genAI.getGenerativeModel({
            model: MODELS.DEFAULT_CHAT,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        })

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
        })

        const text = result.response.text()
        console.log(`[Gemini] Response for "${content}":`, text.slice(0, 100))

        // Robust JSON extraction
        let jsonStr = text.trim()
        const match = jsonStr.match(/\{[\s\S]*\}/)
        if (match) jsonStr = match[0]

        const parsed = JSON.parse(jsonStr)
        return {
            title: parsed.title || content,
            subtitle: parsed.subtitle || '',
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
            specs: typeof parsed.specs === 'object' ? parsed.specs : {},
            link: parsed.link || null,
        }
    } catch (error) {
        console.error(`[Gemini] Failed for "${content}":`, error)
        // Return minimal metadata on failure
        return {
            title: content,
            subtitle: '',
            tags: [],
            specs: {},
            link: null,
        }
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

        // 2. Get metadata from Gemini (parallel with image fetch for speed)
        const [metadata, _] = await Promise.all([
            getMetadataFromGemini(content, category),
            Promise.resolve() // placeholder for now
        ])

        // 3. Fetch image from reliable API
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

        console.log(`[Enrichment] Success: "${content}"`)
        return finalMetadata

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[Enrichment] Failed: "${content}" -`, msg)

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
            console.error('[Enrichment] DB update failed:', dbErr)
        }
        return null
    }
}
