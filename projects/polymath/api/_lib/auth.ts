/**
 * Authentication Helper
 * Extracts user ID from Supabase JWT in Authorization header.
 * Returns null if not authenticated — callers must handle 401.
 */
import { getSupabaseClient } from './supabase.js'

export async function getUserId(req?: any): Promise<string | null> {
    // Extract Bearer token from Authorization header
    const authHeader = req?.headers?.['authorization'] || req?.headers?.['Authorization']
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        try {
            const supabase = getSupabaseClient()
            const { data: { user }, error } = await supabase.auth.getUser(token)
            if (!error && user) return user.id
        } catch (e) {
            console.error('[auth] Failed to verify token:', e)
        }
    }
    return null
}
