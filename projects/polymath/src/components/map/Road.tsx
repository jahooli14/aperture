/**
 * Road Component
 * Renders a connection (road) between two cities
 */

import { memo } from 'react'
import type { Road as RoadType, City } from '../../utils/mapTypes'
import { getRoadWidth, getRoadColor, getRoadDashArray } from '../../utils/mapCalculations'

interface RoadProps {
  road: RoadType
  cities: City[]
}

export const Road = memo(function Road({ road, cities }: RoadProps) {
  // Find the connected cities
  const fromCity = cities.find(c => c.id === road.fromCityId)
  const toCity = cities.find(c => c.id === road.toCityId)

  // If either city is missing, don't render
  if (!fromCity || !toCity) {
    return null
  }

  const width = getRoadWidth(road.type)
  const color = getRoadColor(road.type)
  const dashArray = getRoadDashArray(road.type)

  return (
    <g data-road-id={road.id}>
      {/* Road casing (white outline) */}
      <line
        x1={fromCity.position.x}
        y1={fromCity.position.y}
        x2={toCity.position.x}
        y2={toCity.position.y}
        stroke="#ffffff"
        strokeWidth={width + 2}
        strokeLinecap="round"
        opacity={0.9}
      />

      {/* Road center (blue line) */}
      <line
        x1={fromCity.position.x}
        y1={fromCity.position.y}
        x2={toCity.position.x}
        y2={toCity.position.y}
        stroke="#3b82f6"
        strokeWidth={width}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  )
})
