/**
 * CityNode Component
 * Renders an individual city on the knowledge map with enhanced visuals
 */

import { motion } from 'framer-motion'
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
      {/* Outer glow ring - animated pulse */}
      <motion.circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius + 10}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1}
        opacity={0.3}
        animate={{
          r: [radius + 10, radius + 15, radius + 10],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Main city circle */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        className="transition-all hover:stroke-[3px]"
        style={{
          filter: `drop-shadow(0 4px 12px rgba(59, 130, 246, 0.4))`
        }}
      />

      {/* Inner rings for larger cities */}
      {(city.size === 'city' || city.size === 'metropolis') && (
        <>
          <circle
            cx={city.position.x}
            cy={city.position.y}
            r={radius * 0.6}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1}
            opacity={0.4}
          />
          <circle
            cx={city.position.x}
            cy={city.position.y}
            r={radius * 0.3}
            fill={strokeColor}
            opacity={0.6}
          />
        </>
      )}

      {/* Population indicator (center dot) */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius * 0.15}
        fill="white"
        opacity={0.8}
      />

      {/* Label */}
      <text
        x={city.position.x}
        y={city.position.y - radius - 15}
        textAnchor="middle"
        fill="var(--premium-text-primary)"
        fontSize={city.size === 'metropolis' || city.size === 'city' ? 16 : 14}
        fontWeight={600}
        className="pointer-events-none select-none"
        style={{
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}
      >
        {city.name}
      </text>

      {/* Population count badge */}
      <g>
        <rect
          x={city.position.x - 15}
          y={city.position.y + radius + 5}
          width={30}
          height={18}
          rx={9}
          fill="var(--premium-bg-3)"
          opacity={0.9}
        />
        <text
          x={city.position.x}
          y={city.position.y + radius + 17}
          textAnchor="middle"
          fill="var(--premium-text-primary)"
          fontSize={11}
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
        strokeWidth={2}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </g>
  )
}
