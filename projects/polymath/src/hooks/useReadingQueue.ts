import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useReadingStore } from '../stores/useReadingStore'
import type { Article } from '../types/reading'

// Fetch articles from Supabase
const fetchArticles = async () => {
    const { data, error } = await supabase
        .from('articles')
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
    if (query.data && query.data !== useReadingStore.getState().articles) {
        setArticles(query.data)
    }

    if (query.isLoading !== useReadingStore.getState().loading) {
        setLoading(query.isLoading)
    }

    return query
}
