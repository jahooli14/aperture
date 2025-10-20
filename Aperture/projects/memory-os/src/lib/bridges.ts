import { createClient } from '@supabase/supabase-js'
import type { Memory, BridgeCandidate } from '../types'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Find potential bridges (connections) for a new memory
 */
export async function findBridges(
  newMemory: Memory,
  embedding: number[]
): Promise<BridgeCandidate[]> {
  const bridges: BridgeCandidate[] = []

  // 1. Find entity matches
  if (newMemory.entities) {
    const entityBridges = await findEntityMatches(newMemory)
    bridges.push(...entityBridges)
  }

  // 2. Find semantic similarity matches
  const semanticBridges = await findSemanticMatches(newMemory, embedding)
  bridges.push(...semanticBridges)

  // 3. Find temporal proximity (recent memories within 7 days)
  const temporalBridges = await findTemporalMatches(newMemory)
  bridges.push(...temporalBridges)

  // Deduplicate (a memory might match on multiple criteria)
  const uniqueBridges = deduplicateBridges(bridges)

  // Sort by strength (highest first)
  return uniqueBridges.sort((a, b) => b.strength - a.strength)
}

/**
 * Find memories sharing entities (people, places, topics)
 */
async function findEntityMatches(newMemory: Memory): Promise<BridgeCandidate[]> {
  const { entities } = newMemory
  if (!entities) return []

  const allEntities = [
    ...entities.people,
    ...entities.places,
    ...entities.topics,
  ]

  if (allEntities.length === 0) return []

  // Query memories with overlapping entities
  const { data: memories, error } = await supabase
    .from('memories')
    .select('*')
    .neq('id', newMemory.id)
    .eq('processed', true)

  if (error || !memories) {
    console.error('[bridges] Entity query error:', error)
    return []
  }

  const candidates: BridgeCandidate[] = []

  for (const memory of memories) {
    if (!memory.entities) continue

    const memoryEntities = [
      ...(memory.entities.people || []),
      ...(memory.entities.places || []),
      ...(memory.entities.topics || []),
    ]

    const shared = allEntities.filter(e => memoryEntities.includes(e))

    if (shared.length > 0) {
      // Strength based on percentage of entities shared
      const strength = shared.length / Math.max(allEntities.length, memoryEntities.length)

      candidates.push({
        memory,
        bridge_type: 'entity_match',
        strength,
        entities_shared: shared,
        reason: `Shares ${shared.length} entities: ${shared.join(', ')}`,
      })
    }
  }

  return candidates
}

/**
 * Find memories with high semantic similarity (cosine similarity > 0.8)
 */
async function findSemanticMatches(
  newMemory: Memory,
  embedding: number[]
): Promise<BridgeCandidate[]> {
  // Use Supabase vector similarity search
  const { data, error } = await supabase.rpc('match_memories', {
    query_embedding: embedding,
    match_threshold: 0.8,
    match_count: 10,
  })

  if (error) {
    console.error('[bridges] Semantic search error:', error)
    return []
  }

  if (!data) return []

  return data
    .filter((match: any) => match.id !== newMemory.id)
    .map((match: any) => ({
      memory: match,
      bridge_type: 'semantic_similarity' as const,
      strength: match.similarity,
      reason: `High semantic similarity (${(match.similarity * 100).toFixed(0)}%)`,
    }))
}

/**
 * Find recent memories (within 7 days)
 */
async function findTemporalMatches(newMemory: Memory): Promise<BridgeCandidate[]> {
  const sevenDaysAgo = new Date(newMemory.created_at)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: memories, error } = await supabase
    .from('memories')
    .select('*')
    .neq('id', newMemory.id)
    .eq('processed', true)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error || !memories) {
    console.error('[bridges] Temporal query error:', error)
    return []
  }

  return memories.map(memory => {
    const daysDiff = Math.abs(
      (new Date(newMemory.created_at).getTime() - new Date(memory.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
    )

    // Strength inversely proportional to time difference (closer = stronger)
    const strength = 1 - (daysDiff / 7)

    return {
      memory,
      bridge_type: 'temporal_proximity' as const,
      strength,
      reason: `Recent memory (${Math.ceil(daysDiff)} days ago)`,
    }
  })
}

/**
 * Deduplicate bridges (keep strongest type for each memory pair)
 */
function deduplicateBridges(bridges: BridgeCandidate[]): BridgeCandidate[] {
  const bridgeMap = new Map<string, BridgeCandidate>()

  for (const bridge of bridges) {
    const key = bridge.memory.id

    if (!bridgeMap.has(key) || bridge.strength > bridgeMap.get(key)!.strength) {
      bridgeMap.set(key, bridge)
    }
  }

  return Array.from(bridgeMap.values())
}

/**
 * Store bridges in database
 */
export async function storeBridges(
  memoryId: string,
  candidates: BridgeCandidate[]
): Promise<void> {
  if (candidates.length === 0) return

  const bridgesToInsert = candidates.map(candidate => ({
    memory_a: memoryId,
    memory_b: candidate.memory.id,
    bridge_type: candidate.bridge_type,
    strength: candidate.strength,
    entities_shared: candidate.entities_shared || null,
  }))

  const { error } = await supabase.from('bridges').insert(bridgesToInsert)

  if (error) {
    console.error('[bridges] Store error:', error)
    throw error
  }

  console.log(`[bridges] Stored ${bridgesToInsert.length} bridges for memory ${memoryId}`)
}
