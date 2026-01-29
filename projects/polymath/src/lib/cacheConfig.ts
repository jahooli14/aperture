/**
 * Centralized cache configuration constants
 * Used across the application for consistent caching behavior
 */

/**
 * Standard cache duration for data that updates moderately
 * Used for: memories, bridges, readings, connections, theme clusters
 */
export const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Periodic sync interval for background data synchronization
 */
export const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
