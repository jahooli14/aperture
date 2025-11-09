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
    >
      {/* Suggestion marker - dashed circle like map POI */}
      <circle
        cx={door.position.x}
        cy={door.position.y}
        r={20}
        fill="none"
        stroke="#9333EA"
        strokeWidth={2}
        strokeDasharray="4,4"
        opacity={0.8}
      />

      {/* Center dot */}
      <circle
        cx={door.position.x}
        cy={door.position.y}
        r={6}
        fill="#9333EA"
        opacity={0.9}
      />
    </g>
  )
}
