import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useReadingStore } from '../stores/useReadingStore'
import type { Article } from '../types/reading'

// Fetch articles from Supabase
const fetchArticles = async () => {
    const { data, error } = await supabase
        .from('reading_queue')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as Article[]
}

export function useReadingQueue() {
    const { setArticles, setLoading, articles: storeArticles, lastFetched } = useReadingStore()
    const lastSyncedRef = useRef<number | null>(null)

    const query = useQuery({
        queryKey: ['articles'],
        queryFn: fetchArticles,
        // Don't refetch too aggressively - let Zustand store handle most fetches
        staleTime: 1000 * 60 * 2, // 2 minutes
    })

    // Sync React Query state to Zustand store
    // IMPORTANT: Only sync if:
    // 1. We have actual data
    // 2. Zustand store hasn't been updated more recently by fetchArticles()
    // 3. The data is different from what's in the store
    useEffect(() => {
        if (!query.data || query.data.length === 0) return

        const storeState = useReadingStore.getState()

        // If Zustand store was fetched more recently than our last sync, skip
        // This prevents React Query from overwriting fresher data from fetchArticles()
        if (storeState.lastFetched && lastSyncedRef.current && storeState.lastFetched > lastSyncedRef.current) {
            return
        }

        // Only sync if store is empty or this is initial load
        if (storeState.articles.length === 0) {
            setArticles(query.data)
            lastSyncedRef.current = Date.now()
        }
    }, [query.data, setArticles])

    useEffect(() => {
        // Only set loading if store has no articles (prevents flash during navigation)
        if (query.isLoading && storeArticles.length === 0) {
            setLoading(true)
        } else if (!query.isLoading) {
            setLoading(false)
        }
    }, [query.isLoading, setLoading, storeArticles.length])

    return query
}
