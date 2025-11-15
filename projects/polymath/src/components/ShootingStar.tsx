/**
 * ShootingStar Component - Subtle animated background effect
 * Medium activity: 3-5 stars with randomized trajectories
 */

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Star {
  id: number
  startX: number
  startY: number
  angle: number
  duration: number
  delay: number
  length: number
}

const generateStar = (id: number): Star => {
  // Random starting position along edges
  const edge = Math.floor(Math.random() * 4)
  let startX = 0
  let startY = 0
  let angle = 0

  switch (edge) {
    case 0: // Top edge
      startX = Math.random() * 100
      startY = 0
      angle = 135 + (Math.random() - 0.5) * 30 // Downward angles
      break
    case 1: // Right edge
      startX = 100
      startY = Math.random() * 100
      angle = 180 + (Math.random() - 0.5) * 30 // Leftward angles
      break
    case 2: // Top-left to bottom-right diagonal (most common)
      startX = Math.random() * 30
      startY = Math.random() * 30
      angle = 135 + (Math.random() - 0.5) * 20
      break
    case 3: // Top-right to bottom-left diagonal
      startX = 70 + Math.random() * 30
      startY = Math.random() * 30
      angle = 225 + (Math.random() - 0.5) * 20
      break
  }

  return {
    id,
    startX,
    startY,
    angle,
    duration: 2 + Math.random() * 3, // 2-5 seconds
    delay: Math.random() * 8, // Stagger appearance over 8 seconds
    length: 60 + Math.random() * 80, // Trail length 60-140px
  }
}

export function ShootingStar() {
  const [stars, setStars] = useState<Star[]>([])

  useEffect(() => {
    // Generate initial set of 4 stars (medium activity)
    const initialStars = Array.from({ length: 4 }, (_, i) => generateStar(i))
    setStars(initialStars)

    // Regenerate stars periodically to maintain 3-5 visible at a time
    const interval = setInterval(() => {
      setStars(prev => {
        const newId = prev.length > 0 ? Math.max(...prev.map(s => s.id)) + 1 : 0
        return [...prev.slice(-3), generateStar(newId)]
      })
    }, 4000) // New star every 4 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map(star => {
        // Calculate end position based on angle
        const radians = (star.angle * Math.PI) / 180
        const distance = 150 // Distance in viewport units
        const endX = star.startX + Math.cos(radians) * distance
        const endY = star.startY + Math.sin(radians) * distance

        return (
          <motion.div
            key={star.id}
            className="absolute"
            style={{
              left: `${star.startX}%`,
              top: `${star.startY}%`,
              width: `${star.length}px`,
              height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(100, 180, 255, 0.6), transparent)',
              transformOrigin: 'left center',
              rotate: `${star.angle}deg`,
              filter: 'blur(0.5px)',
              willChange: 'transform, opacity',
            }}
            initial={{
              opacity: 0,
              x: 0,
              y: 0,
              scaleX: 0
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: `${endX - star.startX}%`,
              y: `${endY - star.startY}%`,
              scaleX: [0, 1, 1, 0.5],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              ease: 'easeOut',
              times: [0, 0.1, 0.9, 1],
            }}
          />
        )
      })}
    </div>
  )
}
