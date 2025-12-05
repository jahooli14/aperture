#!/usr/bin/env tsx
/**
 * Backfill Embeddings Script
 *
 * Generates embeddings and creates auto-connections for existing items that don't have embeddings yet.
 *
 * Usage:
 *   npm run backfill:embeddings [--type=projects|thoughts|articles|all] [--limit=50] [--dry-run] [--re-embed]
 *
 * Examples:
 *   npm run backfill:embeddings --type=projects --limit=10
 *   npm run backfill:embeddings --type=all --dry-run
 *   npm run backfill:embeddings --type=all --re-embed --limit=100
 */

// Load environment variables BEFORE any imports that validate env
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding, cosineSimilarity } from '../api/_lib/gemini-embeddings.js'

// Access env vars directly to avoid validation issues
const url = process.env.VITE_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceRoleKey)

interface BackfillOptions {
  type: 'projects' | 'thoughts' | 'articles' | 'all'
  limit: number
  dryRun: boolean
  reEmbed: boolean
}

interface BackfillStats {
  processed: number
  embeddings_created: number
  connections_created: number
  errors: number
}

/**
 * Parse command line arguments
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2)
  const options: BackfillOptions = {
    type: 'all',
    limit: 50,
    dryRun: false,
    reEmbed: false
  }

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      const type = arg.split('=')[1] as any
      if (['projects', 'thoughts', 'articles', 'all'].includes(type)) {
        options.type = type
      }
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--re-embed') {
      options.reEmbed = true
    }
  }

  return options
}

/**
 * Backfill projects
 */
async function backfillProjects(limit: number, dryRun: boolean, reEmbed: boolean): Promise<BackfillStats> {
  console.log(`\n[Projects] Finding items ${reEmbed ? 'to update' : 'without embeddings'} (limit: ${limit})...`)

  let query = supabase
    .from('projects')
    .select('id, title, description, user_id')
    
  if (!reEmbed) {
    query = query.is('embedding', null)
  }
    
  const { data: projects, error } = await query.limit(limit)

  if (error) {
    console.error('[Projects] Error fetching:', error)
    return { processed: 0, embeddings_created: 0, connections_created: 0, errors: 1 }
  }

  if (!projects || projects.length === 0) {
    console.log('[Projects] No items found')
    return { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }
  }

  console.log(`[Projects] Found ${projects.length} items`)

  const stats: BackfillStats = { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }

  for (const project of projects) {
    try {
      console.log(`[Projects] Processing: ${project.title}`)

      if (dryRun) {
        console.log('[Projects] DRY RUN - Would generate embedding and find connections')
        stats.processed++
        continue
      }

      // Generate embedding
      const content = `${project.title}\n\n${project.description || ''}`
      const embedding = await generateEmbedding(content)

      // Store embedding
      const { error: updateError } = await supabase
        .from('projects')
        .update({ embedding })
        .eq('id', project.id)

      if (updateError) {
        console.error(`[Projects] Failed to store embedding for ${project.id}:`, updateError)
        stats.errors++
        continue
      }

      stats.embeddings_created++

      // Find and create connections
      const connections = await findAndCreateConnections('project', project.id, project.user_id, embedding)
      stats.connections_created += connections

      stats.processed++
      console.log(`[Projects] ✅ ${project.title} - Created ${connections} connections`)

      // Rate limit: wait 100ms between items
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`[Projects] Error processing ${project.id}:`, error)
      stats.errors++
    }
  }

  return stats
}

/**
 * Backfill thoughts/memories
 */
async function backfillThoughts(limit: number, dryRun: boolean, reEmbed: boolean): Promise<BackfillStats> {
  console.log(`\n[Thoughts] Finding items ${reEmbed ? 'to update' : 'without embeddings'} (limit: ${limit})...`)

  let query = supabase
    .from('memories')
    .select('id, title, body, user_id')

  if (!reEmbed) {
    query = query.is('embedding', null)
  }

  const { data: memories, error } = await query.limit(limit)

  if (error) {
    console.error('[Thoughts] Error fetching:', error)
    return { processed: 0, embeddings_created: 0, connections_created: 0, errors: 1 }
  }

  if (!memories || memories.length === 0) {
    console.log('[Thoughts] No items found')
    return { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }
  }

  console.log(`[Thoughts] Found ${memories.length} items`)

  const stats: BackfillStats = { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }

  for (const memory of memories) {
    try {
      const title = memory.title || memory.body?.slice(0, 50) + '...'
      console.log(`[Thoughts] Processing: ${title}`)

      if (dryRun) {
        console.log('[Thoughts] DRY RUN - Would generate embedding and find connections')
        stats.processed++
        continue
      }

      // Generate embedding
      const content = `${memory.title || ''}\n\n${memory.body || ''}`
      const embedding = await generateEmbedding(content)

      // Store embedding
      const { error: updateError } = await supabase
        .from('memories')
        .update({ embedding })
        .eq('id', memory.id)

      if (updateError) {
        console.error(`[Thoughts] Failed to store embedding for ${memory.id}:`, updateError)
        stats.errors++
        continue
      }

      stats.embeddings_created++

      // Find and create connections
      const connections = await findAndCreateConnections('thought', memory.id, memory.user_id, embedding)
      stats.connections_created += connections

      stats.processed++
      console.log(`[Thoughts] ✅ ${title} - Created ${connections} connections`)

      // Rate limit: wait 100ms between items
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`[Thoughts] Error processing ${memory.id}:`, error)
      stats.errors++
    }
  }

  return stats
}

/**
 * Backfill articles
 */
async function backfillArticles(limit: number, dryRun: boolean, reEmbed: boolean): Promise<BackfillStats> {
  console.log(`\n[Articles] Finding items ${reEmbed ? 'to update' : 'without embeddings'} (limit: ${limit})...`)

  let query = supabase
    .from('reading_queue')
    .select('id, title, excerpt, user_id')
    .eq('processed', true)

  if (!reEmbed) {
    query = query.is('embedding', null)
  }

  const { data: articles, error } = await query.limit(limit)

  if (error) {
    console.error('[Articles] Error fetching:', error)
    return { processed: 0, embeddings_created: 0, connections_created: 0, errors: 1 }
  }

  if (!articles || articles.length === 0) {
    console.log('[Articles] No items found')
    return { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }
  }

  console.log(`[Articles] Found ${articles.length} items`)

  const stats: BackfillStats = { processed: 0, embeddings_created: 0, connections_created: 0, errors: 0 }

  for (const article of articles) {
    try {
      console.log(`[Articles] Processing: ${article.title}`)

      if (dryRun) {
        console.log('[Articles] DRY RUN - Would generate embedding and find connections')
        stats.processed++
        continue
      }

      // Generate embedding
      const content = `${article.title}\n\n${article.excerpt || ''}`
      const embedding = await generateEmbedding(content)

      // Store embedding
      const { error: updateError } = await supabase
        .from('reading_queue')
        .update({ embedding })
        .eq('id', article.id)

      if (updateError) {
        console.error(`[Articles] Failed to store embedding for ${article.id}:`, updateError)
        stats.errors++
        continue
      }

      stats.embeddings_created++

      // Find and create connections
      const connections = await findAndCreateConnections('article', article.id, article.user_id, embedding)
      stats.connections_created += connections

      stats.processed++
      console.log(`[Articles] ✅ ${article.title} - Created ${connections} connections`)

      // Rate limit: wait 100ms between items
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`[Articles] Error processing ${article.id}:`, error)
      stats.errors++
    }
  }

  return stats
}

/**
 * Find related items and create connections
 */
async function findAndCreateConnections(
  sourceType: 'project' | 'thought' | 'article',
  sourceId: string,
  userId: string,
  embedding: number[]
): Promise<number> {
  let connectionsCreated = 0

  const candidates: Array<{ type: 'project' | 'thought' | 'article'; id: string; similarity: number }> = []

  // Search projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, embedding')
    .eq('user_id', userId)
    .neq('id', sourceType === 'project' ? sourceId : '')
    .not('embedding', 'is', null)
    .limit(50)

  if (projects) {
    for (const p of projects) {
      if (p.embedding) {
        const similarity = cosineSimilarity(embedding, p.embedding)
        if (similarity > 0.7) {
          candidates.push({ type: 'project', id: p.id, similarity })
        }
      }
    }
  }

  // Search thoughts
  const { data: thoughts } = await supabase
    .from('memories')
    .select('id, title, embedding')
    .eq('user_id', userId)
    .neq('id', sourceType === 'thought' ? sourceId : '')
    .not('embedding', 'is', null)
    .limit(50)

  if (thoughts) {
    for (const t of thoughts) {
      if (t.embedding) {
        const similarity = cosineSimilarity(embedding, t.embedding)
        if (similarity > 0.7) {
          candidates.push({ type: 'thought', id: t.id, similarity })
        }
      }
    }
  }

  // Search articles
  const { data: articles } = await supabase
    .from('reading_queue')
    .select('id, title, embedding')
    .eq('user_id', userId)
    .neq('id', sourceType === 'article' ? sourceId : '')
    .not('embedding', 'is', null)
    .limit(50)

  if (articles) {
    for (const a of articles) {
      if (a.embedding) {
        const similarity = cosineSimilarity(embedding, a.embedding)
        if (similarity > 0.7) {
          candidates.push({ type: 'article', id: a.id, similarity })
        }
      }
    }
  }

  // Sort by similarity and auto-link >90%
  candidates.sort((a, b) => b.similarity - a.similarity)

  for (const candidate of candidates.slice(0, 10)) {
    if (candidate.similarity > 0.9) {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
        .maybeSingle()

      if (!existing) {
        const { error } = await supabase
          .from('connections')
          .insert({
            source_type: sourceType,
            source_id: sourceId,
            target_type: candidate.type,
            target_id: candidate.id,
            connection_type: 'relates_to',
            created_by: 'ai',
            ai_reasoning: `${Math.round(candidate.similarity * 100)}% semantic match (backfill)`
          })

        if (!error) {
          connectionsCreated++
        }
      }
    }
  }

  return connectionsCreated
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs()

  console.log('='.repeat(60))
  console.log('🔄 Backfill Embeddings & Auto-Connections')
  console.log('='.repeat(60))
  console.log(`Type: ${options.type}`)
  console.log(`Limit: ${options.limit} per type`)
  console.log(`Dry Run: ${options.dryRun}`)
  console.log(`Re-Embed: ${options.reEmbed}`)
  console.log('='.repeat(60))

  const totalStats: BackfillStats = {
    processed: 0,
    embeddings_created: 0,
    connections_created: 0,
    errors: 0
  }

  try {
    if (options.type === 'projects' || options.type === 'all') {
      const stats = await backfillProjects(options.limit, options.dryRun, options.reEmbed)
      totalStats.processed += stats.processed
      totalStats.embeddings_created += stats.embeddings_created
      totalStats.connections_created += stats.connections_created
      totalStats.errors += stats.errors
    }

    if (options.type === 'thoughts' || options.type === 'all') {
      const stats = await backfillThoughts(options.limit, options.dryRun, options.reEmbed)
      totalStats.processed += stats.processed
      totalStats.embeddings_created += stats.embeddings_created
      totalStats.connections_created += stats.connections_created
      totalStats.errors += stats.errors
    }

    if (options.type === 'articles' || options.type === 'all') {
      const stats = await backfillArticles(options.limit, options.dryRun, options.reEmbed)
      totalStats.processed += stats.processed
      totalStats.embeddings_created += stats.embeddings_created
      totalStats.connections_created += stats.connections_created
      totalStats.errors += stats.errors
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Backfill Complete')
    console.log('='.repeat(60))
    console.log(`Processed: ${totalStats.processed}`)
    console.log(`Embeddings Created: ${totalStats.embeddings_created}`)
    console.log(`Connections Created: ${totalStats.connections_created}`)
    console.log(`Errors: ${totalStats.errors}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  }
}

main()