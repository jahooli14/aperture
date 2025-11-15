import type { SelfHealingConfig } from './src/types'
import * as dotenv from 'dotenv'

dotenv.config()

export const config: SelfHealingConfig = {
  geminiApiKey: process.env.VITE_GEMINI_API_KEY || '',
  supabaseUrl: process.env.VITE_SUPABASE_URL || '',
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  autoApprove: process.env.SELF_HEALING_AUTO_APPROVE === 'true',
  autoApproveHighConfidence:
    process.env.SELF_HEALING_AUTO_APPROVE_HIGH_CONFIDENCE === 'true',
  confidenceThreshold: Number(process.env.SELF_HEALING_CONFIDENCE_THRESHOLD) || 0.6,
  maxRetries: Number(process.env.SELF_HEALING_MAX_RETRIES) || 3,
  timeout: Number(process.env.SELF_HEALING_TIMEOUT) || 5000,
  screenshotOnFailure: true,
  enableLogging: process.env.SELF_HEALING_ENABLE_LOGGING === 'true',
}
