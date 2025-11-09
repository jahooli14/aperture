#!/usr/bin/env tsx
/**
 * Quick script to check what data exists and whether embeddings are present
 */

// Load environment variables from .env.local BEFORE any imports that validate env
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// Access env vars directly instead of using env.ts to avoid validation
const url = process.env.VITE_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceRoleKey) {
  console.error('Missing required environment variables:')
  console.error('  VITE_SUPABASE_URL:', url ? '✅' : '❌')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)

async function main() {
  console.log('='.repeat(60))
  console.log('🔍 Checking Database State')
  console.log('='.repeat(60))

  try {
    // Check memories
    const { data: memories, error: memError } = await supabase
      .from('memories')
      .select('id, title, embedding')
      .limit(100)

    console.log('\n📝 MEMORIES:')
    console.log(`  Total: ${memories?.length || 0}`)
    console.log(`  With embeddings: ${memories?.filter(m => m.embedding != null).length || 0}`)
    console.log(`  Without embeddings: ${memories?.filter(m => m.embedding == null).length || 0}`)

    if (memories && memories.length > 0) {
      console.log('\n  Sample memories:')
      memories.slice(0, 5).forEach((m, i) => {
        console.log(`    ${i + 1}. ${m.title || 'Untitled'} ${m.embedding ? '✅' : '❌ no embedding'}`)
      })
    }

    // Check projects
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, title, embedding')
      .limit(100)

    console.log('\n\n🎯 PROJECTS:')
    console.log(`  Total: ${projects?.length || 0}`)
    console.log(`  With embeddings: ${projects?.filter(p => p.embedding != null).length || 0}`)
    console.log(`  Without embeddings: ${projects?.filter(p => p.embedding == null).length || 0}`)

    if (projects && projects.length > 0) {
      console.log('\n  Sample projects:')
      projects.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.title} ${p.embedding ? '✅' : '❌ no embedding'}`)
      })
    }

    // Check articles
    const { data: articles, error: artError } = await supabase
      .from('reading_queue')
      .select('id, title, embedding, processed')
      .limit(100)

    console.log('\n\n📚 ARTICLES:')
    console.log(`  Total: ${articles?.length || 0}`)
    console.log(`  Processed: ${articles?.filter(a => a.processed).length || 0}`)
    console.log(`  With embeddings: ${articles?.filter(a => a.embedding != null).length || 0}`)
    console.log(`  Without embeddings: ${articles?.filter(a => a.embedding == null).length || 0}`)

    if (articles && articles.length > 0) {
      console.log('\n  Sample articles:')
      articles.slice(0, 5).forEach((a, i) => {
        console.log(`    ${i + 1}. ${a.title} ${a.embedding ? '✅' : '❌ no embedding'}`)
      })
    }

    // Check knowledge map state
    const { data: mapState, error: mapError } = await supabase
      .from('knowledge_map_state')
      .select('*')
      .maybeSingle()

    console.log('\n\n🗺️  KNOWLEDGE MAP STATE:')
    if (mapError) {
      if (mapError.code === '42P01') {
        console.log('  ❌ Table does not exist - migration needed')
      } else {
        console.log('  ❌ Error:', mapError.message)
      }
    } else if (mapState) {
      console.log('  ✅ Map state exists')
      console.log(`  Version: ${mapState.version}`)
      console.log(`  Cities: ${mapState.map_data?.cities?.length || 0}`)
      console.log(`  Roads: ${mapState.map_data?.roads?.length || 0}`)
      console.log(`  Updated: ${mapState.updated_at}`)
    } else {
      console.log('  ℹ️  No map generated yet')
    }

    // Summary
    const totalItems = (memories?.length || 0) + (projects?.length || 0) + (articles?.length || 0)
    const totalWithEmbeddings =
      (memories?.filter(m => m.embedding != null).length || 0) +
      (projects?.filter(p => p.embedding != null).length || 0) +
      (articles?.filter(a => a.embedding != null).length || 0)

    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total items: ${totalItems}`)
    console.log(`Items with embeddings: ${totalWithEmbeddings}`)
    console.log(`Items without embeddings: ${totalItems - totalWithEmbeddings}`)

    if (totalItems === 0) {
      console.log('\n⚠️  NO DATA FOUND')
      console.log('You need to add some memories, projects, or articles first.')
    } else if (totalWithEmbeddings === 0) {
      console.log('\n⚠️  NO EMBEDDINGS FOUND')
      console.log('Run: npm run backfill:embeddings')
      console.log('This will generate embeddings for all existing items.')
    } else if (totalWithEmbeddings < totalItems) {
      console.log('\n⚠️  SOME ITEMS MISSING EMBEDDINGS')
      console.log('Run: npm run backfill:embeddings')
      console.log('This will generate embeddings for items that don\'t have them yet.')
    } else {
      console.log('\n✅ ALL ITEMS HAVE EMBEDDINGS')
      if (!mapState || (mapState.map_data?.cities?.length || 0) === 0) {
        console.log('But the map is empty. Try regenerating it from the UI.')
      }
    }
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
