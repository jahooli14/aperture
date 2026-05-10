/**
 * SubtleBackground — atmospheric layers behind the app:
 * three drifting orbs, a slow aurora ribbon, a base mesh wash, and
 * a faint film-grain. Combined, they give the home a cinematic depth
 * without ever drawing attention to themselves.
 */

import '../styles/subtle-background.css'

export function SubtleBackground() {
  return (
    <div className="subtle-background" aria-hidden="true">
      <div className="aurora" />
      <div className="gradient-orb orb-1" />
      <div className="gradient-orb orb-2" />
      <div className="gradient-orb orb-3" />
    </div>
  )
}
