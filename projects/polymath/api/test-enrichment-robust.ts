/**
 * Comprehensive enrichment testing endpoint
 * Tests all APIs, fallbacks, and error handling
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { enrichFilm, enrichBook, enrichFromWikipedia } from './_lib/enrichment-apis.js'

interface TestResult {
    test: string
    passed: boolean
    duration: number
    data?: any
    error?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const results: TestResult[] = []

    // Test 1: Wikipedia - Popular Film
    await runTest('Wikipedia: Popular Film (Inception)', async () => {
        const result = await enrichFromWikipedia('Inception')
        if (!result) throw new Error('No result returned')
        if (!result.subtitle) throw new Error('Missing subtitle')
        if (!result.tags || result.tags.length === 0) throw new Error('Missing tags')
        if (!result.link) throw new Error('Missing link')
        if (result.source !== 'wikipedia') throw new Error('Wrong source')
        return result
    }, results)

    // Test 2: Wikipedia - Book
    await runTest('Wikipedia: Popular Book (Harry Potter)', async () => {
        const result = await enrichFromWikipedia('Harry Potter and the Philosopher\'s Stone')
        if (!result) throw new Error('No result returned')
        if (!result.subtitle) throw new Error('Missing subtitle')
        if (!result.link) throw new Error('Missing link')
        return result
    }, results)

    // Test 3: Wikipedia - Obscure Item
    await runTest('Wikipedia: Obscure Item (should gracefully fail)', async () => {
        const result = await enrichFromWikipedia('xyzabc123notarealitem999')
        if (result !== null) throw new Error('Should return null for non-existent items')
        return { message: 'Correctly returned null' }
    }, results)

    // Test 4: Wikipedia - Person
    await runTest('Wikipedia: Person (Marie Curie)', async () => {
        const result = await enrichFromWikipedia('Marie Curie')
        if (!result) throw new Error('No result returned')
        if (!result.subtitle) throw new Error('Missing subtitle')
        if (!result.link) throw new Error('Missing link')
        return result
    }, results)

    // Test 5: Wikipedia - Place
    await runTest('Wikipedia: Place (Tokyo)', async () => {
        const result = await enrichFromWikipedia('Tokyo')
        if (!result) throw new Error('No result returned')
        if (!result.subtitle) throw new Error('Missing subtitle')
        if (!result.link) throw new Error('Missing link')
        return result
    }, results)

    // Test 6: OMDb (if configured)
    if (process.env.OMDB_API_KEY) {
        await runTest('OMDb: Film (The Matrix)', async () => {
            const result = await enrichFilm('The Matrix')
            if (!result) throw new Error('No result returned')
            if (!result.image) throw new Error('Missing image')
            if (!result.subtitle) throw new Error('Missing subtitle')
            if (!result.link || !result.link.includes('imdb.com')) throw new Error('Missing IMDb link')
            if (result.source !== 'omdb') throw new Error('Wrong source')
            return result
        }, results)
    }

    // Test 7: Google Books (if configured)
    if (process.env.GOOGLE_BOOKS_API_KEY) {
        await runTest('Google Books: Book (Dune)', async () => {
            const result = await enrichBook('Dune')
            if (!result) throw new Error('No result returned')
            if (!result.subtitle) throw new Error('Missing subtitle')
            if (result.source !== 'google-books') throw new Error('Wrong source')
            return result
        }, results)
    }

    // Test 8: Special Characters
    await runTest('Wikipedia: Special Characters (Amélie)', async () => {
        const result = await enrichFromWikipedia('Amélie')
        if (!result) throw new Error('No result returned')
        return result
    }, results)

    // Test 9: Very Long Title
    await runTest('Wikipedia: Long Title', async () => {
        const longTitle = 'The Lord of the Rings: The Fellowship of the Ring'
        const result = await enrichFromWikipedia(longTitle)
        if (!result) throw new Error('No result returned')
        return result
    }, results)

    // Calculate summary
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length

    return res.status(200).json({
        summary: {
            total: results.length,
            passed,
            failed,
            successRate: `${Math.round((passed / results.length) * 100)}%`,
            avgDuration: `${Math.round(avgDuration)}ms`
        },
        environment: {
            hasGeminiKey: !!process.env.GEMINI_API_KEY,
            hasOmdbKey: !!process.env.OMDB_API_KEY,
            hasGoogleBooksKey: !!process.env.GOOGLE_BOOKS_API_KEY
        },
        results
    })
}

async function runTest(
    name: string,
    testFn: () => Promise<any>,
    results: TestResult[]
): Promise<void> {
    const start = Date.now()
    try {
        const data = await testFn()
        const duration = Date.now() - start
        results.push({
            test: name,
            passed: true,
            duration,
            data
        })
        console.log(`✓ ${name} (${duration}ms)`)
    } catch (error: any) {
        const duration = Date.now() - start
        results.push({
            test: name,
            passed: false,
            duration,
            error: error.message
        })
        console.error(`✗ ${name} (${duration}ms): ${error.message}`)
    }
}
