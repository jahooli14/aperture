/**
 * CityNode Component - OPTIMIZED
 * Renders cities with map-style visuals and minimal animations for performance
 */

import type { City } from '../../utils/mapTypes'
import { getCityRadius, getCityColor } from '../../utils/mapCalculations'

interface CityNodeProps {
  city: City
  onClick: () => void
}

export function CityNode({ city, onClick }: CityNodeProps) {
  const radius = getCityRadius(city.size)

  // Map pin style - consistent red/orange like Google Maps
  const pinColor = city.size === 'metropolis' ? '#EA4335' :  // Google red
                   city.size === 'city' ? '#FBBC04' :        // Google yellow
                   city.size === 'town' ? '#34A853' :        // Google green
                   '#4285F4'                                 // Google blue

  return (
    <g onClick={onClick} className="cursor-pointer group" data-city-id={city.id}>
      {/* Map pin shadow */}
      <ellipse
        cx={city.position.x}
        cy={city.position.y + radius + 2}
        rx={radius * 0.6}
        ry={radius * 0.3}
        fill="#000000"
        opacity={0.3}
      />

      {/* Map pin body (teardrop shape) */}
      <g>
        {/* Pin circle */}
        <circle
          cx={city.position.x}
          cy={city.position.y}
          r={radius}
          fill={pinColor}
          stroke="#ffffff"
          strokeWidth={2}
          style={{
            filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))`
          }}
        />

        {/* Pin point (triangle) */}
        <path
          d={`M ${city.position.x} ${city.position.y + radius}
              L ${city.position.x - radius * 0.5} ${city.position.y + radius * 0.3}
              L ${city.position.x + radius * 0.5} ${city.position.y + radius * 0.3} Z`}
          fill={pinColor}
          stroke="#ffffff"
          strokeWidth={1.5}
        />

        {/* Pin center dot */}
        <circle
          cx={city.position.x}
          cy={city.position.y}
          r={radius * 0.35}
          fill="#ffffff"
          opacity={0.9}
        />
      </g>

      {/* Label - Google Maps style */}
      <text
        x={city.position.x}
        y={city.position.y - radius - 12}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={city.size === 'metropolis' ? 14 : city.size === 'city' ? 12 : 11}
        fontWeight={600}
        className="pointer-events-none select-none"
        style={{
          fontFamily: 'Inter, Roboto, system-ui, sans-serif',
          textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
          letterSpacing: '0.5px'
        }}
      >
        {city.name}
      </text>

      {/* Population badge */}
      <g>
        <rect
          x={city.position.x - 20}
          y={city.position.y + radius + 10}
          width={40}
          height={18}
          rx={9}
          fill="#202020"
          stroke="#ffffff"
          strokeWidth={1.5}
          opacity={0.95}
        />
        <text
          x={city.position.x}
          y={city.position.y + radius + 22}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={10}
          fontWeight={600}
          className="pointer-events-none select-none"
        >
          {city.population}
        </text>
      </g>

      {/* Hover pulse effect */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius + 8}
        fill="none"
        stroke={pinColor}
        strokeWidth={2}
        opacity={0}
        className="group-hover:opacity-60 transition-opacity duration-200"
      />
    </g>
  )
}
