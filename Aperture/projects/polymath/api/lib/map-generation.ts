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

  // 2. Extract topics and their embeddings for semantic clustering
  interface TopicData {
    items: Array<{ id: string; type: string; timestamp: string }>
    embedding: number[] | null
    firstSeen: string
    lastSeen: string
  }

  const topicMap = new Map<string, TopicData>()

  // Process memories - use entities.topics for rich semantic content
  memories?.forEach(m => {
    const topics = m.entities?.topics || []
    const embedding = m.embedding ? (typeof m.embedding === 'string' ? JSON.parse(m.embedding) : m.embedding) : null

    topics.forEach((topic: string) => {
      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          items: [],
          embedding: null,
          firstSeen: m.created_at,
          lastSeen: m.created_at
        })
      }
      const topicData = topicMap.get(topic)!
      topicData.items.push({ id: m.id, type: 'thought', timestamp: m.created_at })

      // Use average embedding for topic (simple approach)
      if (embedding && !topicData.embedding) {
        topicData.embedding = embedding
      }

      if (new Date(m.created_at) > new Date(topicData.lastSeen)) {
        topicData.lastSeen = m.created_at
      }
    })
  })

  // Process projects - use capabilities + embeddings if available
  projects?.forEach(p => {
    const capabilities = p.metadata?.capabilities || []
    const embedding = p.embedding ? (typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding) : null

    capabilities.forEach((cap: any) => {
      const topicName = typeof cap === 'string' ? cap : cap.name
      if (!topicMap.has(topicName)) {
        topicMap.set(topicName, {
          items: [],
          embedding: null,
          firstSeen: p.created_at,
          lastSeen: p.last_active || p.created_at
        })
      }
      const topicData = topicMap.get(topicName)!
      topicData.items.push({ id: p.id, type: 'project', timestamp: p.created_at })

      // Use project embedding for topic if available
      if (embedding && !topicData.embedding) {
        topicData.embedding = embedding
      }

      if (new Date(p.last_active || p.created_at) > new Date(topicData.lastSeen)) {
        topicData.lastSeen = p.last_active || p.created_at
      }
    })
  })

  // Process articles - use tags (articles have embeddings)
  articles?.forEach(a => {
    const tags = a.tags || []
    const embedding = a.embedding ? (typeof a.embedding === 'string' ? JSON.parse(a.embedding) : a.embedding) : null

    tags.forEach((tag: string) => {
      if (!topicMap.has(tag)) {
        topicMap.set(tag, {
          items: [],
          embedding: null,
          firstSeen: a.created_at,
          lastSeen: a.created_at
        })
      }
      const topicData = topicMap.get(tag)!
      topicData.items.push({ id: a.id, type: 'article', timestamp: a.created_at })

      if (embedding && !topicData.embedding) {
        topicData.embedding = embedding
      }

      if (new Date(a.created_at) > new Date(topicData.lastSeen)) {
        topicData.lastSeen = a.created_at
      }
    })
  })

  console.log('[map-generation] Extracted topics:', topicMap.size)

  // 3. Semantic clustering using k-means on embeddings
  const topicsWithEmbeddings = Array.from(topicMap.entries())
    .filter(([_, data]) => data.embedding !== null)
    .map(([name, data]) => ({
      id: name,
      topic: name,
      vector: data.embedding!
    }))

  console.log('[map-generation] Topics with embeddings:', topicsWithEmbeddings.length)

  // Determine optimal number of clusters (regions)
  const numClusters = Math.max(3, Math.min(8, Math.floor(topicsWithEmbeddings.length / 5)))
  console.log('[map-generation] Creating', numClusters, 'semantic regions')

  const clusters = kMeansClustering(topicsWithEmbeddings, numClusters)

  // 4. Define cluster centers for geographic layout (regions on map)
  const clusterCenters = new Map<number, { x: number; y: number }>()
  const mapWidth = 4000
  const mapHeight = 3000
  const padding = 400

  // Arrange cluster centers in a circle pattern for visual appeal
  for (let i = 0; i < numClusters; i++) {
    const angle = (i / numClusters) * 2 * Math.PI
    const radius = Math.min(mapWidth, mapHeight) * 0.35
    clusterCenters.set(i, {
      x: mapWidth / 2 + Math.cos(angle) * radius,
      y: mapHeight / 2 + Math.sin(angle) * radius
    })
  }

  // 5. Create cities from topics
  const topicToCluster = new Map<string, number>()
  clusters.forEach((members, clusterId) => {
    members.forEach(member => {
      topicToCluster.set(member.topic, clusterId)
    })
  })

  const cities: City[] = []
  const cityIdMap = new Map<string, string>()
  let cityIndex = 0

  topicMap.forEach((data, topicName) => {
    if (data.items.length === 0) return

    const cityId = `city-${cityIndex++}`
    cityIdMap.set(topicName, cityId)

    cities.push({
      id: cityId,
      name: topicName,
      position: { x: 0, y: 0 }, // Will be set by force-directed layout
      population: data.items.length,
      size: getSizeFromPopulation(data.items.length),
      itemIds: data.items.map(item => item.id),
      founded: data.firstSeen,
      lastActive: data.lastSeen,
      cluster: topicToCluster.get(topicName) ?? 0
    })
  })

  console.log('[map-generation] Created cities:', cities.length)

  // 6. Create roads based on shared items (only if strength >= 3)
  const roads: Road[] = []
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const cityA = cities[i]
      const cityB = cities[j]

      const shared = cityA.itemIds.filter(id => cityB.itemIds.includes(id))

      // Only create road if significant connection (3+ shared items)
      if (shared.length >= 3) {
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

  console.log('[map-generation] Created roads (≥3 connections):', roads.length)

  // 7. Apply force-directed layout
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

  // 8. Create regions metadata
  const regions: Region[] = []
  clusters.forEach((members, clusterId) => {
    if (members.length === 0) return

    const center = clusterCenters.get(clusterId)!
    const citiesInRegion = cities.filter(c => c.cluster === clusterId)

    // Name region based on most common topic
    const regionName = members.length > 0 ? `${members[0].topic} Region` : `Region ${clusterId + 1}`

    regions.push({
      id: `region-${clusterId}`,
      name: regionName,
      center,
      radius: 600,
      cityIds: citiesInRegion.map(c => c.id),
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
