import { createClient } from '@supabase/supabase-js'
import { cosineSimilarity } from './gemini-embeddings.js'

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ConnectionCandidate {
  type: 'project' | 'thought' | 'article' | 'list_item'
  id: string
  title: string
  similarity: number
}

/**
 * Core logic to find and update connections for an item.
 * Enforces "Top 5 Dynamic" rule:
 * 1. Find all candidates with similarity > 0.55
 * 2. Sort by similarity (descending)
 * 3. Take top 5
 * 4. Delete existing AI connections for this source item
 * 5. Insert the new top 5 connections
 * 
 * Note: Preserves manual (user-created) connections.
 */
export async function updateItemConnections(
  sourceId: string,
  sourceType: 'project' | 'thought' | 'article' | 'list_item',
  sourceEmbedding: number[],
  userId: string
): Promise<void> {
  if (!sourceEmbedding) return

  const candidates: ConnectionCandidate[] = []

  // 1. Search Projects
  if (sourceType !== 'project') {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)

    if (projects) {
      for (const p of projects) {
        if (p.embedding) {
          const similarity = cosineSimilarity(sourceEmbedding, p.embedding)
          if (similarity > 0.55) {
            candidates.push({ type: 'project', id: p.id, title: p.title, similarity })
          }
        }
      }
    }
  }

  // 2. Search Memories (Thoughts)
  if (sourceType !== 'thought') {
    const { data: memories } = await supabase
      .from('memories')
      .select('id, title, body, embedding')
      // .eq('user_id', userId) // Memories table might not have user_id in some schemas, check if needed
      .neq('id', sourceId)
      .not('embedding', 'is', null)

    if (memories) {
      for (const m of memories) {
        if (m.embedding) {
          const similarity = cosineSimilarity(sourceEmbedding, m.embedding)
          if (similarity > 0.55) {
            candidates.push({
              type: 'thought',
              id: m.id,
              title: m.title || m.body?.slice(0, 50) || 'Untitled',
              similarity
            })
          }
        }
      }
    }
  }

  // 3. Search Articles
  if (sourceType !== 'article') {
    const { data: articles } = await supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .neq('id', sourceId)
      .not('embedding', 'is', null)

    if (articles) {
      for (const a of articles) {
        if (a.embedding) {
          const similarity = cosineSimilarity(sourceEmbedding, a.embedding)
          if (similarity > 0.55) {
            candidates.push({
              type: 'article',
              id: a.id,
              title: a.title || 'Untitled',
              similarity
            })
          }
        }
      }
    }
  }

  // 4. Search List Items (films, books, etc.)
  // This enables cross-pollination: "Rothko film" → "paint pouring project"
  if (sourceType !== 'list_item') {
    const { data: listItems } = await supabase
      .from('list_items')
      .select('id, content, metadata, embedding')
      .eq('user_id', userId)
      .neq('id', sourceId)
      .not('embedding', 'is', null)

    if (listItems) {
      for (const item of listItems) {
        if (item.embedding) {
          const similarity = cosineSimilarity(sourceEmbedding, item.embedding)
          if (similarity > 0.55) {
            candidates.push({
              type: 'list_item',
              id: item.id,
              title: item.content || item.metadata?.title || 'Untitled',
              similarity
            })
          }
        }
      }
    }
  }

  // 5. Sort and Take Top 5
  candidates.sort((a, b) => b.similarity - a.similarity)
  const topCandidates = candidates.slice(0, 5)

  if (topCandidates.length === 0) return

  // 5. Atomic Update: Delete old AI connections & Insert new ones

  // Delete existing AI connections where this item is source
  // We use user_id filter if table has it, otherwise just by source
  await supabase
    .from('connections')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('created_by', 'ai') // Only delete AI connections!

  // Also delete where this item is target (to keep graph clean? 
  // actually, bidirectionality is tricky. Let's just manage outbound for now 
  // to avoid deleting connections created by *other* items' top 5 logic).
  // Strategy: Each item is responsible for its own "outbound" AI connections.

  // Fetch all existing connections for this user that involve this item (any direction)
  // to avoid redundant connections (e.g. if B -> A already exists, don't create A -> B).
  const { data: existing } = await supabase
    .from('connections')
    .select('source_id, target_id')
    .eq('user_id', userId)
    .or(`source_id.eq.${sourceId},target_id.eq.${sourceId}`)

  const connectedIds = new Set<string>()
  existing?.forEach(c => {
    if (c.source_id === sourceId) connectedIds.add(c.target_id)
    else connectedIds.add(c.source_id)
  })

  // Insert new top 5, but ONLY if they aren't already connected
  const connectionsToInsert = topCandidates
    .filter(candidate => !connectedIds.has(candidate.id))
    .map(candidate => ({
      user_id: userId,
      source_type: sourceType,
      source_id: sourceId,
      target_type: candidate.type,
      target_id: candidate.id,
      connection_type: 'relates_to',
      created_by: 'ai',
      ai_reasoning: `${Math.round(candidate.similarity * 100)}% semantic match`
    }))

  if (connectionsToInsert.length > 0) {
    await supabase.from('connections').insert(connectionsToInsert)
  }
}
