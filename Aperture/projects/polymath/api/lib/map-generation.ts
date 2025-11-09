/**
 * Knowledge Map Generation Logic - REDESIGNED
 * Uses semantic embeddings and clustering to create meaningful geographic layout
 */

import { getSupabaseClient } from './supabase.js'
import { cosineSimilarity } from './gemini-embeddings.js'
import type { MapData, City, Road, Region } from '../../src/utils/mapTypes'

// Re-define types here for API usage
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

/**
 * Extract topics from text (simple keyword extraction)
 * Filters out common words and returns meaningful phrases
 */
function extractTopicsFromText(text: string, maxTopics: number = 3): string[] {
  if (!text) return []

  // Common words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'my', 'your',
    'our', 'their'
  ])

  // Split into words and filter
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word =>
      word.length > 3 && // At least 4 characters
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // Not just numbers
    )

  // Count word frequency
  const wordFreq = new Map<string, number>()
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1
  })

  // Get top N words by frequency
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([word]) => word)

  return topWords
}

/**
 * K-means clustering implementation for semantic grouping
 */
function kMeansClustering(
  embeddings: Array<{ id: string; vector: number[]; topic: string }>,
  k: number,
  maxIterations: number = 10
): Map<number, Array<{ id: string; topic: string; vector: number[] }>> {
  if (embeddings.length === 0 || k === 0) {
    return new Map()
  }

  // Adjust k if we have fewer items than clusters
  const actualK = Math.min(k, embeddings.length)

  // Initialize centroids randomly from existing embeddings
  const centroids: number[][] = []
  const usedIndices = new Set<number>()

  while (centroids.length < actualK) {
    const idx = Math.floor(Math.random() * embeddings.length)
    if (!usedIndices.has(idx)) {
      centroids.push([...embeddings[idx].vector])
      usedIndices.add(idx)
    }
  }

  let clusters = new Map<number, Array<{ id: string; topic: string; vector: number[] }>>()

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each embedding to nearest centroid
    clusters.clear()
    for (let i = 0; i < actualK; i++) {
      clusters.set(i, [])
    }

    embeddings.forEach(emb => {
      let bestCluster = 0
      let bestSimilarity = -1

      for (let i = 0; i < actualK; i++) {
        const similarity = cosineSimilarity(emb.vector, centroids[i])
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestCluster = i
        }
      }

      clusters.get(bestCluster)!.push(emb)
    })

    // Recalculate centroids
    let changed = false
    for (let i = 0; i < actualK; i++) {
      const clusterMembers = clusters.get(i)!
      if (clusterMembers.length === 0) continue

      const newCentroid = new Array(embeddings[0].vector.length).fill(0)
      clusterMembers.forEach(emb => {
        emb.vector.forEach((val, idx) => {
          newCentroid[idx] += val
        })
      })
      newCentroid.forEach((val, idx) => {
        newCentroid[idx] = val / clusterMembers.length
      })

      // Check if centroid changed significantly
      const diff = Math.sqrt(
        centroids[i].reduce((sum, val, idx) => sum + Math.pow(val - newCentroid[idx], 2), 0)
      )
      if (diff > 0.001) changed = true

      centroids[i] = newCentroid
    }

    // Converged
    if (!changed) break
  }

  return clusters
}

/**
 * Force-directed layout algorithm
 * Places cities based on semantic similarity and connections
 */
function forceDirectedLayout(
  cities: Array<{ id: string; topic: string; cluster: number; population: number }>,
  roads: Array<{ fromId: string; toId: string; strength: number }>,
  clusterCenters: Map<number, { x: number; y: number }>,
  iterations: number = 50
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const velocities = new Map<string, { x: number; y: number }>()

  // Initialize positions near cluster centers with some randomness
  cities.forEach(city => {
    const clusterCenter = clusterCenters.get(city.cluster) || { x: 500, y: 500 }
    positions.set(city.id, {
      x: clusterCenter.x + (Math.random() - 0.5) * 200,
      y: clusterCenter.y + (Math.random() - 0.5) * 200
    })
    velocities.set(city.id, { x: 0, y: 0 })
  })

  // Force simulation parameters
  const REPULSION_STRENGTH = 5000
  const ATTRACTION_STRENGTH = 0.01
  const CLUSTER_STRENGTH = 0.02
  const DAMPING = 0.8

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>()
    cities.forEach(city => forces.set(city.id, { x: 0, y: 0 }))

    // Repulsion between all cities (prevents overlap)
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const cityA = cities[i]
        const cityB = cities[j]
        const posA = positions.get(cityA.id)!
        const posB = positions.get(cityB.id)!

        const dx = posB.x - posA.x
        const dy = posB.y - posA.y
        const distSq = dx * dx + dy * dy + 0.01 // Avoid division by zero
        const dist = Math.sqrt(distSq)

        const force = REPULSION_STRENGTH / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        const forceA = forces.get(cityA.id)!
        const forceB = forces.get(cityB.id)!
        forceA.x -= fx
        forceA.y -= fy
        forceB.x += fx
        forceB.y += fy
      }
    }

    // Attraction along roads (keeps connected cities close)
    roads.forEach(road => {
      const posFrom = positions.get(road.fromId)
      const posTo = positions.get(road.toId)
      if (!posFrom || !posTo) return

      const dx = posTo.x - posFrom.x
      const dy = posTo.y - posFrom.y

      const force = ATTRACTION_STRENGTH * road.strength
      const fx = dx * force
      const fy = dy * force

      const forceFrom = forces.get(road.fromId)!
      const forceTo = forces.get(road.toId)!
      forceFrom.x += fx
      forceFrom.y += fy
      forceTo.x -= fx
      forceTo.y -= fy
    })

    // Attraction to cluster center (keeps regions cohesive)
    cities.forEach(city => {
      const pos = positions.get(city.id)!
      const clusterCenter = clusterCenters.get(city.cluster) || { x: 500, y: 500 }

      const dx = clusterCenter.x - pos.x
      const dy = clusterCenter.y - pos.y

      const force = CLUSTER_STRENGTH
      const fx = dx * force
      const fy = dy * force

      const cityForce = forces.get(city.id)!
      cityForce.x += fx
      cityForce.y += fy
    })

    // Apply forces to velocities and update positions
    cities.forEach(city => {
      const force = forces.get(city.id)!
      const vel = velocities.get(city.id)!
      const pos = positions.get(city.id)!

      vel.x = (vel.x + force.x) * DAMPING
      vel.y = (vel.y + force.y) * DAMPING

      pos.x += vel.x
      pos.y += vel.y

      // Keep within bounds (with padding)
      pos.x = Math.max(100, Math.min(3900, pos.x))
      pos.y = Math.max(100, Math.min(2900, pos.y))
    })
  }

  return positions
}

/**
 * Generate initial knowledge map from user data
 * REDESIGNED: Uses semantic embeddings and clustering
 */
export async function generateInitialMap(userId: string): Promise<MapData> {
  const supabase = getSupabaseClient()

  console.log('[map-generation] 🗺️ Generating semantic knowledge map for user:', userId)

  // 1. Fetch all user's data with embeddings
  // NOTE: memories table doesn't have user_id column - it's a single-user app
  const [
    { data: memories },
    { data: projects },
    { data: articles }
  ] = await Promise.all([
    supabase.from('memories').select('*').not('embedding', 'is', null).limit(1000),
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('reading_queue').select('*').eq('user_id', userId).not('embedding', 'is', null)
  ])

  console.log('[map-generation] Fetched data:', {
    memories: memories?.length || 0,
    projects: projects?.length || 0,
    articles: articles?.length || 0
  })

  // 2. Collect all items with embeddings for direct semantic clustering
  interface Item {
    id: string
    type: 'thought' | 'project' | 'article'
    title: string
    embedding: number[]
    timestamp: string
  }

  const allItems: Item[] = []

  // Collect memories
  memories?.forEach(m => {
    if (m.embedding) {
      allItems.push({
        id: m.id,
        type: 'thought',
        title: m.title || 'Untitled thought',
        embedding: typeof m.embedding === 'string' ? JSON.parse(m.embedding) : m.embedding,
        timestamp: m.created_at
      })
    }
  })

  // Collect projects
  projects?.forEach(p => {
    if (p.embedding) {
      allItems.push({
        id: p.id,
        type: 'project',
        title: p.title,
        embedding: typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding,
        timestamp: p.created_at
      })
    }
  })

  // Collect articles
  articles?.forEach(a => {
    if (a.embedding) {
      allItems.push({
        id: a.id,
        type: 'article',
        title: a.title,
        embedding: typeof a.embedding === 'string' ? JSON.parse(a.embedding) : a.embedding,
        timestamp: a.created_at
      })
    }
  })

  console.log('[map-generation] Collected items with embeddings:', allItems.length)

  if (allItems.length === 0) {
    console.log('[map-generation] No items with embeddings found')
    return {
      cities: [],
      roads: [],
      doors: [],
      regions: [],
      viewport: { x: 0, y: 0, scale: 1 },
      version: 1
    }
  }

  // 3. Semantic clustering using k-means on item embeddings directly
  const itemsForClustering = allItems.map(item => ({
    id: item.id,
    topic: item.title, // Use title as identifier
    vector: item.embedding
  }))

  console.log('[map-generation] Items for clustering:', itemsForClustering.length)

  // Determine optimal number of clusters (cities) based on item count
  // More items = more granular clustering
  const numClusters = Math.max(3, Math.min(20, Math.floor(Math.sqrt(allItems.length) * 2)))
  console.log('[map-generation] Creating', numClusters, 'semantic clusters')

  const clusters = kMeansClustering(itemsForClustering, numClusters)

  // 4. Generate meaningful labels for each cluster from its members
  function generateClusterLabel(clusterMembers: Array<{ id: string; topic: string }>): string {
    // Get all items in this cluster
    const items = clusterMembers.map(m => allItems.find(i => i.id === m.id)!).filter(Boolean)

    // Extract keywords from titles
    const allWords: string[] = []
    items.forEach(item => {
      const keywords = extractTopicsFromText(item.title, 5)
      allWords.push(...keywords)
    })

    // Count frequency
    const wordFreq = new Map<string, number>()
    allWords.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    })

    // Get most common word as label
    const topWord = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])[0]

    return topWord ? topWord[0] : `Cluster ${clusterMembers.length} items`
  }

  // 5. Define cluster centers for geographic layout (regions on map)
  const clusterCenters = new Map<number, { x: number; y: number }>()
  const mapWidth = 4000
  const mapHeight = 3000

  // Arrange cluster centers in a grid/circle pattern for visual appeal
  const gridSize = Math.ceil(Math.sqrt(numClusters))
  for (let i = 0; i < numClusters; i++) {
    const angle = (i / numClusters) * 2 * Math.PI
    const radius = Math.min(mapWidth, mapHeight) * 0.35
    clusterCenters.set(i, {
      x: mapWidth / 2 + Math.cos(angle) * radius,
      y: mapHeight / 2 + Math.sin(angle) * radius
    })
  }

  // 6. Create cities from clusters (each cluster becomes one city)
  const cities: City[] = []
  let cityIndex = 0

  clusters.forEach((members, clusterId) => {
    if (members.length === 0) return

    const cityId = `city-${cityIndex++}`
    const items = members.map(m => allItems.find(i => i.id === m.id)!).filter(Boolean)

    // Generate semantic label from cluster members
    const cityName = generateClusterLabel(members)

    // Get timestamps
    const timestamps = items.map(i => new Date(i.timestamp).getTime())
    const firstSeen = new Date(Math.min(...timestamps)).toISOString()
    const lastSeen = new Date(Math.max(...timestamps)).toISOString()

    cities.push({
      id: cityId,
      name: cityName,
      position: { x: 0, y: 0 }, // Will be set by force-directed layout
      population: members.length,
      size: getSizeFromPopulation(members.length),
      itemIds: members.map(m => m.id),
      founded: firstSeen,
      lastActive: lastSeen,
      cluster: clusterId
    })
  })

  console.log('[map-generation] Created cities from clusters:', cities.length)

  // 7. Create roads based on semantic similarity between cluster centroids
  const roads: Road[] = []

  // Calculate cluster centroids (average embedding)
  const clusterCentroids = new Map<number, number[]>()
  clusters.forEach((members, clusterId) => {
    if (members.length === 0) return

    const items = members.map(m => allItems.find(i => i.id === m.id)!).filter(Boolean)
    const embeddings = items.map(i => i.embedding)

    // Average all embeddings in cluster
    const centroid = new Array(embeddings[0].length).fill(0)
    embeddings.forEach(emb => {
      emb.forEach((val, idx) => {
        centroid[idx] += val
      })
    })
    centroid.forEach((val, idx) => {
      centroid[idx] = val / embeddings.length
    })

    clusterCentroids.set(clusterId, centroid)
  })

  // Create roads between semantically similar cities
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const cityA = cities[i]
      const cityB = cities[j]

      const centroidA = clusterCentroids.get(cityA.cluster)
      const centroidB = clusterCentroids.get(cityB.cluster)

      if (!centroidA || !centroidB) continue

      // Calculate semantic similarity between clusters
      const similarity = cosineSimilarity(centroidA, centroidB)

      // Only create road if similarity > 0.6 (semantically related)
      if (similarity > 0.6) {
        const strength = Math.round(similarity * 15) // Scale to 0-15 range
        roads.push({
          id: `road-${i}-${j}`,
          fromCityId: cityA.id,
          toCityId: cityB.id,
          strength,
          type: getRoadTypeFromStrength(strength),
          connectionIds: [], // No shared items since each cluster is independent
          built: new Date().toISOString(),
          lastTraveled: new Date().toISOString()
        })
      }
    }
  }

  console.log('[map-generation] Created roads (similarity > 0.6):', roads.length)

  // 8. Apply force-directed layout
  const cityLayoutData = cities.map(c => ({
    id: c.id,
    topic: c.name,
    cluster: c.cluster || 0,
    population: c.population
  }))

  const roadLayoutData = roads.map(r => ({
    fromId: r.fromCityId,
    toId: r.toCityId,
    strength: r.strength
  }))

  const positions = forceDirectedLayout(cityLayoutData, roadLayoutData, clusterCenters, 50)

  // Apply positions to cities
  cities.forEach(city => {
    const pos = positions.get(city.id)
    if (pos) {
      city.position = pos
    }
  })

  // 9. Create regions metadata (one region per cluster/city in this design)
  const regions: Region[] = []
  clusters.forEach((members, clusterId) => {
    if (members.length === 0) return

    const center = clusterCenters.get(clusterId)!
    const city = cities.find(c => c.cluster === clusterId)

    if (!city) return

    // Use city name as region name
    const regionName = `${city.name} Region`

    regions.push({
      id: `region-${clusterId}`,
      name: regionName,
      center,
      radius: 600,
      cityIds: [city.id],
      color: getRegionColor(clusterId)
    })
  })

  console.log('[map-generation] Created regions:', regions.length)

  return {
    cities,
    roads,
    doors: [],
    regions,
    viewport: { x: 0, y: 0, scale: 1 },
    version: 1
  }
}

/**
 * Get color for region based on cluster ID
 */
function getRegionColor(clusterId: number): string {
  const colors = [
    'rgba(59, 130, 246, 0.15)',   // Blue
    'rgba(139, 92, 246, 0.15)',   // Purple
    'rgba(16, 185, 129, 0.15)',   // Green
    'rgba(251, 191, 36, 0.15)',   // Gold
    'rgba(239, 68, 68, 0.15)',    // Red
    'rgba(6, 182, 212, 0.15)',    // Cyan
    'rgba(249, 115, 22, 0.15)',   // Orange
    'rgba(168, 85, 247, 0.15)'    // Violet
  ]
  return colors[clusterId % colors.length]
}
