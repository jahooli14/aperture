
import { useReadingStore } from '../src/stores/useReadingStore'

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString() },
        clear: () => { store = {} },
        removeItem: (key: string) => { delete store[key] }
    }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock fetch
let mockFetchResponse: any = null
let mockFetchError = false

// @ts-ignore
globalThis.fetch = ((url: string, options: any) => {
    if (mockFetchError) {
        return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: () => Promise.reject('Network error')
        })
    }
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFetchResponse)
    })
}) as any

// Simple assertion helper
function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`)
        },
        toHaveLength: (expected: number) => {
            if (actual.length !== expected) throw new Error(`Expected length ${expected}, got ${actual.length}`)
        },
        toMatch: (regex: RegExp) => {
            if (!regex.test(actual)) throw new Error(`Expected ${actual} to match ${regex}`)
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected ${actual} to be truthy`)
        }
    }
}

async function runTests() {
    console.log('Running Offline Reading Support Tests...')

    try {
        // Test 1: Optimistic save adds to pendingArticles on failure
        console.log('Test 1: Optimistic save adds to pendingArticles on failure')

        // Reset state
        useReadingStore.setState({ articles: [], pendingArticles: [] })
        localStorage.clear()
        mockFetchError = true

        const { saveArticle } = useReadingStore.getState()
        await saveArticle({ url: 'https://example.com' })

        const state = useReadingStore.getState()
        expect(state.pendingArticles).toHaveLength(1)
        expect(state.articles).toHaveLength(1)
        expect(state.articles[0].id).toMatch(/^temp-/)
        expect(localStorage.getItem('pending-articles')).toBeTruthy()
        console.log('✅ Test 1 Passed')

        // Test 2: Sync moves pending to real articles
        console.log('Test 2: Sync moves pending to real articles')

        // Setup pending state
        const tempId = 'temp-123'
        const pendingArticle = {
            id: tempId,
            url: 'https://example.com',
            title: 'Example',
            status: 'unread' as const,
            created_at: new Date().toISOString(),
            tags: [],
            user_id: 'user',
            processed: false,
            author: null,
            content: null,
            excerpt: null,
            published_date: null,
            read_time_minutes: null,
            thumbnail_url: null,
            favicon_url: null,
            source: null,
            read_at: null,
            archived_at: null,
            word_count: null,
            notes: null
        }

        useReadingStore.setState({
            pendingArticles: [pendingArticle],
            articles: [pendingArticle]
        })

        // Mock successful sync response
        mockFetchResponse = {
            article: {
                ...pendingArticle,
                id: 'real-id-123',
                title: 'Real Title'
            }
        }
        mockFetchError = false

        // Trigger sync
        await useReadingStore.getState().syncPendingArticles()

        const state2 = useReadingStore.getState()
        expect(state2.pendingArticles).toHaveLength(0)
        expect(state2.articles).toHaveLength(1)
        expect(state2.articles[0].id).toBe('real-id-123')
        expect(JSON.parse(localStorage.getItem('pending-articles') || '[]')).toHaveLength(0)
        console.log('✅ Test 2 Passed')

    } catch (error) {
        console.error('❌ Test Failed:', error)
        // @ts-ignore
        if (typeof process !== 'undefined') process.exit(1)
    }
}

runTests()
