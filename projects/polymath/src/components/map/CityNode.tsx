/**
 * CityNode Component - PREMIUM
 * Renders a city as a 3D-style building block with dynamic lighting and shadows
 */

import { memo } from 'react'
import type { City } from '../../utils/mapTypes'
import { CityBuilding } from './CityBuilding'

interface CityNodeProps {
  city: City
  onClick: () => void
}

export const CityNode = memo(function CityNode({ city, onClick }: CityNodeProps) {
  // Determine size and color based on population/importance
  const isMetropolis = city.size === 'metropolis'
  const isCity = city.size === 'city'

  // Base size calculation
  const baseSize = isMetropolis ? 120 : isCity ? 80 : 50
  const buildingSize = baseSize + (city.population * 0.5) // Grow slightly with population
  const buildingHeight = isMetropolis ? 60 : isCity ? 40 : 20

  // Color palette - Premium/Dark theme
  const color = isMetropolis
    ? '#3b82f6' // Blue for metropolis
    : isCity
      ? '#60a5fa' // Light blue for city
      : '#94a3b8' // Slate for town/village

  return (
    <g
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="cursor-pointer group"
      data-city-id={city.id}
      style={{ transition: 'opacity 0.2s' }}
    >
      {/* Selection Halo */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={buildingSize * 0.8}
        fill={color}
        opacity={0}
        className="group-hover:opacity-20 transition-opacity duration-300"
        style={{ filter: 'blur(20px)' }}
      />

      {/* 3D Building Block */}
      <CityBuilding
        x={city.position.x}
        y={city.position.y}
        width={buildingSize}
        height={buildingSize}
        depth={buildingHeight}
        color={color}
      />

      {/* Label */}
      <text
        x={city.position.x}
        y={city.position.y - buildingHeight - 15}
        textAnchor="middle"
        fill="#1f2937"
        fontSize={city.size === 'metropolis' ? 14 : city.size === 'city' ? 12 : 11}
        fontWeight={600}
        className="pointer-events-none select-none"
        style={{
          fontFamily: 'Inter, Roboto, system-ui, sans-serif',
          letterSpacing: '0.3px',
          textShadow: '0 1px 2px rgba(255,255,255,0.8)'
        }}
      >
        {city.name}
      </text>

      {/* Population badge */}
      {city.population > 0 && (
        <g transform={`translate(0, ${buildingSize / 2})`}>
          <rect
            x={city.position.x - 14}
            y={city.position.y + 10}
            width={28}
            height={14}
            rx={7}
            fill="#ffffff"
            stroke={color}
            strokeWidth={1.5}
            opacity={0.9}
          />
          <text
            x={city.position.x}
            y={city.position.y + 20}
            textAnchor="middle"
            fill={color}
            fontSize={9}
            fontWeight={700}
            className="pointer-events-none select-none"
          >
            {city.population}
          </text>
        </g>
      )}
    </g>
  )
})
