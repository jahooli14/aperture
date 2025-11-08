/**
 * ShootingStarsBackground Component
 * CSS-based shooting stars with smooth animations
 * Based on popular CSS shooting star patterns
 */

import React from 'react'
import '../styles/shooting-stars.css'

export function ShootingStarsBackground() {
  // Generate 20 stars with random properties
  const stars = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    // Random position across the screen
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    // Random animation delay to stagger the stars
    delay: `${Math.random() * 15}s`,
    // Random duration between 0.5s and 2s
    duration: `${0.5 + Math.random() * 1.5}s`,
  }))

  return (
    <div className="shooting-stars-container">
      {stars.map((star) => (
        <div
          key={star.id}
          className="shooting-star"
          style={{
            left: star.left,
            top: star.top,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}
    </div>
  )
}
