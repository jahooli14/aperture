/**
 * Environment configuration for milestone tracker
 */
import 'dotenv/config'

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('SUPABASE_URL is required')
  }

  if (!serviceRoleKey && !anonKey) {
    throw new Error('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required')
  }

  return {
    url,
    serviceRoleKey: serviceRoleKey || '',
    anonKey: anonKey || ''
  }
}

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for milestone detection')
  }

  return {
    apiKey
  }
}
