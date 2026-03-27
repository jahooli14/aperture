/**
 * External API clients for list item enrichment
 * Provides real data from OMDb, Google Books, Wikipedia
 */

interface EnrichmentMetadata {
    image?: string
    thumbnail?: string
    subtitle: string
    description?: string  // Brief 2-line description (max ~140 chars)
    tags: string[]
    link?: string
    specs: Record<string, any>
    source: 'omdb' | 'google-books' | 'wikipedia' | 'gemini'
}

/**
 * Wikipedia API - No key required, works immediately
 * https://en.wikipedia.org/api/rest_v1/
 */
export async function enrichFromWikipedia(title: string): Promise<EnrichmentMetadata | null> {
    // Input validation
    if (!title || title.trim().length === 0) {
        console.log('[Wikipedia] Empty title provided')
        return null
    }

    // Trim and limit title length
    const cleanTitle = title.trim().substring(0, 300)

    try {
        console.log(`[Wikipedia] Fetching data for: ${cleanTitle}`)

        // Search for the article with timeout
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTitle)}&format=json&origin=*`
        const searchController = new AbortController()
        const searchTimeout = setTimeout(() => searchController.abort(), 10000) // 10s timeout

        const searchRes = await fetch(searchUrl, { signal: searchController.signal })
        clearTimeout(searchTimeout)

        if (!searchRes.ok) {
            throw new Error(`Wikipedia search failed: ${searchRes.status}`)
        }

        const searchData: any = await searchRes.json()

        if (!searchData.query?.search?.[0]) {
            console.log(`[Wikipedia] No results found for: ${title}`)
            return null
        }

        const pageTitle = searchData.query.search[0].title

        // Get page summary and image with timeout
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
        const summaryController = new AbortController()
        const summaryTimeout = setTimeout(() => summaryController.abort(), 10000) // 10s timeout

        const summaryRes = await fetch(summaryUrl, { signal: summaryController.signal })
        clearTimeout(summaryTimeout)

        if (!summaryRes.ok) {
            throw new Error(`Wikipedia summary failed: ${summaryRes.status}`)
        }

        const summary: any = await summaryRes.json()

        // Reject disambiguation pages - they don't contain useful item data
        if (summary.type === 'disambiguation') {
            console.log(`[Wikipedia] Skipping disambiguation page for: ${title}`)
            return null
        }

        // Extract metadata
        const metadata: EnrichmentMetadata = {
            subtitle: summary.description || summary.extract?.split('.')[0] || 'Wikipedia article',
            description: extractBriefDescription(summary.extract || ''),
            tags: extractTagsFromSummary(summary.extract || ''),
            link: summary.content_urls?.desktop?.page,
            specs: summary.timestamp
                ? { Year: new Date(summary.timestamp).getFullYear().toString() }
                : {},
            source: 'wikipedia'
        }

        // Add image if available
        if (summary.thumbnail?.source) {
            metadata.thumbnail = summary.thumbnail.source
            metadata.image = summary.originalimage?.source || summary.thumbnail.source
        }

        console.log(`[Wikipedia] Successfully enriched: ${title}`)
        return metadata

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error(`[Wikipedia] Request timeout for ${cleanTitle}`)
        } else {
            console.error(`[Wikipedia] Failed for ${cleanTitle}:`, error.message)
        }
        return null
    }
}

/**
 * OMDb API - Requires OMDB_API_KEY env var
 * Free tier: 1,000 calls/day
 * Get key: https://www.omdbapi.com/apikey.aspx
 */
export async function enrichFilm(title: string): Promise<EnrichmentMetadata | null> {
    const apiKey = process.env.OMDB_API_KEY

    if (!apiKey) {
        console.log('[OMDb] API key not configured, skipping')
        return null
    }

    // Input validation
    if (!title || title.trim().length === 0) {
        console.log('[OMDb] Empty title provided')
        return null
    }

    const cleanTitle = title.trim().substring(0, 300)

    // Helper to fetch and parse OMDb response
    async function fetchOmdb(url: string): Promise<any> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`OMDb API error: ${res.status}`)
        return res.json()
    }

    try {
        console.log(`[OMDb] Fetching data for: ${cleanTitle}`)

        // Try exact title match first (most common case)
        let url = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&apikey=${apiKey}`
        let data = await fetchOmdb(url)

        // If not found, try searching for TV series specifically
        if (data.Response === 'False') {
            console.log(`[OMDb] Exact match not found, trying series search: ${title}`)
            url = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&type=series&apikey=${apiKey}`
            data = await fetchOmdb(url)
        }

        // If still not found, try a broader search and take the first result
        if (data.Response === 'False') {
            console.log(`[OMDb] Series not found, trying search: ${title}`)
            url = `https://www.omdbapi.com/?s=${encodeURIComponent(cleanTitle)}&apikey=${apiKey}`
            const searchData = await fetchOmdb(url)

            if (searchData.Response === 'True' && searchData.Search?.[0]) {
                // Get full details for the first search result
                const imdbId = searchData.Search[0].imdbID
                url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`
                data = await fetchOmdb(url)
            }
        }

        if (data.Response === 'False') {
            console.log(`[OMDb] Not found after all attempts: ${title}`)
            return null
        }

        // Use appropriate subtitle based on content type
        const isSeries = data.Type === 'series'
        const subtitle = isSeries
            ? (data.Writer && data.Writer !== 'N/A' ? `Creator: ${data.Writer.split(',')[0]}` : `${data.Year}`)
            : (data.Director && data.Director !== 'N/A' ? `Director: ${data.Director}` : `${data.Year}`)

        // Upgrade http:// → https:// to avoid mixed-content blocking on the HTTPS frontend
        const toHttps = (url?: string) => url ? url.replace(/^http:\/\//, 'https://') : undefined
        const poster = data.Poster !== 'N/A' ? toHttps(data.Poster) : undefined

        const metadata: EnrichmentMetadata = {
            image: poster,
            thumbnail: poster,
            subtitle,
            description: data.Plot && data.Plot !== 'N/A' ? extractBriefDescription(data.Plot) : undefined,
            tags: data.Genre ? data.Genre.split(', ').slice(0, 3) : [],
            link: `https://www.imdb.com/title/${data.imdbID}/`,
            specs: {
                ...(data.Year ? { Year: data.Year } : {}),
                ...(data.Runtime && data.Runtime !== 'N/A' ? { Runtime: data.Runtime } : {}),
                ...(data.imdbRating && data.imdbRating !== 'N/A' ? { Rating: data.imdbRating } : {}),
            },
            source: 'omdb'
        }

        console.log(`[OMDb] Successfully enriched: ${title} (${data.Type})`)
        return metadata

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error(`[OMDb] Request timeout for ${cleanTitle}`)
        } else {
            console.error(`[OMDb] Failed for ${cleanTitle}:`, error.message)
        }
        return null
    }
}

/**
 * Google Books API - Requires GOOGLE_BOOKS_API_KEY env var
 * Free tier: Unlimited (within fair use)
 * Get key: https://developers.google.com/books/docs/v1/using
 */
export async function enrichBook(title: string): Promise<EnrichmentMetadata | null> {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY

    if (!apiKey) {
        console.log('[Google Books] API key not configured, skipping')
        return null
    }

    // Input validation
    if (!title || title.trim().length === 0) {
        console.log('[Google Books] Empty title provided')
        return null
    }

    const cleanTitle = title.trim().substring(0, 300)

    try {
        console.log(`[Google Books] Fetching data for: ${cleanTitle}`)

        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanTitle)}&key=${apiKey}`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) {
            throw new Error(`Google Books API error: ${res.status}`)
        }

        const data: any = await res.json()

        if (!data.items?.[0]) {
            console.log(`[Google Books] Not found: ${title}`)
            return null
        }

        const book = data.items[0].volumeInfo

        // Google Books returns http:// URLs — upgrade to https:// to avoid
        // mixed-content blocking on the HTTPS frontend
        const toHttps = (url?: string) => url ? url.replace(/^http:\/\//, 'https://') : undefined

        const metadata: EnrichmentMetadata = {
            image: toHttps(book.imageLinks?.large || book.imageLinks?.medium || book.imageLinks?.thumbnail),
            thumbnail: toHttps(book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail),
            subtitle: `Author: ${book.authors?.[0] || 'Unknown'}`,
            description: book.description ? extractBriefDescription(book.description) : undefined,
            tags: book.categories?.slice(0, 3) || [],
            link: book.infoLink,
            specs: {
                year: book.publishedDate?.split('-')[0],
                pages: book.pageCount,
                publisher: book.publisher
            },
            source: 'google-books'
        }

        console.log(`[Google Books] Successfully enriched: ${title}`)
        return metadata

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error(`[Google Books] Request timeout for ${cleanTitle}`)
        } else {
            console.error(`[Google Books] Failed for ${cleanTitle}:`, error.message)
        }
        return null
    }
}

/**
 * Open Library Covers API - No key required
 * Fetches a book cover image URL by title search
 */
export async function fetchOpenLibraryCover(title: string): Promise<string | null> {
    if (!title || title.trim().length === 0) return null

    const cleanTitle = title.trim().substring(0, 200)

    try {
        const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&limit=1&fields=cover_i`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(searchUrl, { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) return null

        const data: any = await res.json()
        const coverId = data.docs?.[0]?.cover_i
        if (!coverId) return null

        console.log(`[Open Library] Found cover for: ${cleanTitle}`)
        return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    } catch {
        return null
    }
}

/**
 * Helper: Extract relevant tags from Wikipedia summary text
 */
const WIKI_STOP_WORDS = new Set([
    'The','This','That','These','Those','A','An','In','Of','On','At','To','For',
    'With','By','From','And','Or','But','Is','Are','Was','Were','Has','Have','Had',
    'Be','Been','Being','Do','Does','Did','Will','Would','Could','Should','May',
    'Might','Must','Shall','Can','Not','No','Nor','So','Yet','Both','Either',
    'Neither','It','Its','He','She','They','We','You','His','Her','Their','Our',
    'Your','My','Who','Which','When','Where','How','What','While','After','Before',
    'Between','During','Through','About','Over','Under','Above','Also','Then',
    'Than','More','Most','Some','Such','Each','Any','All','New','First','Last',
])

function extractTagsFromSummary(text: string): string[] {
    const keywords = text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)*\b/g) || []
    return keywords.filter(k => !WIKI_STOP_WORDS.has(k) && k.length >= 4).slice(0, 3)
}

/**
 * Helper: Extract brief 2-line description from text (max ~140 chars)
 */
function extractBriefDescription(text: string): string {
    if (!text) return ''

    // Remove HTML tags if present
    const cleanText = text.replace(/<[^>]*>/g, '')

    // Get first 1-2 sentences
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    let description = sentences[0]?.trim() || ''

    // Add second sentence if first is very short
    if (description.length < 80 && sentences[1]) {
        description += '. ' + sentences[1].trim()
    }

    // Limit to ~140 characters (approximately 2 lines)
    if (description.length > 140) {
        description = description.substring(0, 137) + '...'
    }

    return description
}
