import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useProjectStore } from '../stores/useProjectStore'
import type { Project } from '../types'

// Fetch projects from Supabase
const fetchProjects = async () => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })

    if (error) throw error
    return data as Project[]
}

export function useProjects() {
    const queryClient = useQueryClient()
    const { setProjects, setLoading, setError } = useProjectStore()

    const query = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
        // Sync with Zustand store for backward compatibility
        // This allows us to migrate gradually without breaking components that use the store
    })

    // Sync React Query state to Zustand store
    // Note: In a full migration, we would remove the store and use the hook directly
    useEffect(() => {
        if (query.data && query.data !== useProjectStore.getState().projects) {
            setProjects(query.data)
        }
    }, [query.data, setProjects])

    // Only update loading state if it changed to avoid infinite loops
    useEffect(() => {
        if (query.isLoading !== useProjectStore.getState().loading) {
            setLoading(query.isLoading)
        }
    }, [query.isLoading, setLoading])

    return query
}
