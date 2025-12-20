/**
 * Road Component - PREMIUM
 * Renders an organic, curved connection between cities
 */

import { memo } from 'react'
import * as d3 from 'd3-shape'
import type { Road as RoadType, City } from '../../utils/mapTypes'

interface RoadProps {
  road: RoadType
  cities: City[]
}

export const Road = memo(function Road({ road, cities }: RoadProps) {
  const sourceCity = cities.find(c => c.id === road.fromCityId)
  const targetCity = cities.find(c => c.id === road.toCityId)

  if (!sourceCity || !targetCity) return null

  // Calculate curve control points for organic look
  // We use a simple quadratic curve that bends slightly
  const dx = targetCity.position.x - sourceCity.position.x
  const dy = targetCity.position.y - sourceCity.position.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Midpoint
  const midX = (sourceCity.position.x + targetCity.position.x) / 2
  const midY = (sourceCity.position.y + targetCity.position.y) / 2

  // Offset midpoint perpendicular to the line to create a curve
  // Randomize slightly based on road ID to keep it consistent but varied
  const seed = road.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const offset = (seed % 100 - 50) * (distance / 500) // Scale offset with distance

  // Perpendicular vector (-dy, dx) normalized
  const perpX = -dy / distance
  const perpY = dx / distance

  const controlX = midX + perpX * offset
  const controlY = midY + perpY * offset

  // Create path data
  const pathData = `M ${sourceCity.position.x} ${sourceCity.position.y} Q ${controlX} ${controlY} ${targetCity.position.x} ${targetCity.position.y}`

  // Style based on road type
  const isHighway = road.type === 'highway'
  const isMain = road.type === 'main'

  const width = isHighway ? 6 : isMain ? 4 : 2
  const color = isHighway ? '#94a3b8' : isMain ? '#cbd5e1' : '#e2e8f0'
  const dashArray = isHighway ? 'none' : isMain ? 'none' : '4,4'

  return (
    <g className="road-group">
      {/* Outer casing (white border) for better visibility over terrain */}
      <path
        d={pathData}
        fill="none"
        stroke="white"
        strokeWidth={width + 4}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Inner road */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        className="transition-all duration-300"
      />
    </g>
  )
})
