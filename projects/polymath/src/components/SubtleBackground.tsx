/**
 * SubtleBackground Component
 * Minimal, elegant animated gradient background
 */

import React from 'react'
import '../styles/subtle-background.css'

export function SubtleBackground() {
  return (
    <div className="subtle-background">
      <div className="gradient-orb orb-1" />
      <div className="gradient-orb orb-2" />
      <div className="gradient-orb orb-3" />
    </div>
  )
}
