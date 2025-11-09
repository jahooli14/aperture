/**
 * CityNode Component - OPTIMIZED
 * Renders cities with map-style visuals and minimal animations for performance
 */

import { memo } from 'react'
import type { City } from '../../utils/mapTypes'
import { getCityRadius, getCityColor } from '../../utils/mapCalculations'

interface CityNodeProps {
  city: City
  onClick: () => void
}

export const CityNode = memo(function CityNode({ city, onClick }: CityNodeProps) {
  const radius = getCityRadius(city.size)

  // Blue shades only - darker = more important
  const fillColor = city.size === 'metropolis' ? '#1e40af' :  // Dark blue
                    city.size === 'city' ? '#3b82f6' :        // Medium blue
                    city.size === 'town' ? '#60a5fa' :        // Light blue
                    '#93c5fd'                                 // Very light blue

  return (
    <g onClick={onClick} className="cursor-pointer group" data-city-id={city.id}>
      {/* Simple circle - no icons */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius}
        fill={fillColor}
        stroke="#ffffff"
        strokeWidth={3}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
        }}
      />

      {/* Label */}
      <text
        x={city.position.x}
        y={city.position.y - radius - 10}
        textAnchor="middle"
        fill="#1f2937"
        fontSize={city.size === 'metropolis' ? 14 : city.size === 'city' ? 12 : 11}
        fontWeight={600}
        className="pointer-events-none select-none"
        style={{
          fontFamily: 'Inter, Roboto, system-ui, sans-serif',
          letterSpacing: '0.3px'
        }}
      >
        {city.name}
      </text>

      {/* Population badge */}
      <g>
        <rect
          x={city.position.x - 18}
          y={city.position.y + radius + 8}
          width={36}
          height={16}
          rx={8}
          fill="#ffffff"
          stroke={fillColor}
          strokeWidth={1.5}
          opacity={0.95}
        />
        <text
          x={city.position.x}
          y={city.position.y + radius + 19}
          textAnchor="middle"
          fill={fillColor}
          fontSize={10}
          fontWeight={600}
          className="pointer-events-none select-none"
        >
          {city.population}
        </text>
      </g>

      {/* Hover ring */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius + 6}
        fill="none"
        stroke={fillColor}
        strokeWidth={2}
        opacity={0}
        className="group-hover:opacity-50 transition-opacity duration-200"
      />
    </g>
  )
})
