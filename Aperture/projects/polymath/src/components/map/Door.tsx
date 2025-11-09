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
      {/* Outer glow - subtle pulse */}
      <circle
        cx={door.position.x}
        cy={door.position.y}
        r={25}
        fill="rgba(251, 191, 36, 0.15)"
        stroke="var(--premium-gold)"
        strokeWidth={1}
        opacity={0.6}
      />

      {/* Inner glow - solid center */}
      <circle
        cx={door.position.x}
        cy={door.position.y}
        r={12}
        fill="rgba(251, 191, 36, 0.4)"
        stroke="var(--premium-gold)"
        strokeWidth={2}
      />
    </g>
  )
}
