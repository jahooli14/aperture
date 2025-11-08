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
      {/* Road line */}
      <line
        x1={fromCity.position.x}
        y1={fromCity.position.y}
        x2={toCity.position.x}
        y2={toCity.position.y}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        className="transition-all"
      />

      {/* Optional: Label for connection count on hover */}
      {road.strength > 5 && (
        <g className="opacity-0 hover:opacity-100 transition-opacity">
          <text
            x={(fromCity.position.x + toCity.position.x) / 2}
            y={(fromCity.position.y + toCity.position.y) / 2}
            textAnchor="middle"
            fill="var(--premium-text-secondary)"
            fontSize={10}
            className="pointer-events-none select-none"
          >
            {road.strength} connections
          </text>
        </g>
      )}
    </g>
  )
}
