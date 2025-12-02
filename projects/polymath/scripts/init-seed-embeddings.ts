#!/usr/bin/env tsx
/**
 * Generate embeddings for seed canonical tags
 * Run once after canonical tags migration
 *
 * Usage: npx tsx scripts/init-seed-embeddings.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local first (local overrides)
config({ path: resolve(process.cwd(), '.env.local') })
// Load .env.production.local as fallback
config({ path: resolve(process.cwd(), '.env.production.local') })

import { generateSeedEmbeddings } from '../api/lib/tag-normalizer.js'

async function main() {
  console.log('🚀 Starting seed tag embedding generation...')
  console.log('')

  try {
    await generateSeedEmbeddings()
    console.log('')
    console.log('✅ Success! All seed tags now have embeddings.')
    console.log('🎉 Tag normalization system is ready to use!')
    process.exit(0)
  } catch (error) {
    console.error('')
    console.error('❌ Failed to generate seed embeddings:')
    console.error(error)
    console.error('')
    console.error('Troubleshooting:')
    console.error('1. Check your .env has VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY')
    console.error('2. Verify canonical_tags table exists in Supabase')
    console.error('3. Check Supabase project is not paused')
    process.exit(1)
  }
}

main()
