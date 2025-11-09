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
  const fillColor = getCityColor(city.size)

  // Different colors based on size
  const strokeColor = city.size === 'metropolis' ? 'var(--premium-gold)' :
                      city.size === 'city' ? 'var(--premium-purple)' :
                      city.size === 'town' ? 'var(--premium-indigo)' :
                      'var(--premium-blue)'

  return (
    <g onClick={onClick} className="cursor-pointer group" data-city-id={city.id}>
      {/* Outer glow ring - static (no animation for performance) */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius + 10}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1}
        opacity={0.2}
      />

      {/* Main city circle with cartographic style */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        className="transition-all"
        style={{
          filter: `drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))`
        }}
      />

      {/* Inner rings for larger cities (like district boundaries) */}
      {(city.size === 'city' || city.size === 'metropolis') && (
        <>
          <circle
            cx={city.position.x}
            cy={city.position.y}
            r={radius * 0.65}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1}
            opacity={0.3}
          />
          <circle
            cx={city.position.x}
            cy={city.position.y}
            r={radius * 0.35}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1}
            opacity={0.4}
          />
        </>
      )}

      {/* Central landmark for major cities */}
      {(city.size === 'metropolis') && (
        <circle
          cx={city.position.x}
          cy={city.position.y}
          r={radius * 0.15}
          fill={strokeColor}
          opacity={0.8}
        />
      )}

      {/* Label - map-style typography */}
      <text
        x={city.position.x}
        y={city.position.y - radius - 15}
        textAnchor="middle"
        fill="var(--premium-text-primary)"
        fontSize={city.size === 'metropolis' ? 15 : city.size === 'city' ? 13 : 12}
        fontWeight={city.size === 'metropolis' || city.size === 'city' ? 700 : 600}
        letterSpacing={city.size === 'metropolis' ? 1.5 : city.size === 'city' ? 1 : 0.5}
        className="pointer-events-none select-none uppercase"
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 4px rgba(0,0,0,0.8)'
        }}
      >
        {city.name}
      </text>

      {/* Population count badge */}
      <g>
        <rect
          x={city.position.x - 18}
          y={city.position.y + radius + 8}
          width={36}
          height={16}
          rx={8}
          fill="rgba(32, 43, 62, 0.9)"
          stroke={strokeColor}
          strokeWidth={1}
          opacity={0.95}
        />
        <text
          x={city.position.x}
          y={city.position.y + radius + 19}
          textAnchor="middle"
          fill="var(--premium-text-primary)"
          fontSize={10}
          fontWeight={600}
          className="pointer-events-none select-none"
        >
          {city.population}
        </text>
      </g>

      {/* Hover effect ring */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius + 5}
        fill="none"
        stroke="var(--premium-gold)"
        strokeWidth={3}
        opacity={0.8}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          filter: `drop-shadow(0 0 10px var(--premium-gold))`
        }}
      />
    </g>
  )
}
