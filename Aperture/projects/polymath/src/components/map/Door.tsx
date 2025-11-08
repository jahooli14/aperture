/**
 * Door Component
 * Renders a glowing, mesmerizing door portal for map suggestions
 */

import { motion } from 'framer-motion'
import type { Door as DoorType } from '../../utils/mapTypes'

interface DoorProps {
  door: DoorType
  onClick: () => void
}

export function Door({ door, onClick }: DoorProps) {
  if (door.dismissed) {
    return null // Don't render dismissed doors
  }

  return (
    <g
      onClick={onClick}
      className="cursor-pointer door-portal"
      style={{ transformOrigin: `${door.position.x}px ${door.position.y}px` }}
    >
      {/* Outer glow - pulsing */}
      <motion.circle
        cx={door.position.x}
        cy={door.position.y}
        r={40}
        fill="none"
        stroke="var(--premium-gold)"
        strokeWidth={2}
        opacity={0.3}
        animate={{
          r: [40, 50, 40],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Middle glow - slower pulse */}
      <motion.circle
        cx={door.position.x}
        cy={door.position.y}
        r={30}
        fill="rgba(251, 191, 36, 0.2)"
        animate={{
          opacity: [0.2, 0.4, 0.2],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ transformOrigin: `${door.position.x}px ${door.position.y}px` }}
      />

      {/* Inner glow - fast pulse */}
      <motion.circle
        cx={door.position.x}
        cy={door.position.y}
        r={20}
        fill="rgba(251, 191, 36, 0.3)"
        animate={{
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Door icon - centered */}
      <g transform={`translate(${door.position.x - 12}, ${door.position.y - 12})`}>
        <motion.rect
          x={0}
          y={0}
          width={24}
          height={24}
          rx={2}
          fill="var(--premium-bg-3)"
          stroke="var(--premium-gold)"
          strokeWidth={2}
          animate={{
            strokeWidth: [2, 3, 2],
            filter: [
              'drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))',
              'drop-shadow(0 0 8px rgba(251, 191, 36, 0.8))',
              'drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))'
            ]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        {/* Door handle */}
        <circle
          cx={18}
          cy={12}
          r={2}
          fill="var(--premium-gold)"
        />
      </g>

      {/* Sparkles rotating around door */}
      <motion.g
        animate={{
          rotate: [0, 360]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ transformOrigin: `${door.position.x}px ${door.position.y}px` }}
      >
        {[0, 90, 180, 270].map(angle => {
          const rad = (angle * Math.PI) / 180
          const sparkleX = door.position.x + Math.cos(rad) * 35
          const sparkleY = door.position.y + Math.sin(rad) * 35

          return (
            <motion.circle
              key={angle}
              cx={sparkleX}
              cy={sparkleY}
              r={2}
              fill="var(--premium-gold)"
              opacity={0.6}
              animate={{
                opacity: [0.6, 1, 0.6],
                r: [2, 3, 2]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: angle * 0.002 // Slight delay for wave effect
              }}
            />
          )
        })}
      </motion.g>

      {/* Additional sparkle trail - counter-rotating */}
      <motion.g
        animate={{
          rotate: [360, 0]
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ transformOrigin: `${door.position.x}px ${door.position.y}px` }}
      >
        {[45, 135, 225, 315].map(angle => {
          const rad = (angle * Math.PI) / 180
          const sparkleX = door.position.x + Math.cos(rad) * 28
          const sparkleY = door.position.y + Math.sin(rad) * 28

          return (
            <motion.circle
              key={`inner-${angle}`}
              cx={sparkleX}
              cy={sparkleY}
              r={1.5}
              fill="var(--premium-gold)"
              opacity={0.4}
              animate={{
                opacity: [0.4, 0.8, 0.4]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: angle * 0.001
              }}
            />
          )
        })}
      </motion.g>

      {/* Hover effect - larger glow on hover */}
      <motion.circle
        cx={door.position.x}
        cy={door.position.y}
        r={45}
        fill="none"
        stroke="var(--premium-gold)"
        strokeWidth={1}
        opacity={0}
        whileHover={{
          opacity: [0, 0.4, 0],
          r: [45, 60, 45]
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity
        }}
      />
    </g>
  )
}
