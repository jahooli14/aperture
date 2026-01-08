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
            specs: {
                type: summary.type || 'article',
                lastModified: new Date(summary.timestamp).getFullYear().toString()
            },
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
 * TMDB API - Requires TMDB_API_KEY env var (better posters than OMDb)
 * Free tier: 1,000 calls/day
 * Get key: https://www.themoviedb.org/settings/api
 */
async function enrichFromTMDB(title: string): Promise<EnrichmentMetadata | null> {
    const apiKey = process.env.TMDB_API_KEY

    if (!apiKey) {
        console.log('[TMDB] API key not configured, skipping')
        return null
    }

    const cleanTitle = title.trim().substring(0, 300)

    async function fetchTMDB(url: string): Promise<any> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`)
        return res.json()
    }

    try {
        console.log(`[TMDB] Searching for: ${cleanTitle}`)

        // Search for movies first
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}`
        const searchData = await fetchTMDB(searchUrl)

        if (!searchData.results?.length) {
            console.log(`[TMDB] No movie results for: ${cleanTitle}`)
            return null
        }

        // Find exact title match (case-insensitive)
        const normalizedQuery = cleanTitle.toLowerCase().trim()
        let bestMatch = searchData.results.find((r: any) =>
            r.title?.toLowerCase().trim() === normalizedQuery
        )

        // If no exact match, take the first result (usually most relevant)
        if (!bestMatch) {
            console.log(`[TMDB] No exact match, using top result for: ${cleanTitle}`)
            bestMatch = searchData.results[0]
        } else {
            console.log(`[TMDB] Found exact title match for: ${cleanTitle}`)
        }

        // Get full details
        const detailsUrl = `https://api.themoviedb.org/3/movie/${bestMatch.id}?api_key=${apiKey}&append_to_response=credits`
        const details = await fetchTMDB(detailsUrl)

        const director = details.credits?.crew?.find((c: any) => c.job === 'Director')?.name
        const posterPath = details.poster_path
        const backdropPath = details.backdrop_path

        const metadata: EnrichmentMetadata = {
            image: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : undefined,
            thumbnail: posterPath ? `https://image.tmdb.org/t/p/w200${posterPath}` : undefined,
            subtitle: director ? `Director: ${director}` : `${details.release_date?.split('-')[0] || ''}`,
            description: details.overview ? extractBriefDescription(details.overview) : undefined,
            tags: details.genres?.slice(0, 3).map((g: any) => g.name) || [],
            link: `https://www.themoviedb.org/movie/${details.id}`,
            specs: {
                year: details.release_date?.split('-')[0],
                runtime: details.runtime ? `${details.runtime}min` : undefined,
                rating: details.vote_average?.toFixed(1),
                type: 'movie'
            },
            source: 'omdb' // Keep as 'omdb' for consistency with existing data
        }

        console.log(`[TMDB] Successfully enriched: ${title} → ${details.title}`)
        return metadata

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error(`[TMDB] Request timeout for ${cleanTitle}`)
        } else {
            console.error(`[TMDB] Failed for ${cleanTitle}:`, error.message)
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

    // Input validation
    if (!title || title.trim().length === 0) {
        console.log('[OMDb] Empty title provided')
        return null
    }

    const cleanTitle = title.trim().substring(0, 300)

    // Try TMDB first if available (better posters and exact matching)
    const tmdbResult = await enrichFromTMDB(cleanTitle)
    if (tmdbResult && tmdbResult.image) {
        return tmdbResult
    }

    if (!apiKey) {
        console.log('[OMDb] API key not configured, skipping')
        return tmdbResult // Return TMDB result even without poster if available
    }

    // Helper to fetch and parse OMDb response
    async function fetchOmdb(url: string): Promise<any> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`OMDb API error: ${res.status}`)
        return res.json()
    }

    // Helper to normalize titles for comparison
    function normalizeTitle(t: string): string {
        return t.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')    // Normalize spaces
            .trim()
    }

    try {
        console.log(`[OMDb] Fetching data for: ${cleanTitle}`)
        const normalizedQuery = normalizeTitle(cleanTitle)

        // Try exact title match first (most common case) - prioritize movies for ambiguous titles
        let url = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&type=movie&apikey=${apiKey}`
        let data = await fetchOmdb(url)

        // Verify the returned title actually matches what we searched for
        if (data.Response === 'True') {
            const normalizedResult = normalizeTitle(data.Title)
            if (normalizedResult !== normalizedQuery) {
                console.log(`[OMDb] Title mismatch: searched "${cleanTitle}" got "${data.Title}", continuing search...`)
                data = { Response: 'False' }
            }
        }

        // If movie not found, try without type restriction
        if (data.Response === 'False') {
            console.log(`[OMDb] Movie not found, trying without type restriction: ${cleanTitle}`)
            url = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&apikey=${apiKey}`
            data = await fetchOmdb(url)

            // Verify title match
            if (data.Response === 'True') {
                const normalizedResult = normalizeTitle(data.Title)
                if (normalizedResult !== normalizedQuery) {
                    console.log(`[OMDb] Title mismatch: searched "${cleanTitle}" got "${data.Title}", continuing search...`)
                    data = { Response: 'False' }
                }
            }
        }

        // If still not found, try a broader search and find exact match
        if (data.Response === 'False') {
            console.log(`[OMDb] Exact lookup failed, trying search with exact match filtering: ${cleanTitle}`)
            url = `https://www.omdbapi.com/?s=${encodeURIComponent(cleanTitle)}&apikey=${apiKey}`
            const searchData = await fetchOmdb(url)

            if (searchData.Response === 'True' && searchData.Search?.length) {
                // Find an EXACT title match first (case-insensitive)
                let exactMatch = searchData.Search.find((item: any) =>
                    normalizeTitle(item.Title) === normalizedQuery
                )

                // If no exact match, try matching just the main title (without year suffixes etc)
                if (!exactMatch) {
                    exactMatch = searchData.Search.find((item: any) => {
                        const itemTitle = normalizeTitle(item.Title)
                        return itemTitle === normalizedQuery ||
                               itemTitle.startsWith(normalizedQuery + ' ') ||
                               normalizedQuery.startsWith(itemTitle + ' ')
                    })
                }

                // If we found a match, prefer movies over series for ambiguous single-word titles
                if (!exactMatch && cleanTitle.split(' ').length === 1) {
                    // For single-word queries like "Drive", prefer movie
                    const movieMatch = searchData.Search.find((item: any) =>
                        normalizeTitle(item.Title) === normalizedQuery && item.Type === 'movie'
                    )
                    if (movieMatch) exactMatch = movieMatch
                }

                // Only use first result if it's reasonably close to what we searched
                if (!exactMatch) {
                    const firstResult = searchData.Search[0]
                    const firstTitle = normalizeTitle(firstResult.Title)
                    // Check if the first result contains our query or vice versa
                    if (firstTitle.includes(normalizedQuery) || normalizedQuery.includes(firstTitle)) {
                        console.log(`[OMDb] No exact match, but "${firstResult.Title}" contains query "${cleanTitle}"`)
                        exactMatch = firstResult
                    } else {
                        console.log(`[OMDb] No matching results - "${firstResult.Title}" doesn't match "${cleanTitle}"`)
                    }
                }

                if (exactMatch) {
                    console.log(`[OMDb] Found match in search results: "${exactMatch.Title}" (${exactMatch.Year})`)
                    const imdbId = exactMatch.imdbID
                    url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`
                    data = await fetchOmdb(url)
                }
            }
        }

        if (data.Response === 'False') {
            console.log(`[OMDb] Not found after all attempts: ${cleanTitle}`)
            return tmdbResult // Return TMDB result if available
        }

        // Use appropriate subtitle based on content type
        const isSeries = data.Type === 'series'
        const subtitle = isSeries
            ? (data.Writer && data.Writer !== 'N/A' ? `Creator: ${data.Writer.split(',')[0]}` : `${data.Year}`)
            : (data.Director && data.Director !== 'N/A' ? `Director: ${data.Director}` : `${data.Year}`)

        const metadata: EnrichmentMetadata = {
            image: data.Poster !== 'N/A' ? data.Poster : undefined,
            thumbnail: data.Poster !== 'N/A' ? data.Poster : undefined,
            subtitle,
            description: data.Plot && data.Plot !== 'N/A' ? extractBriefDescription(data.Plot) : undefined,
            tags: data.Genre ? data.Genre.split(', ').slice(0, 3) : [],
            link: `https://www.imdb.com/title/${data.imdbID}/`,
            specs: {
                year: data.Year,
                runtime: data.Runtime !== 'N/A' ? data.Runtime : undefined,
                rating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
                type: data.Type
            },
            source: 'omdb'
        }

        // If OMDb doesn't have a poster but TMDB did, use TMDB's poster
        if (!metadata.image && tmdbResult?.image) {
            metadata.image = tmdbResult.image
            metadata.thumbnail = tmdbResult.thumbnail
            console.log(`[OMDb] Using TMDB poster for: ${cleanTitle}`)
        }

        console.log(`[OMDb] Successfully enriched: ${cleanTitle} → ${data.Title} (${data.Type})`)
        return metadata

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error(`[OMDb] Request timeout for ${cleanTitle}`)
        } else {
            console.error(`[OMDb] Failed for ${cleanTitle}:`, error.message)
        }
        return tmdbResult // Return TMDB result on error if available
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

        const metadata: EnrichmentMetadata = {
            image: book.imageLinks?.large || book.imageLinks?.medium || book.imageLinks?.thumbnail,
            thumbnail: book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail,
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
 * Helper: Extract relevant tags from Wikipedia summary text
 */
function extractTagsFromSummary(text: string): string[] {
    // Simple keyword extraction - can be improved with NLP
    const keywords = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g) || []
    return keywords.slice(0, 3)
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
