import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 1 minute
            staleTime: 1000 * 60,
            // Keep unused data in cache for 5 minutes
            gcTime: 1000 * 60 * 5,
            // Retry failed requests twice
            retry: 2,
            // Don't refetch on window focus for now (can be distracting)
            refetchOnWindowFocus: false,
        },
    },
})
