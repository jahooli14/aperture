/**
 * Auto-Linking System: Connection Suggestion API
 * Automatically detects and creates bridges between memories based on:
 * - Entity overlap (shared people, places, topics)
 * - Semantic similarity (embedding distance)
 * - Temporal proximity (created around the same time)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

interface ConnectionRequest {
  contentType: 'memory' | 'project' | 'article'
  contentId: string
  contentText: string
  contentTitle: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { contentType, contentId, contentText, contentTitle }: ConnectionRequest = req.body

    if (!contentType || !contentId) {
      return res.status(400).json({ error: 'contentType and contentId required' })
    }

    // Only support memory-to-memory bridges for now
    if (contentType !== 'memory') {
      return res.status(200).json({
        success: true,
        message: 'Connection detection only supports memories currently',
        bridges_created: 0
      })
    }

    // Get the source memory to extract entities
    const { data: sourceMemory, error: fetchError } = await supabase
      .from('memories')
      .select('*')
      .eq('id', contentId)
      .single()

    if (fetchError || !sourceMemory) {
      return res.status(404).json({ error: 'Memory not found' })
    }

    const bridgesCreated: any[] = []

    // Strategy 1: Entity-based matching
    const entityBridges = await detectEntityMatches(sourceMemory)
    bridgesCreated.push(...entityBridges)

    // Strategy 2: Semantic similarity (embedding-based)
    if (sourceMemory.embedding) {
      const semanticBridges = await detectSemanticSimilarity(sourceMemory)
      bridgesCreated.push(...semanticBridges)
    }

    // Strategy 3: Temporal proximity
    const temporalBridges = await detectTemporalProximity(sourceMemory)
    bridgesCreated.push(...temporalBridges)

    // Deduplicate bridges (same memory pairs)
    const uniqueBridges = deduplicateBridges(bridgesCreated)

    // Insert bridges into database
    if (uniqueBridges.length > 0) {
      const { data, error: insertError } = await supabase
        .from('bridges')
        .insert(uniqueBridges)
        .select()

      if (insertError) {
        console.error('[api/connections/suggest] Insert error:', insertError)
      }

      return res.status(200).json({
        success: true,
        bridges_created: data?.length || 0,
        bridges: data
      })
    }

    return res.status(200).json({
      success: true,
      bridges_created: 0,
      message: 'No strong connections found'
    })

  } catch (error) {
    console.error('[api/connections/suggest] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Strategy 1: Find memories with shared entities
 */
async function detectEntityMatches(sourceMemory: any): Promise<any[]> {
  const bridges: any[] = []
  const sourceEntities = sourceMemory.entities

  if (!sourceEntities || Object.keys(sourceEntities).length === 0) {
    return bridges
  }

  // Get all entities from source memory
  const allSourceEntities = [
    ...(sourceEntities.people || []),
    ...(sourceEntities.places || []),
    ...(sourceEntities.topics || [])
  ]

  if (allSourceEntities.length === 0) {
    return bridges
  }

  // Find other memories with overlapping entities
  const { data: memories, error } = await supabase
    .from('memories')
    .select('id, entities, created_at')
    .neq('id', sourceMemory.id)
    .not('entities', 'is', null)
    .limit(100)

  if (error || !memories) return bridges

  for (const memory of memories) {
    const targetEntities = memory.entities
    if (!targetEntities) continue

    const allTargetEntities = [
      ...(targetEntities.people || []),
      ...(targetEntities.places || []),
      ...(targetEntities.topics || [])
    ]

    // Calculate entity overlap
    const sharedEntities = allSourceEntities.filter((e: string) =>
      allTargetEntities.includes(e)
    )

    if (sharedEntities.length >= 2) {
      // At least 2 shared entities to create a bridge
      const strength = Math.min(
        sharedEntities.length / Math.max(allSourceEntities.length, allTargetEntities.length),
        1.0
      )

      bridges.push({
        memory_a: sourceMemory.id,
        memory_b: memory.id,
        bridge_type: 'entity_match',
        strength: Math.round(strength * 100) / 100, // Round to 2 decimals
        entities_shared: sharedEntities,
        created_at: new Date().toISOString()
      })
    }
  }

  return bridges
}

/**
 * Strategy 2: Find semantically similar memories using embeddings
 */
async function detectSemanticSimilarity(sourceMemory: any): Promise<any[]> {
  const bridges: any[] = []

  // Call Supabase match_memories function (cosine similarity)
  const { data: matches, error } = await supabase.rpc('match_memories', {
    query_embedding: sourceMemory.embedding,
    match_threshold: 0.75, // 75% similarity threshold
    match_count: 5
  })

  if (error || !matches) {
    console.warn('[detectSemanticSimilarity] Error:', error)
    return bridges
  }

  for (const match of matches) {
    // Don't create bridge to self
    if (match.id === sourceMemory.id) continue

    bridges.push({
      memory_a: sourceMemory.id,
      memory_b: match.id,
      bridge_type: 'semantic_similarity',
      strength: Math.round(match.similarity * 100) / 100,
      entities_shared: null,
      created_at: new Date().toISOString()
    })
  }

  return bridges
}

/**
 * Strategy 3: Find memories created around the same time
 */
async function detectTemporalProximity(sourceMemory: any): Promise<any[]> {
  const bridges: any[] = []
  const sourceDate = new Date(sourceMemory.created_at)

  // Time window: within 7 days
  const beforeDate = new Date(sourceDate)
  beforeDate.setDate(beforeDate.getDate() - 7)

  const afterDate = new Date(sourceDate)
  afterDate.setDate(afterDate.getDate() + 7)

  const { data: memories, error } = await supabase
    .from('memories')
    .select('id, created_at')
    .neq('id', sourceMemory.id)
    .gte('created_at', beforeDate.toISOString())
    .lte('created_at', afterDate.toISOString())
    .limit(10)

  if (error || !memories) return bridges

  for (const memory of memories) {
    const memoryDate = new Date(memory.created_at)
    const daysDiff = Math.abs(
      (sourceDate.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Stronger connection for memories closer in time
    if (daysDiff <= 1) {
      const strength = 1.0 - (daysDiff / 7) // Max strength of 1.0 for same day

      bridges.push({
        memory_a: sourceMemory.id,
        memory_b: memory.id,
        bridge_type: 'temporal_proximity',
        strength: Math.round(strength * 100) / 100,
        entities_shared: null,
        created_at: new Date().toISOString()
      })
    }
  }

  return bridges
}

/**
 * Deduplicate bridges by memory pairs (avoid creating duplicate bridges)
 */
function deduplicateBridges(bridges: any[]): any[] {
  const seen = new Set<string>()
  const unique: any[] = []

  for (const bridge of bridges) {
    // Sort IDs to ensure consistent key regardless of order
    const [id1, id2] = [bridge.memory_a, bridge.memory_b].sort()
    const key = `${id1}:${id2}`

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(bridge)
    }
  }

  return unique
}
