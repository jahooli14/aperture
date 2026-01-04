import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
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
    const queryClient = useQueryClient()
    const { setArticles, setLoading, articles: storeArticles } = useReadingStore()

    const query = useQuery({
        queryKey: ['articles'],
        queryFn: fetchArticles,
    })

    // Sync React Query state to Zustand store
    // IMPORTANT: Only sync if we have actual data, never overwrite with empty/undefined
    useEffect(() => {
        if (query.data && query.data.length > 0 && query.data !== useReadingStore.getState().articles) {
            setArticles(query.data)
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
