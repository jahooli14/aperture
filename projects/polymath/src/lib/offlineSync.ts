/**
 * Offline Sync Manager
 * Ensures articles and images are cached for offline reading
 */

import { readingDb } from './db'
import type { Article } from '../types/reading'

/**
 * Downloads and caches images from HTML content
 */
async function downloadImages(articleId: string, content: string): Promise<void> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const images = doc.querySelectorAll('img')

    const downloadPromises = Array.from(images).map(async (img) => {
        const src = img.getAttribute('src')
        if (!src) return

        try {
            // Check if already cached
            const cached = await readingDb.getCachedImage(src)
            if (cached) return

            // Download image
            const response = await fetch(src)
            if (!response.ok) throw new Error(`Failed to fetch ${src}`)

            const blob = await response.blob()

            // Cache in IndexedDB
            await readingDb.cacheImage(articleId, src, blob)
            console.log(`[OfflineSync] Cached image: ${src.substring(0, 50)}...`)
        } catch (error) {
            console.warn(`[OfflineSync] Failed to cache image ${src}:`, error)
        }
    })

    await Promise.allSettled(downloadPromises)
}

/**
 * Syncs a single article for offline reading
 */
export async function syncArticleForOffline(article: Article): Promise<void> {
    if (!article.content) return

    try {
        // 1. Check if already cached and images are cached
        const cached = await readingDb.articles.get(article.id)
        if (cached?.images_cached) return

        console.log(`[OfflineSync] Syncing article: ${article.title}`)

        // 2. Cache article metadata and content
        await readingDb.cacheArticle(article)

        // 3. Download and cache images
        await downloadImages(article.id, article.content)

        // 4. Mark as completely cached
        await readingDb.markImagesCached(article.id)

        console.log(`[OfflineSync] ✓ Sync complete: ${article.title}`)
    } catch (error) {
        console.error(`[OfflineSync] Failed to sync article ${article.id}:`, error)
    }
}

/**
 * Syncs all un-synced articles in the queue
 */
export async function syncAllArticlesForOffline(articles: Article[]): Promise<void> {
    if (!navigator.onLine) return

    // Filter for un-synced but processed articles
    const toSync = articles.filter(a => a.processed && a.content)

    // Limiting concurrency to avoid overwhelming the network
    const CONCURRENCY = 3
    for (let i = 0; i < toSync.length; i += CONCURRENCY) {
        const chunk = toSync.slice(i, i + CONCURRENCY)
        await Promise.all(chunk.map(syncArticleForOffline))
    }
}
