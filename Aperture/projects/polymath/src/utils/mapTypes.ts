/**
 * Knowledge Map Type Definitions
 */

export type CitySize = 'homestead' | 'village' | 'town' | 'city' | 'metropolis'
export type RoadType = 'trail' | 'country' | 'main' | 'highway'
export type DoorType = 'new_connection' | 'new_topic' | 'project_idea' | 'bridge'

export interface City {
  id: string // UUID
  name: string // "React", "TypeScript", etc.
  position: { x: number; y: number } // Canvas coordinates
  population: number // Count of items (projects + thoughts + articles)
  size: CitySize // Computed from population
  topicId?: string // Link to existing topic/capability
  itemIds: string[] // IDs of projects/thoughts/articles in this city
  founded: string // ISO date of first item
  lastActive: string // ISO date of most recent item
}

export interface Road {
  id: string
  fromCityId: string
  toCityId: string
  strength: number // 1-10 (based on connection count)
  type: RoadType // Computed from strength
  connectionIds: string[] // IDs of actual connections between items
  built: string // ISO date
  lastTraveled: string // ISO date of most recent connection activity
}

export interface Door {
  id: string
  position: { x: number; y: number }
  type: DoorType
  suggestionData: any // Depends on type
  glowIntensity: number // 0-1 for animation
  created: string // ISO date
  dismissed: boolean
}

export interface Viewport {
  x: number
  y: number
  scale: number
}

export interface MapData {
  cities: City[]
  roads: Road[]
  doors: Door[]
  viewport: Viewport
  version: number
}

// Size thresholds
export const SIZE_THRESHOLDS = {
  homestead: 1,   // 1-2 items
  village: 3,     // 3-9 items
  town: 10,       // 10-19 items
  city: 20,       // 20-49 items
  metropolis: 50  // 50+ items
}

// Road type based on strength
export const ROAD_TYPES = {
  trail: 1,    // 1-2 connections
  country: 3,  // 3-5 connections
  main: 6,     // 6-10 connections
  highway: 11  // 11+ connections
}
