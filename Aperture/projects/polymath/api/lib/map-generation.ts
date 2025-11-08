/**
 * Knowledge Map Generation Logic
 * Generates initial map from user's projects, memories, and articles
 */

import { getSupabaseClient } from './supabase.js'
import type { MapData, City, Road } from '../../src/utils/mapTypes'

// Re-define types here for API usage (since API can't import from src)
type CitySize = 'homestead' | 'village' | 'town' | 'city' | 'metropolis'
type RoadType = 'trail' | 'country' | 'main' | 'highway'

function getSizeFromPopulation(pop: number): CitySize {
  if (pop >= 50) return 'metropolis'
  if (pop >= 20) return 'city'
  if (pop >= 10) return 'town'
  if (pop >= 3) return 'village'
  return 'homestead'
}

function getRoadTypeFromStrength(strength: number): RoadType {
  if (strength >= 11) return 'highway'
  if (strength >= 6) return 'main'
  if (strength >= 3) return 'country'
  return 'trail'
}

function gridLayout(index: number, total: number): { x: number, y: number } {
  const cols = Math.ceil(Math.sqrt(total))
  const row = Math.floor(index / cols)
  const col = index % cols
  return {
    x: 200 + col * 300,
    y: 200 + row * 300
  }
}

/**
 * Generate initial knowledge map from user data
 */
export async function generateInitialMap(userId: string): Promise<MapData> {
  const supabase = getSupabaseClient()

  console.log('[map-generation] Generating initial map for user:', userId)

  // 1. Fetch all user's projects, thoughts, articles
  const [
    { data: projects },
    { data: memories },
    { data: articles }
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('memories').select('*').eq('user_id', userId),
    supabase.from('reading_queue').select('*').eq('user_id', userId)
  ])

  console.log('[map-generation] Fetched data:', {
    projects: projects?.length || 0,
    memories: memories?.length || 0,
    articles: articles?.length || 0
  })

  // 2. Extract all topics/capabilities/themes and count items
  const topicCounts = new Map<string, { items: Array<{id: string, type: string, timestamp: string}>, firstSeen: string, lastSeen: string }>()

  // Count projects by capability
  projects?.forEach(p => {
    const capabilities = p.metadata?.capabilities || []
    capabilities.forEach((cap: any) => {
      const topicName = typeof cap === 'string' ? cap : cap.name
      if (!topicCounts.has(topicName)) {
        topicCounts.set(topicName, {
          items: [],
          firstSeen: p.created_at,
          lastSeen: p.last_active || p.created_at
        })
      }
      const topic = topicCounts.get(topicName)!
      topic.items.push({ id: p.id, type: 'project', timestamp: p.created_at })
      // Update last seen if this is more recent
      if (new Date(p.last_active || p.created_at) > new Date(topic.lastSeen)) {
        topic.lastSeen = p.last_active || p.created_at
      }
    })
  })

  // Count memories by topic/entity
  memories?.forEach(m => {
    const topics = m.entities?.topics?.slice(0, 3) || []
    topics.forEach((topic: string) => {
      if (!topicCounts.has(topic)) {
        topicCounts.set(topic, {
          items: [],
          firstSeen: m.created_at,
          lastSeen: m.created_at
        })
      }
      const topicData = topicCounts.get(topic)!
      topicData.items.push({ id: m.id, type: 'thought', timestamp: m.created_at })
      if (new Date(m.created_at) > new Date(topicData.lastSeen)) {
        topicData.lastSeen = m.created_at
      }
    })
  })

  // Count articles by tags
  articles?.forEach(a => {
    const tags = a.tags || []
    tags.forEach((tag: string) => {
      if (!topicCounts.has(tag)) {
        topicCounts.set(tag, {
          items: [],
          firstSeen: a.created_at,
          lastSeen: a.created_at
        })
      }
      const topic = topicCounts.get(tag)!
      topic.items.push({ id: a.id, type: 'article', timestamp: a.created_at })
      if (new Date(a.created_at) > new Date(topic.lastSeen)) {
        topic.lastSeen = a.created_at
      }
    })
  })

  console.log('[map-generation] Found topics:', topicCounts.size)

  // 3. Create cities from topics with 1+ items
  const cities: City[] = Array.from(topicCounts.entries())
    .filter(([_, data]) => data.items.length > 0)
    .map(([name, data], index) => ({
      id: `city-${index}`,
      name,
      position: gridLayout(index, topicCounts.size),
      population: data.items.length,
      size: getSizeFromPopulation(data.items.length),
      itemIds: data.items.map(item => item.id),
      founded: data.firstSeen,
      lastActive: data.lastSeen
    }))

  console.log('[map-generation] Created cities:', cities.length)

  // 4. Create roads based on shared items between cities
  const roads: Road[] = []
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const cityA = cities[i]
      const cityB = cities[j]

      // Find shared items
      const shared = cityA.itemIds.filter(id => cityB.itemIds.includes(id))

      if (shared.length > 0) {
        roads.push({
          id: `road-${i}-${j}`,
          fromCityId: cityA.id,
          toCityId: cityB.id,
          strength: shared.length,
          type: getRoadTypeFromStrength(shared.length),
          connectionIds: shared,
          built: new Date().toISOString(),
          lastTraveled: new Date().toISOString()
        })
      }
    }
  }

  console.log('[map-generation] Created roads:', roads.length)

  return {
    cities,
    roads,
    doors: [], // No doors in initial map
    viewport: { x: 0, y: 0, scale: 1 },
    version: 1
  }
}
