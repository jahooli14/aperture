/**
 * AI List Enrichment Agent v5 - With detailed error visibility
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

// ============================================================================
// VALIDATION
// ============================================================================

function validateEnvironment(): { valid: boolean; error?: string } {
    if (!process.env.GEMINI_API_KEY) {
        return { valid: false, error: 'GEMINI_API_KEY environment variable is not set' }
    }
    if (process.env.GEMINI_API_KEY.length < 10) {
        return { valid: false, error: 'GEMINI_API_KEY appears to be invalid (too short)' }
    }
    return { valid: true }
}

// ============================================================================
// IMAGE FETCHERS
// ============================================================================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

async function fetchBookCover(title: string, author?: string): Promise<string | null> {
    try {
        const query = author ? `${title} ${author}` : title
        const response = await fetchWithTimeout(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`
        )
        if (!response.ok) return null
        const data = await response.json() as { docs?: Array<{ cover_i?: number; isbn?: string[] }> }
        const book = data.docs?.[0]
        if (book?.cover_i) return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        if (book?.isbn?.[0]) return `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`
        return null
    } catch { return null }
}

async function fetchMoviePoster(title: string): Promise<string | null> {
    const tmdbKey = process.env.TMDB_API_KEY
    if (tmdbKey) {
        try {
            const response = await fetchWithTimeout(
                `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`
            )
            if (response.ok) {
                const data = await response.json() as { results?: Array<{ poster_path?: string }> }
                if (data.results?.[0]?.poster_path) {
                    return `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`
                }
            }
        } catch { /* fall through to Wikipedia */ }
    }
    return fetchWikipediaImage(title + ' film')
}

async function fetchAlbumCover(query: string): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(
            `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=1&fmt=json`,
            { headers: { 'User-Agent': 'Aperture/1.0' } }
        )
        if (!response.ok) return null
        const data = await response.json() as { releases?: Array<{ id: string }> }
        const releaseId = data.releases?.[0]?.id
        if (releaseId) return `https://coverartarchive.org/release/${releaseId}/front-500`
        return null
    } catch { return null }
}

async function fetchGameImage(title: string): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(
            `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&page_size=1`
        )
        if (!response.ok) return null
        const data = await response.json() as { results?: Array<{ background_image?: string }> }
        return data.results?.[0]?.background_image || null
    } catch { return null }
}

async function fetchWikipediaImage(query: string): Promise<string | null> {
    try {
        const searchResponse = await fetchWithTimeout(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`
        )
        if (!searchResponse.ok) return null
        const searchData = await searchResponse.json() as { query?: { search?: Array<{ title: string }> } }
        const pageTitle = searchData.query?.search?.[0]?.title
        if (!pageTitle) return null

        const imageResponse = await fetchWithTimeout(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`
        )
        if (!imageResponse.ok) return null
        const imageData = await imageResponse.json() as { query?: { pages?: Record<string, { thumbnail?: { source: string } }> } }
        const pages = Object.values(imageData.query?.pages || {})
        return pages[0]?.thumbnail?.source || null
    } catch { return null }
}

async function fetchImageForCategory(category: string, content: string): Promise<string | null> {
    switch (category) {
        case 'book': return fetchBookCover(content)
        case 'film': return fetchMoviePoster(content)
        case 'music': return (await fetchAlbumCover(content)) || fetchWikipediaImage(content + ' album')
        case 'game': return (await fetchGameImage(content)) || fetchWikipediaImage(content + ' video game')
        default: return fetchWikipediaImage(content)
    }
}

// ============================================================================
// GEMINI METADATA
// ============================================================================

interface Metadata {
    title: string
    subtitle: string
    tags: string[]
    specs: Record<string, string>
    link: string | null
}

async function getMetadataFromGemini(content: string, category: string): Promise<{ data?: Metadata; error?: string }> {
    // Validate environment first
    const envCheck = validateEnvironment()
    if (!envCheck.valid) {
        return { error: envCheck.error }
    }

    const categoryHints: Record<string, string> = {
        book: 'Include author in subtitle. Specs: Year, Pages, Genre.',
        film: 'Include director in subtitle. Specs: Year, Runtime, Genre.',
        music: 'Include artist in subtitle. Specs: Year, Genre, Label.',
        game: 'Include developer in subtitle. Specs: Year, Platform, Genre.',
        place: 'Include country in subtitle. Specs: Country, Type.',
        tech: 'Include company in subtitle. Specs: Year, Category.',
        software: 'Include developer in subtitle. Specs: Platform, Category.',
        event: 'Include date in subtitle. Specs: Date, Location.',
        generic: 'Include key info in subtitle.',
    }

    const prompt = `Provide metadata for "${content}" (category: ${category}).
${categoryHints[category] || categoryHints.generic}
Return JSON: {"title":"...","subtitle":"...","tags":["..."],"specs":{...},"link":"..."}
Return ONLY valid JSON.`

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
        console.log(`[Gemini] OK for "${content}":`, text.slice(0, 80))

        // Parse JSON
        const match = text.trim().match(/\{[\s\S]*\}/)
        if (!match) {
            return { error: `Gemini returned invalid JSON: ${text.slice(0, 100)}` }
        }

        const parsed = JSON.parse(match[0])
        return {
            data: {
                title: parsed.title || content,
                subtitle: parsed.subtitle || '',
                tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
                specs: typeof parsed.specs === 'object' ? parsed.specs : {},
                link: parsed.link || null,
            }
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[Gemini] FAILED for "${content}":`, msg)
        return { error: `Gemini API error: ${msg}` }
    }
}

// ============================================================================
// MAIN ENRICHMENT
// ============================================================================

export async function enrichListItem(
    userId: string,
    listId: string,
    itemId: string,
    content: string,
    listType?: string
): Promise<Record<string, unknown> | null> {
    console.log(`[Enrichment] Starting: "${content}" (item: ${itemId})`)

    const supabase = getSupabaseClient()

    // Helper to save error status
    const saveError = async (errorMsg: string) => {
        console.error(`[Enrichment] ERROR: ${errorMsg}`)
        try {
            await supabase
                .from('list_items')
                .update({
                    enrichment_status: 'failed',
                    metadata: {
                        error: errorMsg,
                        failed_at: new Date().toISOString(),
                        content: content,
                    }
                })
                .eq('id', itemId)
                .eq('user_id', userId)
        } catch (dbErr) {
            console.error('[Enrichment] Could not save error to DB:', dbErr)
        }
    }

    try {
        // 1. Get list type
        let category = listType
        if (!category) {
            const { data: list, error: listError } = await supabase
                .from('lists')
                .select('type')
                .eq('id', listId)
                .single()

            if (listError) {
                await saveError(`Failed to get list type: ${listError.message}`)
                return null
            }
            category = list?.type || 'generic'
        }
        console.log(`[Enrichment] Category: ${category}`)

        // 2. Get metadata from Gemini
        const geminiResult = await getMetadataFromGemini(content, category)
        if (geminiResult.error) {
            await saveError(geminiResult.error)
            return null
        }

        const metadata = geminiResult.data!
        console.log(`[Enrichment] Got metadata: title="${metadata.title}"`)

        // 3. Fetch image
        const imageUrl = await fetchImageForCategory(category, content)
        console.log(`[Enrichment] Image: ${imageUrl ? 'found' : 'not found'}`)

        // 4. Save success
        const finalMetadata = {
            title: metadata.title,
            subtitle: metadata.subtitle,
            image: imageUrl,
            link: metadata.link,
            tags: metadata.tags,
            specs: metadata.specs,
            enriched_at: new Date().toISOString(),
        }

        const { error: updateError } = await supabase
            .from('list_items')
            .update({
                metadata: finalMetadata,
                enrichment_status: 'complete'
            })
            .eq('id', itemId)
            .eq('user_id', userId)

        if (updateError) {
            await saveError(`Failed to save metadata: ${updateError.message}`)
            return null
        }

        console.log(`[Enrichment] SUCCESS: "${content}"`)
        return finalMetadata

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        await saveError(`Unexpected error: ${msg}`)
        return null
    }
}
