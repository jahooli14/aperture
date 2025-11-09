/**
 * Road Component
 * Renders a connection (road) between two cities
 */

import type { Road, City } from '../../utils/mapTypes'
import { getRoadWidth, getRoadColor, getRoadDashArray } from '../../utils/mapCalculations'

interface RoadProps {
  road: Road
  cities: City[]
}

export function Road({ road, cities }: RoadProps) {
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
      {/* Road casing (dark outline) - Google Maps style */}
      <line
        x1={fromCity.position.x}
        y1={fromCity.position.y}
        x2={toCity.position.x}
        y2={toCity.position.y}
        stroke="#0f1419"
        strokeWidth={width + 3}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Road center (colored line) */}
      <line
        x1={fromCity.position.x}
        y1={fromCity.position.y}
        x2={toCity.position.x}
        y2={toCity.position.y}
        stroke="#ffa500"
        strokeWidth={width}
        strokeLinecap="round"
        opacity={0.9}
      />
    </g>
  )
}
