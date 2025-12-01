/**
 * Environment Variable Validation
 * Validates all required environment variables on module load
 * Fails fast with clear error messages if configuration is invalid
 */

import { z } from 'zod'

const EnvSchema = z.object({
  // Supabase
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // AI APIs
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  // Optional Configuration
  USER_ID: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production')
})

export type Env = z.infer<typeof EnvSchema>

// Validate on module load
let validatedEnv: Env

try {
  validatedEnv = EnvSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment variable validation failed:')
    error.issues.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`)
    })
    console.error('\nPlease check your environment variables and try again.')
    process.exit(1)
  }
  throw error
}

export const env = validatedEnv

/**
 * Get Supabase client configuration
 */
export function getSupabaseConfig() {
  return {
    url: env.VITE_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  }
}

/**
 * Get Gemini AI configuration
 */
export function getGeminiConfig() {
  return {
    apiKey: env.GEMINI_API_KEY
  }
}

/**
 * Check if running in production
 */
export function isProduction() {
  return env.NODE_ENV === 'production'
}

/**
 * Check if running in development
 */
export function isDevelopment() {
  return env.NODE_ENV === 'development'
}

/**
 * Get user ID (for single-user deployment)
 */
export function getUserId() {
  return env.USER_ID || 'default-user'
}
