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
    const { setArticles, setLoading } = useReadingStore()

    const query = useQuery({
        queryKey: ['articles'],
        queryFn: fetchArticles,
    })

    // Sync React Query state to Zustand store
    useEffect(() => {
        if (query.data && query.data !== useReadingStore.getState().articles) {
            setArticles(query.data)
        }
    }, [query.data, setArticles])

    useEffect(() => {
        if (query.isLoading !== useReadingStore.getState().loading) {
            setLoading(query.isLoading)
        }
    }, [query.isLoading, setLoading])

    return query
}
