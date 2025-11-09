#!/usr/bin/env tsx
/**
 * Force regenerate the knowledge map
 * Deletes existing map state so the API will generate a fresh one
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceRoleKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)

async function main() {
  console.log('='.repeat(60))
  console.log('🗺️  Regenerating Knowledge Map')
  console.log('='.repeat(60))

  try {
    // Check current map state
    const { data: currentMap } = await supabase
      .from('knowledge_map_state')
      .select('*')
      .maybeSingle()

    if (currentMap) {
      console.log('\n📊 Current map state:')
      console.log(`  Cities: ${currentMap.map_data?.cities?.length || 0}`)
      console.log(`  Roads: ${currentMap.map_data?.roads?.length || 0}`)
      console.log(`  Version: ${currentMap.version}`)
      console.log(`  Updated: ${currentMap.updated_at}`)

      // Delete existing map
      console.log('\n🗑️  Deleting old map state...')
      const { error: deleteError } = await supabase
        .from('knowledge_map_state')
        .delete()
        .eq('user_id', currentMap.user_id)

      if (deleteError) {
        throw deleteError
      }

      console.log('✅ Old map deleted')
    } else {
      console.log('\nℹ️  No existing map found')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Map state cleared')
    console.log('='.repeat(60))
    console.log('\nNext time you visit the Knowledge Map page, a fresh map')
    console.log('will be generated with all your current data and embeddings.')
    console.log('\nOr run: curl https://clandestined.vercel.app/api/projects?resource=knowledge_map')

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
