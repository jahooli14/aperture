/**
 * Knowledge Map Calculation Utilities
 * City sizes, road types, and other computations
 */

import type { CitySize, RoadType } from './mapTypes'
import { SIZE_THRESHOLDS, ROAD_TYPES } from './mapTypes'

/**
 * Calculate city size based on population (item count)
 */
export function getSizeFromPopulation(population: number): CitySize {
  if (population >= SIZE_THRESHOLDS.metropolis) return 'metropolis'
  if (population >= SIZE_THRESHOLDS.city) return 'city'
  if (population >= SIZE_THRESHOLDS.town) return 'town'
  if (population >= SIZE_THRESHOLDS.village) return 'village'
  return 'homestead'
}

/**
 * Calculate road type based on connection strength
 */
export function getRoadTypeFromStrength(strength: number): RoadType {
  if (strength >= ROAD_TYPES.highway) return 'highway'
  if (strength >= ROAD_TYPES.main) return 'main'
  if (strength >= ROAD_TYPES.country) return 'country'
  return 'trail'
}

/**
 * Generate grid layout position for a city
 * Simple grid layout for Phase 1 (will be improved in Phase 4 with force-directed layout)
 */
export function gridLayout(index: number, total: number): { x: number; y: number } {
  const cols = Math.ceil(Math.sqrt(total))
  const row = Math.floor(index / cols)
  const col = index % cols
  return {
    x: 200 + col * 300,
    y: 200 + row * 300
  }
}

/**
 * Calculate city radius based on size
 */
export function getCityRadius(size: CitySize): number {
  const radii = {
    homestead: 20,
    village: 35,
    town: 50,
    city: 70,
    metropolis: 100
  }
  return radii[size]
}

/**
 * Calculate road width based on type
 */
export function getRoadWidth(type: RoadType): number {
  const widths = {
    trail: 2,
    country: 3,
    main: 5,
    highway: 8
  }
  return widths[type]
}

/**
 * Get city color based on size
 */
export function getCityColor(size: CitySize): string {
  const colors = {
    homestead: 'rgba(156, 163, 175, 0.5)', // Gray
    village: 'rgba(59, 130, 246, 0.3)',     // Blue
    town: 'rgba(99, 102, 241, 0.4)',        // Indigo
    city: 'rgba(139, 92, 246, 0.5)',        // Purple
    metropolis: 'rgba(251, 191, 36, 0.6)'   // Gold
  }
  return colors[size]
}

/**
 * Get road color based on type
 */
export function getRoadColor(type: RoadType): string {
  const colors = {
    trail: 'rgba(255, 255, 255, 0.2)',
    country: 'rgba(255, 255, 255, 0.3)',
    main: 'rgba(59, 130, 246, 0.4)',
    highway: 'rgba(59, 130, 246, 0.6)'
  }
  return colors[type]
}

/**
 * Get road dash array for trails (dotted lines)
 */
export function getRoadDashArray(type: RoadType): string | undefined {
  return type === 'trail' ? '5,5' : undefined
}
