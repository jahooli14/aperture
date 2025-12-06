import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Article, ArticleHighlight } from '../types/reading'

async function fetchArticle(id: string) {
    // Try to fetch from API first (which handles extraction if needed)
    const response = await fetch(`/api/reading?id=${id}`)
    if (!response.ok) {
        // Fallback to Supabase directly if API fails
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        return { article: data as Article, highlights: [] as ArticleHighlight[] }
    }

    return response.json() as Promise<{ article: Article; highlights: ArticleHighlight[] }>
}

export function useArticle(id: string | undefined) {
    return useQuery({
        queryKey: ['article', id],
        queryFn: () => fetchArticle(id!),
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}
