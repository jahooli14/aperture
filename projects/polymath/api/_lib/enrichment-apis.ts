/**
 * External API clients for list item enrichment
 * Provides real data from OMDb, Google Books, Wikipedia
 */

interface EnrichmentMetadata {
    image?: string
    thumbnail?: string
    subtitle: string
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
    try {
        console.log(`[Wikipedia] Fetching data for: ${title}`)

        // Search for the article
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&format=json&origin=*`
        const searchRes = await fetch(searchUrl)
        const searchData: any = await searchRes.json()

        if (!searchData.query?.search?.[0]) {
            console.log(`[Wikipedia] No results found for: ${title}`)
            return null
        }

        const pageTitle = searchData.query.search[0].title

        // Get page summary and image
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
        const summaryRes = await fetch(summaryUrl)
        const summary: any = await summaryRes.json()

        // Extract metadata
        const metadata: EnrichmentMetadata = {
            subtitle: summary.description || summary.extract?.split('.')[0] || 'Wikipedia article',
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
        console.error(`[Wikipedia] Failed for ${title}:`, error.message)
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

    try {
        console.log(`[OMDb] Fetching data for: ${title}`)

        const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`
        const res = await fetch(url)
        const data: any = await res.json()

        if (data.Response === 'False') {
            console.log(`[OMDb] Not found: ${title}`)
            return null
        }

        const metadata: EnrichmentMetadata = {
            image: data.Poster !== 'N/A' ? data.Poster : undefined,
            thumbnail: data.Poster !== 'N/A' ? data.Poster : undefined,
            subtitle: `Director: ${data.Director}`,
            tags: data.Genre ? data.Genre.split(', ').slice(0, 3) : [],
            link: `https://www.imdb.com/title/${data.imdbID}/`,
            specs: {
                year: data.Year,
                runtime: data.Runtime,
                rating: data.imdbRating
            },
            source: 'omdb'
        }

        console.log(`[OMDb] Successfully enriched: ${title}`)
        return metadata

    } catch (error: any) {
        console.error(`[OMDb] Failed for ${title}:`, error.message)
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

    try {
        console.log(`[Google Books] Fetching data for: ${title}`)

        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&key=${apiKey}`
        const res = await fetch(url)
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
        console.error(`[Google Books] Failed for ${title}:`, error.message)
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
